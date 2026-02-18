import { AbiFunction } from 'ox'
import invariant from 'tiny-invariant'
import type { PermitBatchTransferFrom, PermitTransferFrom } from '../signatureTransfer'
import type { Permit2RpcProvider } from './types'

export interface NonceValidationResult {
  isUsed: boolean
  isExpired: boolean
  isValid: boolean
}

const nonceBitmapAbi = {
  type: 'function',
  name: 'nonceBitmap',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'wordPos', type: 'uint256' },
  ],
  outputs: [{ name: 'bitmap', type: 'uint256' }],
  stateMutability: 'view',
} as const

export class SignatureProvider {
  constructor(
    private provider: Permit2RpcProvider,
    private permit2Address: string
  ) {}

  async isNonceUsed(owner: string, nonce: bigint): Promise<boolean> {
    const { wordPos, bitPos } = SignatureProvider.getNoncePositions(nonce)
    const bitmap = await this.getNonceBitmap(owner, wordPos)
    return SignatureProvider.isBitSet(bitmap, bitPos)
  }

  async isExpired(deadline: bigint): Promise<boolean> {
    const currentTimestamp = await this.provider.getBlockTimestamp()
    return deadline < BigInt(currentTimestamp)
  }

  async isPermitValid(permit: PermitTransferFrom | PermitBatchTransferFrom): Promise<boolean> {
    return (await this.validatePermit(permit)).isValid
  }

  async validatePermit(permit: PermitTransferFrom | PermitBatchTransferFrom): Promise<NonceValidationResult> {
    const [isExpiredResult, isNonceUsedResult] = await Promise.all([
      this.isExpired(permit.deadline),
      this.isNonceUsed(permit.spender, permit.nonce),
    ])

    return {
      isUsed: isNonceUsedResult,
      isExpired: isExpiredResult,
      isValid: !isExpiredResult && !isNonceUsedResult,
    }
  }

  async getNonceBitmap(owner: string, wordPos: bigint): Promise<bigint> {
    const data = AbiFunction.encodeData(nonceBitmapAbi, [owner as `0x${string}`, wordPos])
    const result = await this.provider.call({ to: this.permit2Address, data })
    return AbiFunction.decodeResult(nonceBitmapAbi, result as `0x${string}`)
  }

  static isBitSet(bitmap: bigint, bitPos: number): boolean {
    invariant(bitPos >= 0 && bitPos <= 255, 'BIT_POSITION_OUT_OF_RANGE')
    const mask = 1n << BigInt(bitPos)
    return (bitmap & mask) > 0n
  }

  static getNoncePositions(nonce: bigint): { wordPos: bigint; bitPos: number } {
    return {
      wordPos: nonce >> 8n,
      bitPos: Number(nonce & 255n),
    }
  }

  async batchCheckNonces(owner: string, nonces: bigint[]): Promise<boolean[]> {
    const wordPositions = new Set<string>()
    nonces.forEach((nonce) => {
      const { wordPos } = SignatureProvider.getNoncePositions(nonce)
      wordPositions.add(wordPos.toString())
    })

    const bitmapPromises = Array.from(wordPositions).map(async (wordPosKey) => {
      const wordPos = BigInt(wordPosKey)
      const bitmap = await this.getNonceBitmap(owner, wordPos)
      return { wordPos, bitmap }
    })

    const bitmaps = await Promise.all(bitmapPromises)
    const bitmapMap = new Map(bitmaps.map(({ wordPos, bitmap }) => [wordPos.toString(), bitmap]))

    return nonces.map((nonce) => {
      const { wordPos, bitPos } = SignatureProvider.getNoncePositions(nonce)
      const bitmap = bitmapMap.get(wordPos.toString())
      if (!bitmap && bitmap !== 0n) {
        throw new Error(`Bitmap not found for word position ${wordPos.toString()}`)
      }
      return SignatureProvider.isBitSet(bitmap, bitPos)
    })
  }
}
