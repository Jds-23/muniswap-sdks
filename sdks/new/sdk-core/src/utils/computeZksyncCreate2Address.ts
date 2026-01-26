import { type Hex, concat, getAddress, keccak256, pad, toBytes } from 'viem'

export function computeZksyncCreate2Address(
  sender: string,
  bytecodeHash: Hex,
  salt: Hex,
  input: Hex = '0x'
): `0x${string}` {
  const prefix = keccak256(toBytes('zksyncCreate2'))
  const inputHash = keccak256(input)
  const paddedSender = pad(sender as Hex, { size: 32 })
  const addressBytes = keccak256(concat([prefix, paddedSender, salt, bytecodeHash, inputHash])).slice(26)
  return getAddress(`0x${addressBytes}`)
}
