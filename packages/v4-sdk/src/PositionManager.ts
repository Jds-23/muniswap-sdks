import { type BigintIsh, type NativeCurrency, type Percent, validateAndParseAddress } from '@muniswap/sdk-core'
import { AbiFunction } from 'ox'
import invariant from 'tiny-invariant'
import { MSG_SENDER } from './actionConstants'
import { type PoolKey, Position } from './entities'
import {
  CANNOT_BURN,
  EMPTY_BYTES,
  NATIVE_NOT_SET,
  NO_SQRT_PRICE,
  ONE,
  OPEN_DELTA,
  PositionFunctions,
  ZERO,
  ZERO_LIQUIDITY,
} from './internalConstants'
import { Multicall } from './multicall'
import { type MethodParameters, toHex } from './utils/calldata'
import { positionManagerAbi } from './utils/positionManagerAbi'
import { V4PositionPlanner } from './utils/v4PositionPlanner'

export interface CommonOptions {
  /** How much the pool price is allowed to move from the specified action */
  slippageTolerance: Percent
  /** Optional data to pass to hooks */
  hookData?: string
  /** When the transaction expires, in epoch seconds */
  deadline: BigintIsh
}

export interface ModifyPositionSpecificOptions {
  /** The ID of the position to modify */
  tokenId: BigintIsh
}

export interface MintSpecificOptions {
  /** The account that should receive the minted NFT */
  recipient: string
  /** Creates pool if not initialized before mint */
  createPool?: boolean
  /** Initial price to set on the pool if creating */
  sqrtPriceX96?: BigintIsh
  /** Whether the mint is part of a migration from V3 to V4 */
  migrate?: boolean
}

export interface CommonAddLiquidityOptions {
  /** Whether to spend ether. If true, one of the currencies must be the NATIVE currency */
  useNative?: NativeCurrency
  /** The optional permit2 batch permit parameters for spending token0 and token1 */
  batchPermit?: BatchPermitOptions
}

export interface RemoveLiquiditySpecificOptions {
  /** The percentage of position liquidity to exit */
  liquidityPercentage: Percent
  /** Whether the NFT should be burned if the entire position is being exited */
  burnToken?: boolean
  /** The optional permit of the token ID being exited */
  permit?: NFTPermitOptions
}

export interface CollectSpecificOptions {
  /** The ID of the position to collect for */
  tokenId: BigintIsh
  /** The account that should receive the tokens */
  recipient: string
}

export interface TransferOptions {
  /** The account sending the NFT */
  sender: string
  /** The account that should receive the NFT */
  recipient: string
  /** The id of the token being sent */
  tokenId: BigintIsh
}

export interface PermitDetails {
  token: string
  amount: BigintIsh
  expiration: BigintIsh
  nonce: BigintIsh
}

export interface AllowanceTransferPermitSingle {
  details: PermitDetails
  spender: string
  sigDeadline: BigintIsh
}

export interface AllowanceTransferPermitBatch {
  details: PermitDetails[]
  spender: string
  sigDeadline: BigintIsh
}

export interface BatchPermitOptions {
  owner: string
  permitBatch: AllowanceTransferPermitBatch
  signature: string
}

