import {
  type BigintIsh,
  type Currency,
  CurrencyAmount,
  type Percent,
  type Token,
  validateAndParseAddress,
} from '@uniswap/sdk-core-next'
import INonfungiblePositionManager from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'
import invariant from 'tiny-invariant'
import { ADDRESS_ZERO } from './constants'
import { type Pool, Position } from './entities'
import { ZERO } from './internalConstants'
import { encodeMulticall } from './multicall'
import { encodeRefundETH, encodeSweepToken, encodeUnwrapWETH9 } from './payments'
import { type PermitOptions, encodeSelfPermit } from './selfPermit'
import { type MethodParameters, toHex } from './utils'

const nftManagerAbi = INonfungiblePositionManager.abi as readonly {
  inputs: readonly {
    internalType: string
    name: string
    type: string
    components?: readonly { internalType: string; name: string; type: string }[]
  }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Extract function ABIs
const createAndInitializePoolIfNecessaryAbi = nftManagerAbi.find(
  (item) => item.name === 'createAndInitializePoolIfNecessary'
)!
const mintAbi = nftManagerAbi.find((item) => item.name === 'mint')!
const increaseLiquidityAbi = nftManagerAbi.find((item) => item.name === 'increaseLiquidity')!
const decreaseLiquidityAbi = nftManagerAbi.find((item) => item.name === 'decreaseLiquidity')!
const collectAbi = nftManagerAbi.find((item) => item.name === 'collect')!
const burnAbi = nftManagerAbi.find((item) => item.name === 'burn')!
const safeTransferFromAbi = nftManagerAbi.find((item) => item.name === 'safeTransferFrom' && item.inputs?.length === 4)!

/**
 * Options for the common mint parameters.
 */
interface CommonMintOptions {
  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: bigint

  /**
   * Whether to spend ether. If true, one of the pool tokens must be WETH, by default false.
   */
  useNative?: Currency

  /**
   * The optional permit parameters for spending token0.
   */
  token0Permit?: PermitOptions

  /**
   * The optional permit parameters for spending token1.
   */
  token1Permit?: PermitOptions
}

/**
 * Options for minting a new position.
 */
export interface MintOptions extends CommonMintOptions {
  /**
   * The account that should receive the minted NFT.
   */
  recipient: string

  /**
   * Creates pool if not initialized before mint.
   */
  createPool?: boolean
}

/**
 * Options for increasing liquidity in an existing position.
 */
export interface IncreaseOptions extends CommonMintOptions {
  /**
   * Indicates the ID of the position to increase liquidity for.
   */
  tokenId: BigintIsh
}

/**
 * Options for producing the arguments to send calls to the periphery NonfungiblePositionManager.
 */
export type AddLiquidityOptions = MintOptions | IncreaseOptions

function isMint(options: AddLiquidityOptions): options is MintOptions {
  return Object.keys(options).includes('recipient')
}

/**
 * Options for removing liquidity from a position.
 */
export interface RemoveLiquidityOptions {
  /**
   * The ID of the token to exit.
   */
  tokenId: BigintIsh

  /**
   * The percentage of position liquidity to exit.
   */
  liquidityPercentage: Percent

  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: bigint

  /**
   * Whether the NFT should be burned if the entire position is being exited, by default false.
   */
  burnToken?: boolean

  /**
   * The optional permit of the token ID being exited, in case the exit transaction is being sent by an account that does not own the NFT.
   */
  permit?: {
    v: 0 | 1 | 27 | 28
    r: `0x${string}`
    s: `0x${string}`
    deadline: bigint
    spender: string
  }

  /**
   * Parameters to be passed on to collect.
   */
  collectOptions: CollectOptions
}

/**
 * Options for collecting fees from a position.
 */
export interface CollectOptions {
  /**
   * The ID of the token to collect.
   */
  tokenId: BigintIsh

  /**
   * Expected value of token0 fees to collect.
   */
  expectedCurrencyOwed0: CurrencyAmount<Currency>

  /**
   * Expected value of token1 fees to collect.
   */
  expectedCurrencyOwed1: CurrencyAmount<Currency>

  /**
   * The account that should receive the tokens.
   */
  recipient: string
}

/**
 * Options for safe transfers.
 */
export interface SafeTransferOptions {
  /**
   * The account sending the NFT.
   */
  sender: string

  /**
   * The account that should receive the NFT.
   */
  recipient: string

  /**
   * The id of the token being sent.
   */
  tokenId: BigintIsh

  /**
   * The optional parameter that passes data to the `onERC721Received` call for the staker.
   */
  data?: Hex.Hex
}

/**
 * Produces the calldata for creating a pool.
 */
export function createCallParameters(pool: Pool): MethodParameters {
  const calldata = AbiFunction.encodeData(
    createAndInitializePoolIfNecessaryAbi as Parameters<typeof AbiFunction.encodeData>[0],
    [pool.token0.address as Address.Address, pool.token1.address as Address.Address, pool.fee, pool.sqrtRatioX96]
  ) as Hex.Hex

  return {
    calldata: encodeMulticall([calldata]),
    value: toHex(0),
  }
}

/**
 * Produces the calldata for adding liquidity to a position.
 */
export function addCallParameters(position: Position, options: AddLiquidityOptions): MethodParameters {
  invariant(position.liquidity > ZERO, 'ZERO_LIQUIDITY')

  const calldatas: Hex.Hex[] = []

  // Get the amounts for minting
  const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

  // Compute the slippage-adjusted amounts
  const minimumAmounts = position.mintAmountsWithSlippage(options.slippageTolerance)
  const amount0Min = minimumAmounts.amount0
  const amount1Min = minimumAmounts.amount1

  const deadline = options.deadline

  // Check if we're using native currency
  const zeroIsNative = options.useNative?.equals(position.pool.token0)
  const oneIsNative = options.useNative?.equals(position.pool.token1)

  // Add permits if provided
  if (options.token0Permit && !zeroIsNative) {
    calldatas.push(encodeSelfPermit(position.pool.token0, '', options.token0Permit))
  }
  if (options.token1Permit && !oneIsNative) {
    calldatas.push(encodeSelfPermit(position.pool.token1, '', options.token1Permit))
  }

  // Create pool first if minting to a new pool
  if (isMint(options) && options.createPool) {
    calldatas.push(
      AbiFunction.encodeData(createAndInitializePoolIfNecessaryAbi as Parameters<typeof AbiFunction.encodeData>[0], [
        position.pool.token0.address as Address.Address,
        position.pool.token1.address as Address.Address,
        position.pool.fee,
        position.pool.sqrtRatioX96,
      ]) as Hex.Hex
    )
  }

  // Encode mint or increase
  if (isMint(options)) {
    const recipient = validateAndParseAddress(options.recipient)
    const params = {
      token0: position.pool.token0.address as Address.Address,
      token1: position.pool.token1.address as Address.Address,
      fee: position.pool.fee,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      recipient: recipient as Address.Address,
      deadline,
    }
    calldatas.push(AbiFunction.encodeData(mintAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex)
  } else {
    // Increase liquidity
    const params = {
      tokenId: BigInt(options.tokenId),
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      deadline,
    }
    calldatas.push(
      AbiFunction.encodeData(increaseLiquidityAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex
    )
  }

  // Add refund ETH if using native currency
  let value = 0n
  if (zeroIsNative) {
    value = amount0Desired
    calldatas.push(encodeRefundETH())
  } else if (oneIsNative) {
    value = amount1Desired
    calldatas.push(encodeRefundETH())
  }

  return {
    calldata: encodeMulticall(calldatas),
    value: toHex(value),
  }
}

/**
 * Encodes the calldata for collecting fees from a position.
 */
function encodeCollect(options: CollectOptions): Hex.Hex[] {
  const calldatas: Hex.Hex[] = []

  const recipient = validateAndParseAddress(options.recipient)

  const involvesETH = options.expectedCurrencyOwed0.currency.isNative || options.expectedCurrencyOwed1.currency.isNative

  const params = {
    tokenId: BigInt(options.tokenId),
    recipient: involvesETH ? ADDRESS_ZERO : (recipient as Address.Address),
    amount0Max: 2n ** 128n - 1n, // uint128 max
    amount1Max: 2n ** 128n - 1n, // uint128 max
  }
  calldatas.push(
    AbiFunction.encodeData(collectAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex
  )

  if (involvesETH) {
    const ethAmount = options.expectedCurrencyOwed0.currency.isNative
      ? options.expectedCurrencyOwed0.quotient
      : options.expectedCurrencyOwed1.quotient
    const token = options.expectedCurrencyOwed0.currency.isNative
      ? (options.expectedCurrencyOwed1.currency as Token)
      : (options.expectedCurrencyOwed0.currency as Token)
    const tokenAmount = options.expectedCurrencyOwed0.currency.isNative
      ? options.expectedCurrencyOwed1.quotient
      : options.expectedCurrencyOwed0.quotient

    calldatas.push(encodeUnwrapWETH9({ amountMinimum: ethAmount, recipient }))
    calldatas.push(encodeSweepToken({ token, amountMinimum: tokenAmount, recipient }))
  }

  return calldatas
}

/**
 * Produces the calldata for collecting fees from a position.
 */
export function collectCallParameters(options: CollectOptions): MethodParameters {
  const calldatas = encodeCollect(options)

  return {
    calldata: encodeMulticall(calldatas),
    value: toHex(0),
  }
}

/**
 * Produces the calldata for removing liquidity from a position.
 */
export function removeCallParameters(position: Position, options: RemoveLiquidityOptions): MethodParameters {
  const calldatas: Hex.Hex[] = []

  const deadline = options.deadline
  const tokenId = options.tokenId

  // Calculate amounts with slippage
  const burnAmounts = position.burnAmountsWithSlippage(options.slippageTolerance)

  // Calculate liquidity to remove
  const partialPosition = new Position({
    pool: position.pool,
    liquidity: (position.liquidity * options.liquidityPercentage.numerator) / options.liquidityPercentage.denominator,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
  })

  invariant(partialPosition.liquidity > ZERO, 'ZERO_LIQUIDITY')

  // Add permit if provided
  // Note: Permit for NFT is usually handled differently - this is a simplification

  // Decrease liquidity
  const params = {
    tokenId: BigInt(tokenId),
    liquidity: partialPosition.liquidity,
    amount0Min: burnAmounts.amount0,
    amount1Min: burnAmounts.amount1,
    deadline,
  }
  calldatas.push(
    AbiFunction.encodeData(decreaseLiquidityAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex
  )

  // Collect the tokens
  const { expectedCurrencyOwed0, expectedCurrencyOwed1, recipient: collectRecipient } = options.collectOptions
  calldatas.push(
    ...encodeCollect({
      tokenId,
      expectedCurrencyOwed0: expectedCurrencyOwed0.add(
        CurrencyAmount.fromRawAmount(expectedCurrencyOwed0.currency, partialPosition.amount0.quotient)
      ),
      expectedCurrencyOwed1: expectedCurrencyOwed1.add(
        CurrencyAmount.fromRawAmount(expectedCurrencyOwed1.currency, partialPosition.amount1.quotient)
      ),
      recipient: collectRecipient,
    })
  )

  // Burn the NFT if requested and we're removing all liquidity
  if (options.burnToken) {
    calldatas.push(
      AbiFunction.encodeData(burnAbi as Parameters<typeof AbiFunction.encodeData>[0], [BigInt(tokenId)]) as Hex.Hex
    )
  }

  return {
    calldata: encodeMulticall(calldatas),
    value: toHex(0),
  }
}

/**
 * Produces the calldata for a safe transfer.
 */
export function safeTransferFromParameters(options: SafeTransferOptions): MethodParameters {
  const sender = validateAndParseAddress(options.sender)
  const recipient = validateAndParseAddress(options.recipient)

  const calldata = AbiFunction.encodeData(safeTransferFromAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    sender as Address.Address,
    recipient as Address.Address,
    BigInt(options.tokenId),
    options.data ?? '0x',
  ]) as Hex.Hex

  return {
    calldata,
    value: toHex(0),
  }
}
