import { type Currency, type Percent, TradeType } from '@uniswap/sdk-core-next'
import { AbiParameters } from 'ox'
import invariant from 'tiny-invariant'
import type { Trade } from '../entities/trade'
import { ADDRESS_ZERO, EMPTY_BYTES } from '../internalConstants'
import { encodeRouteToPath } from './encodeRouteToPath'

/**
 * Actions supported by the V4 Router and Position Manager
 */
export enum Actions {
  // Liquidity actions
  INCREASE_LIQUIDITY = 0x00,
  DECREASE_LIQUIDITY = 0x01,
  MINT_POSITION = 0x02,
  BURN_POSITION = 0x03,

  // Swapping
  SWAP_EXACT_IN_SINGLE = 0x06,
  SWAP_EXACT_IN = 0x07,
  SWAP_EXACT_OUT_SINGLE = 0x08,
  SWAP_EXACT_OUT = 0x09,

  // Settling (closing deltas on the pool manager)
  SETTLE = 0x0b,
  SETTLE_ALL = 0x0c,
  SETTLE_PAIR = 0x0d,

  // Taking
  TAKE = 0x0e,
  TAKE_ALL = 0x0f,
  TAKE_PORTION = 0x10,
  TAKE_PAIR = 0x11,

  CLOSE_CURRENCY = 0x12,
  SWEEP = 0x14,

  // Wrapping/unwrapping native
  UNWRAP = 0x16,
}

export enum Subparser {
  V4SwapExactInSingle = 0,
  V4SwapExactIn = 1,
  V4SwapExactOutSingle = 2,
  V4SwapExactOut = 3,
  PoolKey = 4,
}

export type ParamType = {
  readonly name: string
  readonly type: string
  readonly subparser?: Subparser
}

const POOL_KEY_STRUCT = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'

const PATH_KEY_STRUCT = '(address intermediateCurrency,uint256 fee,int24 tickSpacing,address hooks,bytes hookData)'

const SWAP_EXACT_IN_SINGLE_STRUCT = `(${POOL_KEY_STRUCT} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`

const SWAP_EXACT_IN_STRUCT = `(address currencyIn,${PATH_KEY_STRUCT}[] path,uint128 amountIn,uint128 amountOutMinimum)`

const SWAP_EXACT_OUT_SINGLE_STRUCT = `(${POOL_KEY_STRUCT} poolKey,bool zeroForOne,uint128 amountOut,uint128 amountInMaximum,bytes hookData)`

const SWAP_EXACT_OUT_STRUCT = `(address currencyOut,${PATH_KEY_STRUCT}[] path,uint128 amountOut,uint128 amountInMaximum)`

