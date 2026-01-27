import { Address, Hash, Hex } from 'ox'

export function computeZksyncCreate2Address(
  sender: string,
  bytecodeHash: `0x${string}`,
  salt: `0x${string}`,
  input: `0x${string}` = '0x'
): `0x${string}` {
  const prefix = Hash.keccak256(Hex.fromString('zksyncCreate2'))
  const inputHash = Hash.keccak256(input)
  const paddedSender = Hex.padLeft(sender as `0x${string}`, 32)
  const concatenated = Hex.concat(prefix, paddedSender, salt, bytecodeHash, inputHash)
  const addressBytes = Hash.keccak256(concatenated).slice(26)
  return Address.checksum(`0x${addressBytes}`)
}
