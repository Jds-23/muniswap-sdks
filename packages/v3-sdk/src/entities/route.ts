import { type Currency, Price, type Token } from '@muniswap/sdk-core'
import invariant from 'tiny-invariant'
import type { Pool } from './pool'

/**
 * Represents a route through V3 pools for a swap.
 */
export class Route<TInput extends Currency, TOutput extends Currency> {
  public readonly pools: Pool[]
  public readonly tokenPath: Token[]
  public readonly input: TInput
  public readonly output: TOutput

  private _midPrice: Price<TInput, TOutput> | null = null

  /**
   * Creates an instance of route.
   *
   * @param pools - An array of Pool objects (interconnected)
   * @param input - The input currency
   * @param output - The output currency
   */
  public constructor(pools: Pool[], input: TInput, output: TOutput) {
    invariant(pools.length > 0, 'POOLS')

    const chainId = pools[0]!.chainId
    const allOnSameChain = pools.every((pool) => pool.chainId === chainId)
    invariant(allOnSameChain, 'CHAIN_IDS')

    const wrappedInput = input.wrapped
    invariant(pools[0]!.involvesToken(wrappedInput), 'INPUT')

    const wrappedOutput = output.wrapped
    invariant(pools[pools.length - 1]!.involvesToken(wrappedOutput), 'OUTPUT')

    // Build the token path
    const tokenPath: Token[] = [wrappedInput]
    for (let i = 0; i < pools.length; i++) {
      const currentInput = tokenPath[i]!
      invariant(currentInput.equals(pools[i]!.token0) || currentInput.equals(pools[i]!.token1), 'PATH')
      const output = currentInput.equals(pools[i]!.token0) ? pools[i]!.token1 : pools[i]!.token0
      tokenPath.push(output)
    }
    invariant(tokenPath[tokenPath.length - 1]!.equals(wrappedOutput), 'PATH')

    this.pools = pools
    this.tokenPath = tokenPath
    this.input = input
    this.output = output
  }

  /**
   * Returns the chain ID of the route.
   */
  public get chainId(): number {
    return this.pools[0]!.chainId
  }

  /**
   * Returns the mid price of the route.
   */
  public get midPrice(): Price<TInput, TOutput> {
    if (this._midPrice !== null) return this._midPrice

    const price = this.pools.slice(1).reduce(
      ({ nextInput, price }, pool) => {
        return nextInput.equals(pool.token0)
          ? {
              nextInput: pool.token1,
              price: price.multiply(pool.token0Price),
            }
          : {
              nextInput: pool.token0,
              price: price.multiply(pool.token1Price),
            }
      },
      this.pools[0]!.token0.equals(this.input.wrapped)
        ? {
            nextInput: this.pools[0]!.token1,
            price: this.pools[0]!.token0Price,
          }
        : {
            nextInput: this.pools[0]!.token0,
            price: this.pools[0]!.token1Price,
          }
    ).price

    this._midPrice = new Price(this.input, this.output, price.denominator, price.numerator)
    return this._midPrice
  }
}
