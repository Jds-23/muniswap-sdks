import { AbiFunction, AbiParameters } from 'ox'

const MULTICALL_ABI = {
  name: 'multicall',
  type: 'function',
  inputs: [{ name: 'data', type: 'bytes[]' }],
  outputs: [{ name: 'results', type: 'bytes[]' }],
  stateMutability: 'payable',
} as const

/**
 * Multicall utility for batching multiple contract calls into a single transaction
 */
export abstract class Multicall {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  /**
   * Encodes a list of calldatas into a single multicall calldata
   * @param calldataList The calldata(s) to encode
   * @returns The encoded multicall calldata, or the single calldata if only one is provided
   */
  public static encodeMulticall(calldataList: string | string[]): string {
    const list = Array.isArray(calldataList) ? calldataList : [calldataList]

    return list.length === 1 ? list[0]! : AbiFunction.encodeData(MULTICALL_ABI, [list as `0x${string}`[]])
  }

  /**
   * Decodes a multicall calldata into its component calldatas
   * @param encodedCalldata The encoded multicall calldata
   * @returns The decoded array of calldatas
   */
  public static decodeMulticall(encodedCalldata: string): string[] {
    const decoded = AbiParameters.decode(
      [{ type: 'bytes[]' }],
      `0x${encodedCalldata.slice(10)}` as `0x${string}` // Remove function selector
    )
    return decoded[0] as string[]
  }
}
