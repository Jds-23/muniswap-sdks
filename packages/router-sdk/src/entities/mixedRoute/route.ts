import invariant from 'tiny-invariant'
import { type Currency, Price, type Token } from '@muniswap/sdk-core'
import { Pool as V4Pool } from '@muniswap/v4-sdk'
import { getPathCurrency } from '../../utils/pathCurrency'
import type { TPool } from '../../utils/TPool'

/**
 * Represents a list of pools or pairs through which a swap can occur
 * @template TInput The input token
 * @template TOutput The output token
 */
export class MixedRouteSDK<TInput extends Currency, TOutput extends Currency> {
  public readonly pools: TPool[]
  public readonly path: Currency[]
  public readonly input: TInput
  public readonly output: TOutput
  public readonly pathInput: Currency // routes may need to wrap/unwrap a currency to begin trading path
  public readonly pathOutput: Currency // routes may need to wrap/unwrap a currency at the end of trading path

  private _midPrice: Price<TInput, TOutput> | null = null

  /**
   * Creates an instance of route.
   * @param pools An array of `TPool` objects (pools or pairs), ordered by the route the swap will take
   * @param input The input token
   * @param output The output token
   * @param retainsFakePool Set to true to filter out a pool that has a fake eth-weth pool
   */
  public constructor(pools: TPool[], input: TInput, output: TOutput, retainFakePools = false) {
    pools = retainFakePools ? pools : pools.filter((pool) => !(pool instanceof V4Pool && pool.tickSpacing === 0))
    invariant(pools.length > 0, 'POOLS')

    const chainId = pools[0]!.chainId
    const allOnSameChain = pools.every((pool) => pool.chainId === chainId)
    invariant(allOnSameChain, 'CHAIN_IDS')

    this.pathInput = getPathCurrency(input, pools[0]!)
    this.pathOutput = getPathCurrency(output, pools[pools.length - 1]!)

    if (!(pools[0] instanceof V4Pool)) {
      invariant(pools[0]!.involvesToken(this.pathInput as Token), 'INPUT')
    } else {
      invariant((pools[0] as V4Pool).v4InvolvesToken(this.pathInput), 'INPUT')
    }
    const lastPool = pools[pools.length - 1]!
    if (lastPool instanceof V4Pool) {
      invariant(lastPool.v4InvolvesToken(output) || lastPool.v4InvolvesToken(output.wrapped), 'OUTPUT')
    } else {
      invariant(lastPool.involvesToken(output.wrapped as Token), 'OUTPUT')
    }

    /**
     * Normalizes token0-token1 order and selects the next token/fee step to add to the path
     * */
    const tokenPath: Currency[] = [this.pathInput]
    pools[0]!.token0.equals(this.pathInput) ? tokenPath.push(pools[0]!.token1) : tokenPath.push(pools[0]!.token0)

    for (let i = 1; i < pools.length; i++) {
      const pool = pools[i]!
      const inputToken = tokenPath[i]!

      let outputToken
      if (
        (pool instanceof V4Pool && !pool.involvesToken(inputToken)) ||
        (!(pool instanceof V4Pool) && inputToken.isNative)
      ) {
        if (inputToken.equals(pool.token0.wrapped)) {
          outputToken = pool.token1
        } else if (inputToken.wrapped.equals(pool.token0) || inputToken.wrapped.equals(pool.token1)) {
          outputToken = inputToken.wrapped.equals(pool.token0) ? pool.token1 : pool.token0
        } else {
          throw new Error(`POOL_MISMATCH pool: ${JSON.stringify(pool, (_, v) => (typeof v === 'bigint' ? v.toString() : v))} inputToken: ${JSON.stringify(inputToken, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`)
        }
      } else {
        invariant(
          inputToken.equals(pool.token0) || inputToken.equals(pool.token1),
          `PATH pool ${JSON.stringify(pool, (_, v) => (typeof v === 'bigint' ? v.toString() : v))} inputToken ${JSON.stringify(inputToken, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`
        )
        outputToken = inputToken.equals(pool.token0) ? pool.token1 : pool.token0
      }
      tokenPath.push(outputToken)
    }

    this.pools = pools
    this.path = tokenPath
    this.input = input
    this.output = output ?? tokenPath[tokenPath.length - 1]
  }

  public get chainId(): number {
    return this.pools[0]!.chainId
  }

  /**
   * Returns the mid price of the route
   */
  public get midPrice(): Price<TInput, TOutput> {
    if (this._midPrice !== null) return this._midPrice

    const price = this.pools.slice(1).reduce(
      ({ nextInput, price }, pool) => {
        return nextInput.equals(pool.token0)
          ? {
              nextInput: pool.token1,
              price: price.multiply(pool.token0Price.asFraction),
            }
          : {
              nextInput: pool.token0,
              price: price.multiply(pool.token1Price.asFraction),
            }
      },

      this.pools[0]!.token0.equals(this.pathInput)
        ? {
            nextInput: this.pools[0]!.token1,
            price: this.pools[0]!.token0Price.asFraction,
          }
        : {
            nextInput: this.pools[0]!.token0,
            price: this.pools[0]!.token1Price.asFraction,
          }
    ).price

    return (this._midPrice = new Price(this.input, this.output, price.denominator, price.numerator))
  }
}
