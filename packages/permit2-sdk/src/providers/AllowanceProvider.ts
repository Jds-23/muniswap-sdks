import { AbiFunction } from 'ox'
import type { Permit2RpcProvider } from './types'

export interface AllowanceData {
  amount: bigint
  nonce: number
  expiration: number
}

const allowanceAbi = {
  type: 'function',
  name: 'allowance',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'spender', type: 'address' },
  ],
  outputs: [
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  stateMutability: 'view',
} as const

export class AllowanceProvider {
  constructor(
    private provider: Permit2RpcProvider,
    private permit2Address: string
  ) {}

  async getAllowanceData(token: string, owner: string, spender: string): Promise<AllowanceData> {
    const data = AbiFunction.encodeData(allowanceAbi, [
      owner as `0x${string}`,
      token as `0x${string}`,
      spender as `0x${string}`,
    ])
    const result = await this.provider.call({ to: this.permit2Address, data })
    const [amount, expiration, nonce] = AbiFunction.decodeResult(allowanceAbi, result as `0x${string}`)
    return { amount, expiration: Number(expiration), nonce: Number(nonce) }
  }

  async getAllowance(token: string, owner: string, spender: string): Promise<bigint> {
    return (await this.getAllowanceData(token, owner, spender)).amount
  }

  async getNonce(token: string, owner: string, spender: string): Promise<number> {
    return (await this.getAllowanceData(token, owner, spender)).nonce
  }

  async getExpiration(token: string, owner: string, spender: string): Promise<number> {
    return (await this.getAllowanceData(token, owner, spender)).expiration
  }
}
