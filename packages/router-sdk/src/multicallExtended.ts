import type { BigintIsh } from '@muniswap/sdk-core'
import { encodeMulticall, toHex } from '@muniswap/v3-sdk'
import IMulticallExtended from '@uniswap/swap-router-contracts/artifacts/contracts/interfaces/IMulticallExtended.sol/IMulticallExtended.json' with {
  type: 'json',
}
import { AbiFunction, type Hex } from 'ox'

const multicallExtendedAbi = IMulticallExtended.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

const multicallWithDeadlineAbi = multicallExtendedAbi.find(
  (item) => item.name === 'multicall' && item.inputs?.[0]?.type === 'uint256'
)!
const multicallWithBlockhashAbi = multicallExtendedAbi.find(
  (item) => item.name === 'multicall' && item.inputs?.[0]?.type === 'bytes32'
)!

// deadline or previousBlockhash
export type Validation = BigintIsh | string

function validateAndParseBytes32(bytes32: string): string {
  if (!bytes32.match(/^0x[0-9a-fA-F]{64}$/)) {
    throw new Error(`${bytes32} is not valid bytes32.`)
  }

  return bytes32.toLowerCase()
}

export function encodeMulticallExtended(calldatas: Hex.Hex | Hex.Hex[], validation?: Validation): Hex.Hex {
  // if there's no validation, we can just fall back to regular multicall
  if (typeof validation === 'undefined') {
    return encodeMulticall(calldatas)
  }

  // if there is validation, we have to normalize calldatas
  if (!Array.isArray(calldatas)) {
    calldatas = [calldatas]
  }

  // this means the validation value should be a previousBlockhash
  if (typeof validation === 'string' && validation.startsWith('0x')) {
    const previousBlockhash = validateAndParseBytes32(validation)
    return AbiFunction.encodeData(multicallWithBlockhashAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      previousBlockhash as `0x${string}`,
      calldatas,
    ]) as Hex.Hex
  } else {
    const deadline = toHex(validation)
    return AbiFunction.encodeData(multicallWithDeadlineAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      BigInt(deadline),
      calldatas,
    ]) as Hex.Hex
  }
}
