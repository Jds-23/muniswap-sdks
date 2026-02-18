import type { Trade as RouterTrade } from '@muniswap/router-sdk'
import {
  CHAIN_TO_ADDRESSES_MAP,
  type Currency,
  Percent,
  type SupportedChainsType,
  type TradeType,
} from '@muniswap/sdk-core'
import {
  type MethodParameters,
  type Position as V3Position,
  type RemoveLiquidityOptions as V3RemoveLiquidityOptions,
  removeCallParameters as v3RemoveCallParameters,
} from '@muniswap/v3-sdk'
import {
  type MintOptions,
  type AddLiquidityOptions as V4AddLiquidityOptions,
  Pool as V4PoolClass,
  type Position as V4Position,
  V4PositionManager,
} from '@muniswap/v4-sdk'
import { AbiFunction, type Hex } from 'ox'
import invariant from 'tiny-invariant'
import { type SwapOptions, UniswapTrade } from './entities/actions/uniswap'
import { UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from './utils/constants'
import { encodePermit, encodeV3PositionPermit } from './utils/inputTokens'
import { CommandType, RoutePlanner } from './utils/routerCommands'

export type SwapRouterConfig = {
  sender?: string // address
  deadline?: bigint | undefined
}

export interface MigrateV3ToV4Options {
  inputPosition: V3Position
  outputPosition: V4Position
  v3RemoveLiquidityOptions: V3RemoveLiquidityOptions
  v4AddLiquidityOptions: V4AddLiquidityOptions
}

function isMint(options: V4AddLiquidityOptions): options is MintOptions {
  return Object.keys(options).some((k) => k === 'recipient')
}

// ABI definitions for Universal Router execute functions
const executeWithDeadlineAbi = AbiFunction.from('function execute(bytes commands, bytes[] inputs, uint256 deadline)')
const executeAbi = AbiFunction.from('function execute(bytes commands, bytes[] inputs)')

// V3 NonfungiblePositionManager function selectors
const v3CollectAbi = AbiFunction.from(
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) returns (uint256 amount0, uint256 amount1)'
)
const v3DecreaseLiquidityAbi = AbiFunction.from(
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) returns (uint256 amount0, uint256 amount1)'
)
const v3BurnAbi = AbiFunction.from('function burn(uint256 tokenId)')
const v3MulticallAbi = AbiFunction.from('function multicall(bytes[] data) returns (bytes[] results)')

const v3CollectSelector = AbiFunction.getSelector(v3CollectAbi)
const v3DecreaseLiquiditySelector = AbiFunction.getSelector(v3DecreaseLiquidityAbi)
const v3BurnSelector = AbiFunction.getSelector(v3BurnAbi)
const v3MulticallSelector = AbiFunction.getSelector(v3MulticallAbi)

function decodeMulticall(calldata: Hex.Hex): Hex.Hex[] {
  const selector = calldata.slice(0, 10) as string
  if (selector === v3MulticallSelector) {
    const decoded = AbiFunction.decodeData(v3MulticallAbi, calldata)
    return [...decoded[0]] as Hex.Hex[]
  }
  return [calldata]
}

export abstract class SwapRouter {
  public static swapCallParameters(
    trades: RouterTrade<Currency, Currency, TradeType>,
    options: SwapOptions
  ): MethodParameters {
    const planner = new RoutePlanner()

    const trade: UniswapTrade = new UniswapTrade(trades, options)

    const inputCurrency = trade.trade.inputAmount.currency
    invariant(!(inputCurrency.isNative && !!options.inputTokenPermit), 'NATIVE_INPUT_PERMIT')

    if (options.inputTokenPermit) {
      encodePermit(planner, options.inputTokenPermit)
    }

    const nativeCurrencyValue = inputCurrency.isNative
      ? BigInt(trade.trade.maximumAmountIn(options.slippageTolerance).quotient.toString())
      : 0n

    trade.encode(planner, { allowRevert: false })
    return SwapRouter.encodePlan(planner, nativeCurrencyValue, {
      deadline: options.deadlineOrPreviousBlockhash
        ? BigInt(options.deadlineOrPreviousBlockhash.toString())
        : undefined,
    })
  }

