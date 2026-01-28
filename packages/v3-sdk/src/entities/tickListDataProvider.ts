import type { BigintIsh } from '@muniswap/sdk-core'
import { getTick, nextInitializedTickWithinOneWord, validateTickList } from '../utils/tickList'
import { Tick, type TickConstructorArgs } from './tick'
import type { TickDataProvider } from './tickDataProvider'

/**
 * A data provider for ticks that is backed by an in-memory array of ticks.
 */
export class TickListDataProvider implements TickDataProvider {
  private ticks: readonly Tick[]

  constructor(ticks: (Tick | TickConstructorArgs)[], tickSpacing: number) {
    const ticksMapped: Tick[] = ticks.map((t) => (t instanceof Tick ? t : new Tick(t)))
    validateTickList(ticksMapped, tickSpacing)
    this.ticks = ticksMapped
  }

  async getTick(tick: number): Promise<{ liquidityNet: BigintIsh; liquidityGross: BigintIsh }> {
    const tickData = getTick(this.ticks, tick)
    return {
      liquidityNet: tickData.liquidityNet,
      liquidityGross: tickData.liquidityGross,
    }
  }

  async nextInitializedTickWithinOneWord(tick: number, lte: boolean, tickSpacing: number): Promise<[number, boolean]> {
    return nextInitializedTickWithinOneWord(this.ticks, tick, lte, tickSpacing)
  }
}