export const V4_BASE_ACTIONS_ABI_DEFINITION: { [key in Actions]: readonly ParamType[] } = {
  // Liquidity commands
  [Actions.INCREASE_LIQUIDITY]: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'liquidity', type: 'uint256' },
    { name: 'amount0Max', type: 'uint128' },
    { name: 'amount1Max', type: 'uint128' },
    { name: 'hookData', type: 'bytes' },
  ],
  [Actions.DECREASE_LIQUIDITY]: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'liquidity', type: 'uint256' },
    { name: 'amount0Min', type: 'uint128' },
    { name: 'amount1Min', type: 'uint128' },
    { name: 'hookData', type: 'bytes' },
  ],
  [Actions.MINT_POSITION]: [
    { name: 'poolKey', type: POOL_KEY_STRUCT, subparser: Subparser.PoolKey },
    { name: 'tickLower', type: 'int24' },
    { name: 'tickUpper', type: 'int24' },
    { name: 'liquidity', type: 'uint256' },
    { name: 'amount0Max', type: 'uint128' },
    { name: 'amount1Max', type: 'uint128' },
    { name: 'owner', type: 'address' },
    { name: 'hookData', type: 'bytes' },
  ],
  [Actions.BURN_POSITION]: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount0Min', type: 'uint128' },
    { name: 'amount1Min', type: 'uint128' },
    { name: 'hookData', type: 'bytes' },
  ],

  // Swapping commands
  [Actions.SWAP_EXACT_IN_SINGLE]: [
    { name: 'swap', type: SWAP_EXACT_IN_SINGLE_STRUCT, subparser: Subparser.V4SwapExactInSingle },
  ],
  [Actions.SWAP_EXACT_IN]: [{ name: 'swap', type: SWAP_EXACT_IN_STRUCT, subparser: Subparser.V4SwapExactIn }],
  [Actions.SWAP_EXACT_OUT_SINGLE]: [
    { name: 'swap', type: SWAP_EXACT_OUT_SINGLE_STRUCT, subparser: Subparser.V4SwapExactOutSingle },
  ],
  [Actions.SWAP_EXACT_OUT]: [{ name: 'swap', type: SWAP_EXACT_OUT_STRUCT, subparser: Subparser.V4SwapExactOut }],

  // Payments commands
  [Actions.SETTLE]: [
    { name: 'currency', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'payerIsUser', type: 'bool' },
  ],
  [Actions.SETTLE_ALL]: [
    { name: 'currency', type: 'address' },
    { name: 'maxAmount', type: 'uint256' },
  ],
  [Actions.SETTLE_PAIR]: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
  ],
  [Actions.TAKE]: [
    { name: 'currency', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  [Actions.TAKE_ALL]: [
    { name: 'currency', type: 'address' },
    { name: 'minAmount', type: 'uint256' },
  ],
  [Actions.TAKE_PORTION]: [
    { name: 'currency', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'bips', type: 'uint256' },
  ],
  [Actions.TAKE_PAIR]: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'recipient', type: 'address' },
  ],
  [Actions.CLOSE_CURRENCY]: [{ name: 'currency', type: 'address' }],
  [Actions.SWEEP]: [
    { name: 'currency', type: 'address' },
    { name: 'recipient', type: 'address' },
  ],
  [Actions.UNWRAP]: [{ name: 'amount', type: 'uint256' }],
}

const FULL_DELTA_AMOUNT = 0n

type RouterAction = {
  action: Actions
  encodedInput: string
}

function currencyAddress(currency: Currency): string {
  return currency.isNative ? ADDRESS_ZERO : currency.wrapped.address
}

// ABI parameter definition type for ox
type AbiParameter = {
  type: string
  name?: string
  components?: AbiParameter[]
}

// Pool key components for tuple encoding
const POOL_KEY_COMPONENTS: AbiParameter[] = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
]

