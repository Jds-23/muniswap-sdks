import { getAddress, isAddress } from 'viem'
import { z } from 'zod'

/**
 * Zod schema for Ethereum addresses that validates and checksums the address
 */
export const addressSchema = z
  .string()
  .refine(isAddress, { message: 'Invalid Ethereum address' })
  .transform((addr) => getAddress(addr))

/**
 * Type-safe Ethereum address type derived from the schema
 */
export type Address = z.infer<typeof addressSchema>

/**
 * Zod schema for optional Ethereum addresses
 */
export const optionalAddressSchema = addressSchema.optional()

/**
 * Parse and validate an Ethereum address
 * @param address The address string to validate
 * @returns The checksummed address
 * @throws ZodError if the address is invalid
 */
export function parseAddress(address: string): Address {
  return addressSchema.parse(address)
}

/**
 * Safely parse an Ethereum address without throwing
 * @param address The address string to validate
 * @returns The checksummed address or undefined if invalid
 */
export function safeParseAddress(address: string): Address | undefined {
  const result = addressSchema.safeParse(address)
  return result.success ? result.data : undefined
}