const NFT_PERMIT_TYPES = {
  Permit: [
    { name: 'spender', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

export interface NFTPermitValues {
  spender: string
  tokenId: BigintIsh
  deadline: BigintIsh
  nonce: BigintIsh
}

export interface NFTPermitOptions extends NFTPermitValues {
  signature: string
}

export interface NFTPermitData {
  domain: {
    name: string
    chainId: number
    verifyingContract: string
  }
  types: typeof NFT_PERMIT_TYPES
  values: NFTPermitValues
}

export type MintOptions = CommonOptions & CommonAddLiquidityOptions & MintSpecificOptions
export type IncreaseLiquidityOptions = CommonOptions & CommonAddLiquidityOptions & ModifyPositionSpecificOptions

export type AddLiquidityOptions = MintOptions | IncreaseLiquidityOptions

export type RemoveLiquidityOptions = CommonOptions & RemoveLiquiditySpecificOptions & ModifyPositionSpecificOptions

export type CollectOptions = CommonOptions & CollectSpecificOptions

// Type guard
function isMint(options: AddLiquidityOptions): options is MintOptions {
  return Object.keys(options).some((k) => k === 'recipient')
}

function shouldCreatePool(options: MintOptions): boolean {
  if (options.createPool) {
    invariant(options.sqrtPriceX96 !== undefined, NO_SQRT_PRICE)
    return true
  }
  return false
}

// Helper to find a function in the ABI
function findAbiFunction(name: string): Parameters<typeof AbiFunction.encodeData>[0] {
  const fn = positionManagerAbi.find((item) => item.type === 'function' && item.name === name)
  if (!fn || fn.type !== 'function') {
    throw new Error(`Function ${name} not found in ABI`)
  }
  return fn as Parameters<typeof AbiFunction.encodeData>[0]
}

/**
 * V4PositionManager provides methods to encode calldata for the V4 PositionManager contract
 */
export abstract class V4PositionManager {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  /**
   * Produces calldata to initialize a new pool
   * @param poolKey The pool key
   * @param sqrtPriceX96 The initial sqrt price
   * @returns The call parameters
   */
  public static createCallParameters(poolKey: PoolKey, sqrtPriceX96: BigintIsh): MethodParameters {
    return {
      calldata: V4PositionManager.encodeInitializePool(poolKey, sqrtPriceX96),
      value: toHex(0),
    }
  }

  /**
   * Produces calldata for adding liquidity to a position
   * @param position The position to add liquidity to
   * @param options Options for the add liquidity operation
   * @returns The call parameters
   */
  public static addCallParameters(position: Position, options: AddLiquidityOptions): MethodParameters {
    invariant(position.liquidity > ZERO, ZERO_LIQUIDITY)

    const calldataList: string[] = []
    const planner = new V4PositionPlanner()

    // Encode initialize pool if creating
    if (isMint(options) && shouldCreatePool(options)) {
      calldataList.push(V4PositionManager.encodeInitializePool(position.pool.poolKey, options.sqrtPriceX96!))
    }

    // position.pool.currency0 is native if and only if options.useNative is set
    invariant(
      position.pool.currency0 === options.useNative ||
        (!position.pool.currency0.isNative && options.useNative === undefined),
      NATIVE_NOT_SET
    )

    // Adjust for slippage
    const maximumAmounts = position.mintAmountsWithSlippage(options.slippageTolerance)
    const amount0Max = toHex(maximumAmounts.amount0)
    const amount1Max = toHex(maximumAmounts.amount1)

    // Add permit2 batch permit if provided
    if (options.batchPermit) {
      calldataList.push(
        V4PositionManager.encodePermitBatch(
          options.batchPermit.owner,
          options.batchPermit.permitBatch,
          options.batchPermit.signature
        )
      )
    }

    // Mint or increase
    if (isMint(options)) {
      const recipient: string = validateAndParseAddress(options.recipient)
      planner.addMint(
        position.pool,
        position.tickLower,
        position.tickUpper,
        position.liquidity,
        amount0Max,
        amount1Max,
        recipient,
        options.hookData
      )
    } else {
      planner.addIncrease(options.tokenId, position.liquidity, amount0Max, amount1Max, options.hookData)
    }

    let value: string = toHex(0)

    // Handle migration vs normal case
    if (isMint(options) && options.migrate) {
      if (options.useNative) {
        // Unwrap the exact amount needed to send to the pool manager
        planner.addUnwrap(OPEN_DELTA)
        // Payer is v4 position manager
        planner.addSettle(position.pool.currency0, false)
        planner.addSettle(position.pool.currency1, false)
        // Sweep any leftover
        planner.addSweep(position.pool.currency0.wrapped, options.recipient)
        planner.addSweep(position.pool.currency1, options.recipient)
      } else {
        // Payer is v4 position manager
        planner.addSettle(position.pool.currency0, false)
        planner.addSettle(position.pool.currency1, false)
        planner.addSweep(position.pool.currency0, options.recipient)
        planner.addSweep(position.pool.currency1, options.recipient)
      }
    } else {
      // Need to settle both currencies when minting / adding liquidity (user is the payer)
      planner.addSettlePair(position.pool.currency0, position.pool.currency1)
      // When not migrating and adding native currency, add a final sweep
      if (options.useNative) {
        value = toHex(amount0Max)
        planner.addSweep(position.pool.currency0, MSG_SENDER)
      }
    }

    calldataList.push(V4PositionManager.encodeModifyLiquidities(planner.finalize(), options.deadline))

    return {
      calldata: Multicall.encodeMulticall(calldataList),
      value,
    }
  }

  /**
   * Produces calldata for completely or partially exiting a position
   * @param position The position to exit
   * @param options Options for the remove liquidity operation
   * @returns The call parameters
   */
  public static removeCallParameters(position: Position, options: RemoveLiquidityOptions): MethodParameters {
    const calldataList: string[] = []
    const planner = new V4PositionPlanner()

    const tokenId = toHex(options.tokenId)

    if (options.burnToken) {
      // If burnToken is true, the specified liquidity percentage must be 100%
      invariant(options.liquidityPercentage.equalTo(ONE), CANNOT_BURN)

      // If there is a permit, encode the ERC721Permit permit call
      if (options.permit) {
        calldataList.push(
          V4PositionManager.encodeERC721Permit(
            options.permit.spender,
            options.permit.tokenId,
            options.permit.deadline,
            options.permit.nonce,
            options.permit.signature
          )
        )
      }

      // Slippage-adjusted amounts derived from current position liquidity
      const { amount0: amount0Min, amount1: amount1Min } = position.burnAmountsWithSlippage(options.slippageTolerance)
      planner.addBurn(tokenId, amount0Min, amount1Min, options.hookData)
    } else {
      // Construct a partial position with a percentage of liquidity
      const partialPosition = new Position({
        pool: position.pool,
        liquidity: options.liquidityPercentage.multiply(position.liquidity).quotient,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
      })

      // If the partial position has liquidity=0, this is a collect call
      invariant(partialPosition.liquidity > ZERO, ZERO_LIQUIDITY)

      // Slippage-adjusted underlying amounts
      const { amount0: amount0Min, amount1: amount1Min } = partialPosition.burnAmountsWithSlippage(
        options.slippageTolerance
      )

      planner.addDecrease(
        tokenId,
        partialPosition.liquidity.toString(),
        amount0Min.toString(),
        amount1Min.toString(),
        options.hookData ?? EMPTY_BYTES
      )
    }

    planner.addTakePair(position.pool.currency0, position.pool.currency1, MSG_SENDER)

    calldataList.push(V4PositionManager.encodeModifyLiquidities(planner.finalize(), options.deadline))

    return {
      calldata: Multicall.encodeMulticall(calldataList),
      value: toHex(0),
    }
  }

  /**
   * Produces calldata for collecting fees from a position
   * @param position The position to collect fees from
   * @param options Options for the collect operation
   * @returns The call parameters
   */
  public static collectCallParameters(position: Position, options: CollectOptions): MethodParameters {
    const calldataList: string[] = []
    const planner = new V4PositionPlanner()

    const tokenId = toHex(options.tokenId)
    const recipient = validateAndParseAddress(options.recipient)

    // To collect fees in V4, we need to:
    // - encode a decrease liquidity by 0
    // - and encode a TAKE_PAIR
    planner.addDecrease(tokenId, '0', '0', '0', options.hookData)
    planner.addTakePair(position.pool.currency0, position.pool.currency1, recipient)

    calldataList.push(V4PositionManager.encodeModifyLiquidities(planner.finalize(), options.deadline))

    return {
      calldata: Multicall.encodeMulticall(calldataList),
      value: toHex(0),
    }
  }

  // Initialize a pool
  private static encodeInitializePool(poolKey: PoolKey, sqrtPriceX96: BigintIsh): string {
    const fn = findAbiFunction(PositionFunctions.INITIALIZE_POOL)
    return AbiFunction.encodeData(fn, [poolKey, BigInt(sqrtPriceX96.toString())])
  }

  // Encode a modify liquidities call
  public static encodeModifyLiquidities(unlockData: string, deadline: BigintIsh): string {
    const fn = findAbiFunction(PositionFunctions.MODIFY_LIQUIDITIES)
    return AbiFunction.encodeData(fn, [unlockData, BigInt(deadline.toString())])
  }

  // Encode a permit batch call
  public static encodePermitBatch(owner: string, permitBatch: AllowanceTransferPermitBatch, signature: string): string {
    // Find the permitBatch function
    const fn = positionManagerAbi.find((item) => item.type === 'function' && item.name === 'permitBatch')
    if (!fn || fn.type !== 'function') {
      throw new Error('permitBatch function not found in ABI')
    }

    return AbiFunction.encodeData(fn as Parameters<typeof AbiFunction.encodeData>[0], [owner, permitBatch, signature])
  }

  // Encode a ERC721Permit permit call
  public static encodeERC721Permit(
    spender: string,
    tokenId: BigintIsh,
    deadline: BigintIsh,
    nonce: BigintIsh,
    signature: string
  ): string {
    // Find the permit function with 5 parameters (the ERC721 one)
    const fn = positionManagerAbi.find(
      (item) => item.type === 'function' && item.name === 'permit' && item.inputs.length === 5
    )
    if (!fn || fn.type !== 'function') {
      throw new Error('permit function not found in ABI')
    }

    return AbiFunction.encodeData(fn as Parameters<typeof AbiFunction.encodeData>[0], [
      spender,
      BigInt(tokenId.toString()),
      BigInt(deadline.toString()),
      BigInt(nonce.toString()),
      signature,
    ])
  }

  // Prepare the params for an EIP712 signTypedData request
  public static getPermitData(permit: NFTPermitValues, positionManagerAddress: string, chainId: number): NFTPermitData {
    return {
      domain: {
        name: 'Uniswap V4 Positions NFT',
        chainId,
        verifyingContract: positionManagerAddress,
      },
      types: NFT_PERMIT_TYPES,
      values: permit,
    }
  }
}
