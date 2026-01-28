import IMulticall from '@uniswap/v3-periphery/artifacts/contracts/interfaces/IMulticall.sol/IMulticall.json' with {
  type: 'json',
}
import { AbiFunction, type Hex } from 'ox'

const multicallAbi = IMulticall.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Find the multicall function ABI
const multicallFunctionAbi = multicallAbi.find((item) => item.name === 'multicall' && item.type === 'function')!

/**
 * Utility for encoding multiple function calls into a single multicall.
 */
export function encodeMulticall(calldatasInput: Hex.Hex | Hex.Hex[]): Hex.Hex {
  const calldatas = Array.isArray(calldatasInput) ? calldatasInput : [calldatasInput]

  if (calldatas.length === 1) {
    return calldatas[0]!
  }

  return AbiFunction.encodeData(multicallFunctionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    calldatas,
  ]) as Hex.Hex
}
