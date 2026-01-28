import { Address, Hash, Hex } from 'ox'

export function computeZksyncCreate2Address(
  sender: Address.Address,
  bytecodeHash: Hex.Hex,
  salt: Hex.Hex,
  input: Hex.Hex = '0x'
): Address.Address {
  const prefix = Hash.keccak256(Hex.fromString('zksyncCreate2'))
  const inputHash = Hash.keccak256(input)
  const paddedSender = Hex.padLeft(sender, 32)
  const concatenated = Hex.concat(prefix, paddedSender, salt, bytecodeHash, inputHash)
  const addressBytes = Hash.keccak256(concatenated).slice(26)
  return Address.checksum(`0x${addressBytes}`)
}
