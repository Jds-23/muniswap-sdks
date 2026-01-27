import type { Token } from '@uniswap/sdk-core-next'
import { AbiParameters, Address, ContractAddress, Hash } from 'ox'
import { FACTORY_ADDRESS, type FeeAmount, poolInitCodeHash } from '../constants'

/**
 * Computes the address of a Uniswap V3 pool given the factory, tokens, and fee.
 * Uses CREATE2 address derivation.
 *
 * @param factoryAddress - The V3 factory address
 * @param tokenA - The first token of the pair, irrespective of sort order
 * @param tokenB - The second token of the pair, irrespective of sort order
 * @param fee - The fee tier of the pool
 * @param initCodeHashManualOverride - Override the init code hash used to compute the pool address if necessary
 * @returns The computed pool address
 */
export function computePoolAddress({
  factoryAddress = FACTORY_ADDRESS,
  tokenA,
  tokenB,
  fee,
  initCodeHashManualOverride,
}: {
  factoryAddress?: Address.Address
  tokenA: Token
  tokenB: Token
  fee: FeeAmount
  initCodeHashManualOverride?: `0x${string}`
}): Address.Address {
  // Sort tokens to get deterministic address
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

  // Encode the salt as packed (token0, token1, fee)
  const salt = Hash.keccak256(
    AbiParameters.encodePacked(
      ['address', 'address', 'uint24'],
      [token0.address as Address.Address, token1.address as Address.Address, fee]
    )
  )

  // Get the init code hash (chain-specific)
  const initCodeHash = initCodeHashManualOverride ?? poolInitCodeHash(tokenA.chainId)

  // Compute CREATE2 address
  const address = ContractAddress.fromCreate2({
    from: factoryAddress,
    salt,
    bytecodeHash: initCodeHash,
  })

  return Address.checksum(address) as Address.Address
}
