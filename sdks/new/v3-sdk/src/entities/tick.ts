import type { BigintIsh } from '@uniswap/sdk-core-next'
import invariant from 'tiny-invariant'
import { MAX_TICK, MIN_TICK } from '../utils/tickMath'

export interface TickConstructorArgs {
  index: number
  liquidityGross: BigintIsh
  liquidityNet: BigintIsh
}

/**
 * Represents a tick in a V3 pool.
 */
export class Tick {
  public readonly index: number
  public readonly liquidityGross: bigint
  public readonly liquidityNet: bigint

  constructor({ index, liquidityGross, liquidityNet }: TickConstructorArgs) {
    invariant(index >= MIN_TICK && index <= MAX_TICK, 'TICK')
    this.index = index
    this.liquidityGross = BigInt(liquidityGross)
    this.liquidityNet = BigInt(liquidityNet)
  }
}
