import { vi } from 'vitest'

// Manual mock for viem module
export const mockCreatePublicClient = vi.fn()
export const mockParseEventLogs = vi.fn()
export const mockHttp = vi.fn()

export const createPublicClient = mockCreatePublicClient
export const parseEventLogs = mockParseEventLogs
export const http = mockHttp

// Re-export actual viem types that we need
export type { Block, TransactionReceipt, BlockTag, Chain, PublicClient } from 'viem'