  /**
   * Builds the call parameters for a migration from a V3 position to a V4 position.
   */
  public static migrateV3ToV4CallParameters(
    options: MigrateV3ToV4Options,
    positionManagerOverride?: string
  ): MethodParameters {
    const v4Pool = options.outputPosition.pool as V4PoolClass
    const v3Token0 = options.inputPosition.pool.token0
    const v3Token1 = options.inputPosition.pool.token1
    const v4PositionManagerAddress =
      positionManagerOverride ?? CHAIN_TO_ADDRESSES_MAP[v4Pool.chainId as SupportedChainsType].v4PositionManagerAddress

    if (v4Pool.currency0.isNative) {
      invariant(
        (v4Pool.currency0.wrapped.equals(v3Token0) && v4Pool.currency1.equals(v3Token1)) ||
          (v4Pool.currency0.wrapped.equals(v3Token1) && v4Pool.currency1.equals(v3Token0)),
        'TOKEN_MISMATCH'
      )
    } else {
      invariant(v3Token0 === v4Pool.token0, 'TOKEN0_MISMATCH')
      invariant(v3Token1 === v4Pool.token1, 'TOKEN1_MISMATCH')
    }

    invariant(
      options.v3RemoveLiquidityOptions.liquidityPercentage.equalTo(new Percent(100, 100)),
      'FULL_REMOVAL_REQUIRED'
    )
    invariant(options.v3RemoveLiquidityOptions.burnToken === true, 'BURN_TOKEN_REQUIRED')
    invariant(
      options.v3RemoveLiquidityOptions.collectOptions.recipient === v4PositionManagerAddress,
      'RECIPIENT_NOT_POSITION_MANAGER'
    )
    invariant(isMint(options.v4AddLiquidityOptions), 'MINT_REQUIRED')
    invariant(options.v4AddLiquidityOptions.migrate, 'MIGRATE_REQUIRED')

    const planner = new RoutePlanner()

    // to prevent reentrancy by the pool hook, we initialize the v4 pool before moving funds
    if (options.v4AddLiquidityOptions.createPool) {
      const poolKey = V4PoolClass.getPoolKey(
        v4Pool.currency0,
        v4Pool.currency1,
        v4Pool.fee,
        v4Pool.tickSpacing,
        v4Pool.hooks
      )
      planner.addCommand(CommandType.V4_INITIALIZE_POOL, [poolKey, v4Pool.sqrtRatioX96.toString()])
      // remove createPool setting, so that it doesnt get encoded again later
      // biome-ignore lint/performance/noDelete: intentional property removal
      delete options.v4AddLiquidityOptions.createPool
    }

    // add position permit to the universal router planner
    if (options.v3RemoveLiquidityOptions.permit) {
      const universalRouterAddress = UNIVERSAL_ROUTER_ADDRESS(
        UniversalRouterVersion.V2_0,
        options.inputPosition.pool.chainId as unknown as number
      )
      invariant(universalRouterAddress === options.v3RemoveLiquidityOptions.permit.spender, 'INVALID_SPENDER')
      encodeV3PositionPermit(planner, options.v3RemoveLiquidityOptions.permit, options.v3RemoveLiquidityOptions.tokenId)
      // remove permit so that multicall doesnt add it again
      // biome-ignore lint/performance/noDelete: intentional property removal
      delete options.v3RemoveLiquidityOptions.permit
    }

    // encode v3 withdraw
    const v3RemoveParams: MethodParameters = v3RemoveCallParameters(
      options.inputPosition,
      options.v3RemoveLiquidityOptions
    )
    const v3Calls = decodeMulticall(v3RemoveParams.calldata as Hex.Hex)

    for (const v3Call of v3Calls) {
      const selector = v3Call.slice(0, 10)
      invariant(
        selector === v3CollectSelector || selector === v3DecreaseLiquiditySelector || selector === v3BurnSelector,
        `INVALID_V3_CALL: ${selector}`
      )
      planner.addCommand(CommandType.V3_POSITION_MANAGER_CALL, [v3Call])
    }

    // encode v4 mint
    const v4AddParams = V4PositionManager.addCallParameters(options.outputPosition, options.v4AddLiquidityOptions)
    const v4Selector = v4AddParams.calldata.slice(0, 10)
    // Verify the v4 call is modifyLiquidities
    const modifyLiquiditiesAbi = AbiFunction.from('function modifyLiquidities(bytes unlockData, uint256 deadline)')
    invariant(v4Selector === AbiFunction.getSelector(modifyLiquiditiesAbi), `INVALID_V4_CALL: ${v4Selector}`)

    planner.addCommand(CommandType.V4_POSITION_MANAGER_CALL, [v4AddParams.calldata])

    return SwapRouter.encodePlan(planner, 0n, {
      deadline: BigInt(options.v4AddLiquidityOptions.deadline.toString()),
    })
  }

  /**
   * Encodes a planned route into a method name and parameters for the Router contract.
   */
  private static encodePlan(
    planner: RoutePlanner,
    nativeCurrencyValue: bigint,
    config: SwapRouterConfig = {}
  ): MethodParameters {
    const { commands, inputs } = planner
    const calldata = config.deadline
      ? AbiFunction.encodeData(executeWithDeadlineAbi, [commands as Hex.Hex, inputs as Hex.Hex[], config.deadline])
      : AbiFunction.encodeData(executeAbi, [commands as Hex.Hex, inputs as Hex.Hex[]])

    return { calldata: calldata as Hex.Hex, value: `0x${nativeCurrencyValue.toString(16)}` as Hex.Hex }
  }
}
