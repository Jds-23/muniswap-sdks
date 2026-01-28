import type { BigintIsh, Currency } from '@muniswap/sdk-core'
import { Pool } from '../entities/pool'
import { EMPTY_BYTES } from '../internalConstants'
import { toAddress } from './currencyMap'
import { Actions, V4Planner } from './v4Planner'

/**
 * V4PositionPlanner extends V4Planner with convenience methods for position management actions.
 * It simplifies the creation of mint, increase, decrease, burn, settle, and take operations.
 */
export class V4PositionPlanner extends V4Planner {
  /**
   * Add a MINT_POSITION action to create a new position
   * @param pool The pool to mint in
   * @param tickLower The lower tick bound
   * @param tickUpper The upper tick bound
   * @param liquidity The amount of liquidity to mint
   * @param amount0Max Maximum amount of currency0 to spend
   * @param amount1Max Maximum amount of currency1 to spend
   * @param owner The owner of the minted position NFT
   * @param hookData Optional data to pass to hooks
   */
  addMint(
    pool: Pool,
    tickLower: number,
    tickUpper: number,
    liquidity: BigintIsh,
    amount0Max: BigintIsh,
    amount1Max: BigintIsh,
    owner: string,
    hookData: string = EMPTY_BYTES
  ): void {
    const inputs = [
      Pool.getPoolKey(pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks),
      tickLower,
      tickUpper,
      liquidity.toString(),
      amount0Max.toString(),
      amount1Max.toString(),
      owner,
      hookData,
    ]
    this.addAction(Actions.MINT_POSITION, inputs)
  }

  /**
   * Add an INCREASE_LIQUIDITY action to add liquidity to an existing position
   * @param tokenId The position NFT token ID
   * @param liquidity The amount of liquidity to add
   * @param amount0Max Maximum amount of currency0 to spend
   * @param amount1Max Maximum amount of currency1 to spend
   * @param hookData Optional data to pass to hooks
   */
  addIncrease(
    tokenId: BigintIsh,
    liquidity: BigintIsh,
    amount0Max: BigintIsh,
    amount1Max: BigintIsh,
    hookData: string = EMPTY_BYTES
  ): void {
    const inputs = [tokenId.toString(), liquidity.toString(), amount0Max.toString(), amount1Max.toString(), hookData]
    this.addAction(Actions.INCREASE_LIQUIDITY, inputs)
  }

  /**
   * Add a DECREASE_LIQUIDITY action to remove liquidity from an existing position
   * @param tokenId The position NFT token ID
   * @param liquidity The amount of liquidity to remove
   * @param amount0Min Minimum amount of currency0 to receive
   * @param amount1Min Minimum amount of currency1 to receive
   * @param hookData Optional data to pass to hooks
   */
  addDecrease(
    tokenId: BigintIsh,
    liquidity: BigintIsh,
    amount0Min: BigintIsh,
    amount1Min: BigintIsh,
    hookData: string = EMPTY_BYTES
  ): void {
    const inputs = [tokenId.toString(), liquidity.toString(), amount0Min.toString(), amount1Min.toString(), hookData]
    this.addAction(Actions.DECREASE_LIQUIDITY, inputs)
  }

  /**
   * Add a BURN_POSITION action to burn a position NFT
   * @param tokenId The position NFT token ID to burn
   * @param amount0Min Minimum amount of currency0 to receive
   * @param amount1Min Minimum amount of currency1 to receive
   * @param hookData Optional data to pass to hooks
   */
  addBurn(tokenId: BigintIsh, amount0Min: BigintIsh, amount1Min: BigintIsh, hookData: string = EMPTY_BYTES): void {
    const inputs = [tokenId.toString(), amount0Min.toString(), amount1Min.toString(), hookData]
    this.addAction(Actions.BURN_POSITION, inputs)
  }

  /**
   * Add a SETTLE_PAIR action to settle both currencies of a pool
   * @param currency0 The first currency
   * @param currency1 The second currency
   */
  addSettlePair(currency0: Currency, currency1: Currency): void {
    const inputs = [toAddress(currency0), toAddress(currency1)]
    this.addAction(Actions.SETTLE_PAIR, inputs)
  }

  /**
   * Add a TAKE_PAIR action to take both currencies to a recipient
   * @param currency0 The first currency
   * @param currency1 The second currency
   * @param recipient The recipient address
   */
  addTakePair(currency0: Currency, currency1: Currency, recipient: string): void {
    const inputs = [toAddress(currency0), toAddress(currency1), recipient]
    this.addAction(Actions.TAKE_PAIR, inputs)
  }

  /**
   * Add a SWEEP action to sweep remaining balance of a currency
   * @param currency The currency to sweep
   * @param to The recipient address
   */
  addSweep(currency: Currency, to: string): void {
    const inputs = [toAddress(currency), to]
    this.addAction(Actions.SWEEP, inputs)
  }
}
