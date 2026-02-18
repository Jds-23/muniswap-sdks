export interface Permit2RpcProvider {
  call(params: { to: string; data: string }): Promise<string>
  getBlockTimestamp(): Promise<number>
}