// Path key components for tuple encoding
const PATH_KEY_COMPONENTS: AbiParameter[] = [
  { name: 'intermediateCurrency', type: 'address' },
  { name: 'fee', type: 'uint256' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
  { name: 'hookData', type: 'bytes' },
]

// Convert a ParamType to ox AbiParameter format
function toAbiParameter(param: ParamType): AbiParameter {
  // Handle pool key struct
  if (param.type === POOL_KEY_STRUCT) {
    return { name: param.name, type: 'tuple', components: POOL_KEY_COMPONENTS }
  }

  // Handle swap structs (exact in single)
  if (param.type === SWAP_EXACT_IN_SINGLE_STRUCT) {
    return {
      name: param.name,
      type: 'tuple',
      components: [
        { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountIn', type: 'uint128' },
        { name: 'amountOutMinimum', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }
  }

  // Handle swap structs (exact in)
  if (param.type === SWAP_EXACT_IN_STRUCT) {
    return {
      name: param.name,
      type: 'tuple',
      components: [
        { name: 'currencyIn', type: 'address' },
        { name: 'path', type: 'tuple[]', components: PATH_KEY_COMPONENTS },
        { name: 'amountIn', type: 'uint128' },
        { name: 'amountOutMinimum', type: 'uint128' },
      ],
    }
  }

  // Handle swap structs (exact out single)
  if (param.type === SWAP_EXACT_OUT_SINGLE_STRUCT) {
    return {
      name: param.name,
      type: 'tuple',
      components: [
        { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'amountOut', type: 'uint128' },
        { name: 'amountInMaximum', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }
  }

  // Handle swap structs (exact out)
  if (param.type === SWAP_EXACT_OUT_STRUCT) {
    return {
      name: param.name,
      type: 'tuple',
      components: [
        { name: 'currencyOut', type: 'address' },
        { name: 'path', type: 'tuple[]', components: PATH_KEY_COMPONENTS },
        { name: 'amountOut', type: 'uint128' },
        { name: 'amountInMaximum', type: 'uint128' },
      ],
    }
  }

  // Simple types pass through
  return { name: param.name, type: param.type }
}

function createAction(action: Actions, parameters: unknown[]): RouterAction {
  const abiDef = V4_BASE_ACTIONS_ABI_DEFINITION[action]

  // Convert to ox-compatible ABI parameters
  const abiParams = abiDef.map(toAbiParameter)

  // Use ox AbiParameters.encode
  const encodedInput = AbiParameters.encode(abiParams, parameters)

  return { action, encodedInput }
}

/**
 * V4Planner builds encoded calldata for V4 Router operations.
 * It maintains a list of actions and their encoded parameters.
 */
export class V4Planner {
  actions: string
  params: string[]

  constructor() {
    this.actions = EMPTY_BYTES
    this.params = []
  }

  /**
   * Add an action to the planner
   * @param type The action type
   * @param parameters The parameters for the action
   * @returns This planner for chaining
   */
  addAction(type: Actions, parameters: unknown[]): V4Planner {
    const command = createAction(type, parameters)
    this.params.push(command.encodedInput)
    this.actions = this.actions.concat(command.action.toString(16).padStart(2, '0'))
    return this
  }

  /**
   * Add a trade to the planner
   * @param trade The trade to add
   * @param slippageTolerance Optional slippage tolerance (required for exact output)
   * @returns This planner for chaining
   */
  addTrade(trade: Trade<Currency, Currency, TradeType>, slippageTolerance?: Percent): V4Planner {
    const exactOutput = trade.tradeType === TradeType.EXACT_OUTPUT

    // exactInput we sometimes perform aggregated slippage checks, but not with exactOutput
    if (exactOutput) invariant(!!slippageTolerance, 'ExactOut requires slippageTolerance')
    invariant(trade.swaps.length === 1, 'Only accepts Trades with 1 swap (must break swaps into individual trades)')

    const actionType = exactOutput ? Actions.SWAP_EXACT_OUT : Actions.SWAP_EXACT_IN

    const currencyIn = currencyAddress(trade.route.pathInput)
    const currencyOut = currencyAddress(trade.route.pathOutput)

    this.addAction(actionType, [
      exactOutput
        ? {
            currencyOut,
            path: encodeRouteToPath(trade.route, exactOutput),
            amountInMaximum: trade.maximumAmountIn(slippageTolerance!).quotient.toString(),
            amountOut: trade.outputAmount.quotient.toString(),
          }
        : {
            currencyIn,
            path: encodeRouteToPath(trade.route, exactOutput),
            amountIn: trade.inputAmount.quotient.toString(),
            amountOutMinimum: slippageTolerance ? trade.minimumAmountOut(slippageTolerance).quotient.toString() : 0,
          },
    ])
    return this
  }

  /**
   * Add a settle action
   * @param currency The currency to settle
   * @param payerIsUser Whether the user is the payer
   * @param amount Optional specific amount (defaults to full delta)
   * @returns This planner for chaining
   */
  addSettle(currency: Currency, payerIsUser: boolean, amount?: bigint): V4Planner {
    this.addAction(Actions.SETTLE, [currencyAddress(currency), amount ?? FULL_DELTA_AMOUNT, payerIsUser])
    return this
  }

  /**
   * Add a take action
   * @param currency The currency to take
   * @param recipient The recipient address
   * @param amount Optional specific amount (defaults to full delta)
   * @returns This planner for chaining
   */
  addTake(currency: Currency, recipient: string, amount?: bigint): V4Planner {
    const takeAmount = amount ?? FULL_DELTA_AMOUNT
    this.addAction(Actions.TAKE, [currencyAddress(currency), recipient, takeAmount])
    return this
  }

  /**
   * Add an unwrap action to convert WETH to ETH
   * @param amount The amount to unwrap
   * @returns This planner for chaining
   */
  addUnwrap(amount: bigint): V4Planner {
    this.addAction(Actions.UNWRAP, [amount])
    return this
  }

  /**
   * Finalize the planner and return the encoded calldata
   * @returns The encoded bytes for modifyLiquidities
   */
  finalize(): string {
    return AbiParameters.encode(
      [{ type: 'bytes' }, { type: 'bytes[]' }],
      [this.actions as `0x${string}`, this.params as `0x${string}`[]]
    )
  }
}
