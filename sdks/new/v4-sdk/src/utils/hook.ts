import { Address } from 'ox'
import invariant from 'tiny-invariant'

export type HookPermissions = { [key in HookOptions]: boolean }

export enum HookOptions {
  AfterRemoveLiquidityReturnsDelta = 'afterRemoveLiquidityReturnsDelta',
  AfterAddLiquidityReturnsDelta = 'afterAddLiquidityReturnsDelta',
  AfterSwapReturnsDelta = 'afterSwapReturnsDelta',
  BeforeSwapReturnsDelta = 'beforeSwapReturnsDelta',
  AfterDonate = 'afterDonate',
  BeforeDonate = 'beforeDonate',
  AfterSwap = 'afterSwap',
  BeforeSwap = 'beforeSwap',
  AfterRemoveLiquidity = 'afterRemoveLiquidity',
  BeforeRemoveLiquidity = 'beforeRemoveLiquidity',
  AfterAddLiquidity = 'afterAddLiquidity',
  BeforeAddLiquidity = 'beforeAddLiquidity',
  AfterInitialize = 'afterInitialize',
  BeforeInitialize = 'beforeInitialize',
}

export const hookFlagIndex: { [key in HookOptions]: number } = {
  [HookOptions.AfterRemoveLiquidityReturnsDelta]: 0,
  [HookOptions.AfterAddLiquidityReturnsDelta]: 1,
  [HookOptions.AfterSwapReturnsDelta]: 2,
  [HookOptions.BeforeSwapReturnsDelta]: 3,
  [HookOptions.AfterDonate]: 4,
  [HookOptions.BeforeDonate]: 5,
  [HookOptions.AfterSwap]: 6,
  [HookOptions.BeforeSwap]: 7,
  [HookOptions.AfterRemoveLiquidity]: 8,
  [HookOptions.BeforeRemoveLiquidity]: 9,
  [HookOptions.AfterAddLiquidity]: 10,
  [HookOptions.BeforeAddLiquidity]: 11,
  [HookOptions.AfterInitialize]: 12,
  [HookOptions.BeforeInitialize]: 13,
}

/**
 * Hook class for V4 hook permission management
 * V4 hooks encode their permissions in the last 14 bits of the hook address
 */
export class Hook {
  /**
   * Returns all permissions for a given hook address
   * @param address The hook address to check
   * @returns Object containing all permission flags
   */
  public static permissions(address: string): HookPermissions {
    Hook._checkAddress(address)
    return {
      beforeInitialize: Hook._hasPermission(address, HookOptions.BeforeInitialize),
      afterInitialize: Hook._hasPermission(address, HookOptions.AfterInitialize),
      beforeAddLiquidity: Hook._hasPermission(address, HookOptions.BeforeAddLiquidity),
      afterAddLiquidity: Hook._hasPermission(address, HookOptions.AfterAddLiquidity),
      beforeRemoveLiquidity: Hook._hasPermission(address, HookOptions.BeforeRemoveLiquidity),
      afterRemoveLiquidity: Hook._hasPermission(address, HookOptions.AfterRemoveLiquidity),
      beforeSwap: Hook._hasPermission(address, HookOptions.BeforeSwap),
      afterSwap: Hook._hasPermission(address, HookOptions.AfterSwap),
      beforeDonate: Hook._hasPermission(address, HookOptions.BeforeDonate),
      afterDonate: Hook._hasPermission(address, HookOptions.AfterDonate),
      beforeSwapReturnsDelta: Hook._hasPermission(address, HookOptions.BeforeSwapReturnsDelta),
      afterSwapReturnsDelta: Hook._hasPermission(address, HookOptions.AfterSwapReturnsDelta),
      afterAddLiquidityReturnsDelta: Hook._hasPermission(address, HookOptions.AfterAddLiquidityReturnsDelta),
      afterRemoveLiquidityReturnsDelta: Hook._hasPermission(address, HookOptions.AfterRemoveLiquidityReturnsDelta),
    }
  }

  /**
   * Check if a hook has a specific permission
   * @param address The hook address
   * @param hookOption The permission to check
   * @returns True if the hook has the permission
   */
  public static hasPermission(address: string, hookOption: HookOptions): boolean {
    Hook._checkAddress(address)
    return Hook._hasPermission(address, hookOption)
  }

  /**
   * Check if a hook has any initialize permissions
   * @param address The hook address
   * @returns True if the hook has before or after initialize permissions
   */
  public static hasInitializePermissions(address: string): boolean {
    Hook._checkAddress(address)
    return (
      Hook._hasPermission(address, HookOptions.BeforeInitialize) ||
      Hook._hasPermission(address, HookOptions.AfterInitialize)
    )
  }

  /**
   * Check if a hook has any liquidity permissions
   * This implicitly encapsulates liquidity delta permissions
   * @param address The hook address
   * @returns True if the hook has any liquidity-related permissions
   */
  public static hasLiquidityPermissions(address: string): boolean {
    Hook._checkAddress(address)
    return (
      Hook._hasPermission(address, HookOptions.BeforeAddLiquidity) ||
      Hook._hasPermission(address, HookOptions.AfterAddLiquidity) ||
      Hook._hasPermission(address, HookOptions.BeforeRemoveLiquidity) ||
      Hook._hasPermission(address, HookOptions.AfterRemoveLiquidity)
    )
  }

  /**
   * Check if a hook has any swap permissions
   * This implicitly encapsulates swap delta permissions
   * @param address The hook address
   * @returns True if the hook has any swap-related permissions
   */
  public static hasSwapPermissions(address: string): boolean {
    Hook._checkAddress(address)
    return Hook._hasPermission(address, HookOptions.BeforeSwap) || Hook._hasPermission(address, HookOptions.AfterSwap)
  }

  /**
   * Check if a hook has any donate permissions
   * @param address The hook address
   * @returns True if the hook has any donate-related permissions
   */
  public static hasDonatePermissions(address: string): boolean {
    Hook._checkAddress(address)
    return (
      Hook._hasPermission(address, HookOptions.BeforeDonate) || Hook._hasPermission(address, HookOptions.AfterDonate)
    )
  }

  private static _hasPermission(address: string, hookOption: HookOptions): boolean {
    // Use only the last 4 bytes (32 bits) to avoid JavaScript precision issues
    // All hook flags are in bits 0-13, which fit comfortably in 32 bits
    const last4Bytes = `0x${address.slice(-8)}`
    return !!(Number.parseInt(last4Bytes, 16) & (1 << hookFlagIndex[hookOption]))
  }

  private static _checkAddress(address: string): void {
    invariant(Address.validate(address), 'invalid address')
  }
}
