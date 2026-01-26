import invariant from 'tiny-invariant'
import type { Currency } from './currency'
import { NativeCurrency } from './nativeCurrency'
import type { Token } from './token'
import { WETH9 } from './weth9'

/**
 * Ether is the main usage of a 'native' currency, i.e. for Ethereum mainnet and all testnets
 */
export class Ether extends NativeCurrency {
  protected constructor(chainId: number) {
    super(chainId, 18, 'ETH', 'Ether')
  }

  public get wrapped(): Token {
    const weth9 = WETH9[this.chainId]
    invariant(!!weth9, 'WRAPPED')
    return weth9
  }

  private static _etherCache: { [chainId: number]: Ether } = {}

  public static onChain(chainId: number): Ether {
    const cached = Ether._etherCache[chainId]
    if (cached) {
      return cached
    }
    const ether = new Ether(chainId)
    Ether._etherCache[chainId] = ether
    return ether
  }

  public equals(other: Currency): boolean {
    return other.isNative && other.chainId === this.chainId
  }
}
