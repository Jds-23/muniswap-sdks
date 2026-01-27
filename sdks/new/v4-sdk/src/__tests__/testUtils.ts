import { type HookOptions, hookFlagIndex } from '../utils/hook'

export function constructHookAddress(hookOptions: HookOptions[]): string {
  let hookFlags = 0
  for (const hookOption of hookOptions) {
    hookFlags = hookFlags | (1 << hookFlagIndex[hookOption])
  }

  const addressFlag = hookFlags.toString(16)
  return `0x${'0'.repeat(40 - addressFlag.length)}${addressFlag}`
}
