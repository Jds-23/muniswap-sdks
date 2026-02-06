# Router SDK Modernization Plan

A phase-based plan for migrating `external/uniswap-sdks/sdks/router-sdk` into `packages/router-sdk` using the same modern tooling established in sdk-core, v2-sdk, v3-sdk, and v4-sdk.

**Source**: `external/uniswap-sdks/sdks/router-sdk` (`@uniswap/router-sdk`)
**Target**: `packages/router-sdk` (`@muniswap/router-sdk`)

---

## Current State Audit

### Legacy Stack

| Area | Current | Target |
|------|---------|--------|
| Package name | `@uniswap/router-sdk` | `@muniswap/router-sdk` |
| Bundler | tsdx | tsup |
| Linter/formatter | eslint + prettier | Biome |
| Test runner | Jest (via tsdx) | Vitest |
| Big integers | JSBI | Native BigInt |
| Ethereum utils | `@ethersproject/abi` | ox (`AbiFunction`, `AbiParameters`) |
| ABI source | `@uniswap/swap-router-contracts` (JSON artifacts) | Inline ABI constants with ox |
| TypeScript target | ES2018 | ES2022 |
| Module resolution | Node (CommonJS-first) | Bundler (ESM-first) |
| SDK dependencies | `@uniswap/*` (npm) | `@muniswap/*` (workspace:*) |

### Dependency Map

```
@uniswap/router-sdk
├── @ethersproject/abi          → ox (AbiFunction.encodeData)
├── @uniswap/sdk-core           → @muniswap/sdk-core (workspace:*)
├── @uniswap/swap-router-contracts → inline ABI definitions
├── @uniswap/v2-sdk             → @muniswap/v2-sdk (workspace:*)
├── @uniswap/v3-sdk             → @muniswap/v3-sdk (workspace:*)
├── @uniswap/v4-sdk             → @muniswap/v4-sdk (workspace:*)
├── jsbi                        → native BigInt
└── tiny-invariant              → tiny-invariant (keep)
```

### Source Files Inventory

| File | Key Exports | Migration Complexity |
|------|-------------|---------------------|
| `constants.ts` | `ADDRESS_ZERO`, `MSG_SENDER`, `ADDRESS_THIS`, `ZERO`, `ONE`, fee placeholders, `ZERO_PERCENT`, `ONE_HUNDRED_PERCENT` | Low - replace JSBI constants with `bigint` literals |
| `entities/protocol.ts` | `Protocol` enum (V2, V3, V4, MIXED) | None - no legacy deps |
| `entities/route.ts` | `IRoute`, `RouteV2`, `RouteV3`, `RouteV4`, `MixedRoute`, `getPathToken` | Medium - update SDK imports |
| `entities/trade.ts` | `Trade` class (aggregated multi-protocol) | Medium - replace JSBI comparisons, update SDK imports |
| `entities/mixedRoute/route.ts` | `MixedRouteSDK` | Medium - update SDK imports |
| `entities/mixedRoute/trade.ts` | `MixedRouteTrade` | Medium - replace JSBI, update SDK imports |
| `swapRouter.ts` | `SwapRouter`, `SwapOptions`, `SwapAndAddOptions` | High - replace `Interface`/`encodeFunctionData` with ox, replace ABI JSON imports |
| `multicallExtended.ts` | `MulticallExtended`, `Validation` | High - replace `Interface` with ox |
| `paymentsExtended.ts` | `PaymentsExtended` | High - replace `Interface` with ox, replace JSBI params with `bigint` |
| `approveAndCall.ts` | `ApproveAndCall`, `ApprovalTypes`, `CondensedAddLiquidityOptions` | High - replace `Interface` with ox, replace JSBI |
| `utils/TPool.ts` | `TPool` type union | Low - update pool imports |
| `utils/pathCurrency.ts` | `amountWithPathCurrency`, `getPathCurrency` | Low - update SDK imports |
| `utils/encodeMixedRouteToPath.ts` | `encodeMixedRouteToPath` | High - replace `@ethersproject/solidity.pack` with `AbiParameters.encodePacked` |
| `utils/index.ts` | `partitionMixedRouteByProtocol`, `getOutputOfPools` | Low - update pool imports |

---

## Phase 1: Package Scaffold & Build Tooling

**Goal**: Create the `packages/router-sdk` directory with modern build configuration and copy source files without modifying them.

### 1.1 Create Directory Structure

```
packages/router-sdk/
├── src/
│   ├── entities/
│   │   └── mixedRoute/
│   └── utils/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── biome.json
└── vitest.config.ts
```

### 1.2 package.json

```json
{
  "name": "@muniswap/router-sdk",
  "version": "0.0.1",
  "description": "An SDK for routing swaps using Uniswap V2, V3, and V4",
  "license": "MIT",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@muniswap/sdk-core": "workspace:*",
    "@muniswap/v2-sdk": "workspace:*",
    "@muniswap/v3-sdk": "workspace:*",
    "@muniswap/v4-sdk": "workspace:*",
    "ox": "^0.6.0",
    "tiny-invariant": "^1.3.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### 1.3 Config Files

Use the same `tsup.config.ts`, `tsconfig.json`, `biome.json`, and `vitest.config.ts` as the other modernized packages. The `tsconfig.json` should include `resolveJsonModule: true` (needed if any JSON imports remain during migration).

The `vitest.config.ts` should inline the workspace SDK dependencies:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    deps: { interopDefault: true },
    server: {
      deps: { inline: [/@muniswap/] },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
})
```

### 1.4 Register in Monorepo

- Add `packages/router-sdk` to `pnpm-workspace.yaml` (already covered by `packages/*` glob).
- Update `turbo.json` if any router-sdk-specific task configuration is needed.
- The dependency chain becomes:

```
sdk-core → v2-sdk → v3-sdk → v4-sdk → router-sdk
```

### Checklist

- [ ] Create `packages/router-sdk/` directory structure
- [ ] Create `package.json` with workspace dependencies
- [ ] Create `tsconfig.json` (ES2022, bundler resolution, strict)
- [ ] Create `tsup.config.ts` (ESM + CJS, dts, sourcemap)
- [ ] Create `biome.json` (matching other packages)
- [ ] Create `vitest.config.ts` (with `@muniswap` inline deps)
- [ ] Copy all source files from `external/uniswap-sdks/sdks/router-sdk/src/`
- [ ] Run `pnpm install` to verify workspace resolution
- [ ] Verify `pnpm build` runs (expect type errors at this stage)

---

## Phase 2: JSBI to Native BigInt

**Goal**: Remove all JSBI usage and replace with native `bigint` literals and operators.

### 2.1 constants.ts

```typescript
// Before
import JSBI from 'jsbi'
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const ZERO_PERCENT = new Percent(ZERO)

// After
export const ZERO = 0n
export const ONE = 1n
export const ZERO_PERCENT = new Percent(0n)
export const ONE_HUNDRED_PERCENT = new Percent(100, 100)
```

### 2.2 paymentsExtended.ts

Replace all `JSBI` parameter types with `bigint`:

```typescript
// Before
public static encodeUnwrapWETH9(amountMinimum: JSBI, ...): string
public static encodePull(token: Token, amount: JSBI): string
public static encodeWrapETH(amount: JSBI): string

// After
public static encodeUnwrapWETH9(amountMinimum: bigint, ...): string
public static encodePull(token: Token, amount: bigint): string
public static encodeWrapETH(amount: bigint): string
```

### 2.3 approveAndCall.ts

Replace JSBI comparison:

```typescript
// Before
if (JSBI.lessThan(minimalPosition.amount0.quotient, amount0Min)) {
  amount0Min = minimalPosition.amount0.quotient
}

// After
if (minimalPosition.amount0.quotient < amount0Min) {
  amount0Min = minimalPosition.amount0.quotient
}
```

### 2.4 swapRouter.ts

```typescript
// Before
const ZERO = JSBI.BigInt(0)
const REFUND_ETH_PRICE_IMPACT_THRESHOLD = new Percent(JSBI.BigInt(50), JSBI.BigInt(100))
value: toHex(inputIsNative ? totalAmountIn.quotient : ZERO)
let value: JSBI

// After
const REFUND_ETH_PRICE_IMPACT_THRESHOLD = new Percent(50n, 100n)
value: toHex(inputIsNative ? totalAmountIn.quotient : 0n)
let value: bigint
```

### 2.5 entities/trade.ts and entities/mixedRoute/trade.ts

These files primarily use JSBI through sdk-core's `CurrencyAmount` and `Fraction` classes, which already accept `bigint` in the modernized `@muniswap/sdk-core`. The `ZERO` and `ONE` constants from `constants.ts` will propagate naturally once updated.

### Checklist

- [ ] Remove `jsbi` from `package.json` dependencies
- [ ] Update `constants.ts`: `ZERO` → `0n`, `ONE` → `1n`
- [ ] Update `paymentsExtended.ts`: all `JSBI` param types → `bigint`
- [ ] Update `approveAndCall.ts`: `JSBI.lessThan()` → native `<` operator
- [ ] Update `swapRouter.ts`: remove JSBI import, use `bigint` literals
- [ ] Search for any remaining `JSBI` references and replace
- [ ] Run `pnpm typecheck` to verify

---

## Phase 3: ethers.js to ox

**Goal**: Replace all `@ethersproject/abi` and `@ethersproject/solidity` usage with `ox` equivalents. This is the most complex phase due to the ABI encoding patterns used throughout.

### 3.1 ABI Interface Pattern Replacement

The router-sdk uses ethers `Interface` for ABI encoding in four classes. Each creates an `Interface` from a JSON ABI artifact and calls `encodeFunctionData`. The ox equivalent uses `AbiFunction.fromAbi` and `AbiFunction.encodeData`.

**General pattern:**

```typescript
// Before (ethers)
import { Interface } from '@ethersproject/abi'
import ISwapRouter02 from '@uniswap/swap-router-contracts/artifacts/.../ISwapRouter02.json'

class SwapRouter {
  public static INTERFACE: Interface = new Interface(ISwapRouter02.abi)

  static encode() {
    return SwapRouter.INTERFACE.encodeFunctionData('exactInputSingle', [params])
  }
}

// After (ox)
import { AbiFunction } from 'ox'

// Define ABI functions inline as typed constants
const exactInputSingle = AbiFunction.from(
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)'
)

class SwapRouter {
  static encode() {
    return AbiFunction.encodeData(exactInputSingle, [params])
  }
}
```

### 3.2 swapRouter.ts - ABI Functions to Define

Extract the following function signatures from the `ISwapRouter02` ABI and define as inline `AbiFunction.from()` constants:

| Function | Signature |
|----------|-----------|
| `swapExactTokensForTokens` | `function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to) returns (uint256 amountOut)` |
| `swapTokensForExactTokens` | `function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to) returns (uint256 amountIn)` |
| `exactInputSingle` | `function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut)` |
| `exactOutputSingle` | `function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn)` |
| `exactInput` | `function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params) returns (uint256 amountOut)` |
| `exactOutput` | `function exactOutput((bytes path, address recipient, uint256 amountOut, uint256 amountInMaximum) params) returns (uint256 amountIn)` |

### 3.3 multicallExtended.ts - ABI Functions

| Function | Signature |
|----------|-----------|
| `multicall(uint256,bytes[])` | `function multicall(uint256 deadline, bytes[] data) returns (bytes[] results)` |
| `multicall(bytes32,bytes[])` | `function multicall(bytes32 previousBlockhash, bytes[] data) returns (bytes[] results)` |

### 3.4 paymentsExtended.ts - ABI Functions

| Function | Signature |
|----------|-----------|
| `unwrapWETH9(uint256)` | `function unwrapWETH9(uint256 amountMinimum)` |
| `unwrapWETH9WithFee(uint256,uint256,address)` | `function unwrapWETH9WithFee(uint256 amountMinimum, uint256 feeBips, address feeRecipient)` |
| `sweepToken(address,uint256)` | `function sweepToken(address token, uint256 amountMinimum)` |
| `sweepTokenWithFee(address,uint256,uint256,address)` | `function sweepTokenWithFee(address token, uint256 amountMinimum, uint256 feeBips, address feeRecipient)` |
| `pull` | `function pull(address token, uint256 value)` |
| `wrapETH` | `function wrapETH(uint256 value)` |

### 3.5 approveAndCall.ts - ABI Functions

| Function | Signature |
|----------|-----------|
| `approveMax` | `function approveMax(address token)` |
| `approveMaxMinusOne` | `function approveMaxMinusOne(address token)` |
| `approveZeroThenMax` | `function approveZeroThenMax(address token)` |
| `approveZeroThenMaxMinusOne` | `function approveZeroThenMaxMinusOne(address token)` |
| `callPositionManager` | `function callPositionManager(bytes data) returns (bytes result)` |
| `mint` | `function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Min, uint256 amount1Min, address recipient) params) returns (bytes result)` |
| `increaseLiquidity` | `function increaseLiquidity((address token0, address token1, uint256 amount0Min, uint256 amount1Min, uint256 tokenId) params) returns (bytes result)` |

### 3.6 encodeMixedRouteToPath.ts

Replace `@ethersproject/solidity.pack` with `AbiParameters.encodePacked`:

```typescript
// Before
import { pack } from '@ethersproject/solidity'
return pack(types, path)

// After
import { AbiParameters } from 'ox'
return AbiParameters.encodePacked(types, path)
```

Note: Verify that `AbiParameters.encodePacked` accepts the dynamic `types`/`values` arrays built at runtime. If not, the encoding may need to be built iteratively using `Hex.concat`.

### 3.7 Remove Re-exports from @uniswap/v3-sdk

The legacy router-sdk imports several utilities from `@uniswap/v3-sdk`:
- `toHex` - Replace with ox `Hex.fromNumber` or a local utility
- `encodeRouteToPath` - Import from `@muniswap/v3-sdk`
- `Payments`, `SelfPermit`, `Multicall` - Import from `@muniswap/v3-sdk`
- `FeeOptions`, `PermitOptions`, `MethodParameters` - Import types from `@muniswap/v3-sdk`

### 3.8 Remove @uniswap/swap-router-contracts Dependency

Once all ABI functions are defined inline with ox, the `@uniswap/swap-router-contracts` dependency can be removed entirely. This eliminates a heavy transitive dependency tree.

### Checklist

- [ ] Remove `@ethersproject/abi` from dependencies
- [ ] Remove `@uniswap/swap-router-contracts` from dependencies
- [ ] Create `src/abis/` directory with typed ABI function definitions
- [ ] Migrate `swapRouter.ts` to use `AbiFunction.encodeData`
- [ ] Migrate `multicallExtended.ts` to use `AbiFunction.encodeData`
- [ ] Migrate `paymentsExtended.ts` to use `AbiFunction.encodeData`
- [ ] Migrate `approveAndCall.ts` to use `AbiFunction.encodeData`
- [ ] Migrate `encodeMixedRouteToPath.ts` to use `AbiParameters.encodePacked`
- [ ] Replace `toHex` imports with ox equivalent
- [ ] Verify all encoded calldata matches original output (add regression tests)
- [ ] Run `pnpm typecheck`

---

## Phase 4: SDK Dependency Migration

**Goal**: Replace all `@uniswap/*` imports with `@muniswap/*` workspace equivalents and update any API differences introduced by the modernized packages.

### 4.1 Import Replacements

| Legacy Import | Modern Replacement |
|---------------|-------------------|
| `@uniswap/sdk-core` | `@muniswap/sdk-core` |
| `@uniswap/v2-sdk` | `@muniswap/v2-sdk` |
| `@uniswap/v3-sdk` | `@muniswap/v3-sdk` |
| `@uniswap/v4-sdk` | `@muniswap/v4-sdk` |

### 4.2 Type Differences to Account For

The modernized sdk-core uses `bigint` where the legacy used `JSBI`. Verify these APIs still work:

- `CurrencyAmount.fromRawAmount()` - accepts `bigint` natively
- `Percent` constructor - accepts `bigint` natively
- `Fraction` - `.quotient` returns `bigint`
- `Token.address` - returns `Address.Address` (ox branded type) instead of `string`
- `validateAndParseAddress()` - returns `Address.Address` instead of `string`

### 4.3 Address Type Handling

The modernized sdk-core returns `Address.Address` (a branded `string` type from ox) instead of plain `string`. This should be compatible in most contexts since `Address.Address extends string`, but verify:

- Route path arrays: `token.address` used in `path.map()`
- ABI encoding: `AbiFunction.encodeData` accepts `Address.Address`
- Comparison operations: `===` still works

### 4.4 v3-sdk Utility Re-exports

The legacy router-sdk imports utilities from v3-sdk that may have different signatures in the modernized version:

- `toHex(value)` - May need replacement with ox or a local implementation
- `encodeRouteToPath(route, exactOutput)` - Verify same signature
- `Multicall.encodeMulticall(calldatas)` - Verify same signature
- `Payments.encodeUnwrapWETH9(...)` - Verify parameter types changed to `bigint`
- `SelfPermit.encodePermit(...)` - Verify same signature
- `NonfungiblePositionManager.INTERFACE` - May no longer exist if v3-sdk was migrated to ox

### 4.5 Use `import type` for Type-Only Imports

Enforce `verbatimModuleSyntax` by separating type imports:

```typescript
import type { Currency, CurrencyAmount, Percent, TradeType } from '@muniswap/sdk-core'
import { validateAndParseAddress, WETH9 } from '@muniswap/sdk-core'

import type { FeeOptions, MethodParameters, PermitOptions } from '@muniswap/v3-sdk'
import { encodeRouteToPath, Payments, SelfPermit } from '@muniswap/v3-sdk'
```

### Checklist

- [ ] Replace all `@uniswap/*` imports with `@muniswap/*`
- [ ] Add `import type` for all type-only imports
- [ ] Verify `Token.address` (`Address.Address`) compatibility
- [ ] Verify v3-sdk utility function signatures match
- [ ] Verify v2-sdk `Pair` and `Trade` constructor signatures
- [ ] Verify v4-sdk `Pool` and `Trade` constructor signatures
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm build`

---

## Phase 5: TypeScript Strictness & Code Quality

**Goal**: Enable full strict TypeScript options and fix resulting issues. Apply Biome linting.

### 5.1 TypeScript Strict Options

The new `tsconfig.json` enables options not present in the legacy config:

| Option | Impact on router-sdk |
|--------|---------------------|
| `noImplicitOverride` | No overrides used - no impact |
| `noUncheckedIndexedAccess` | Array access in `trade.swaps[0]` and `route.pools[0]` will need null checks or non-null assertions |
| `exactOptionalPropertyTypes` | Optional properties like `recipient?: string` need careful handling (`undefined` must be explicit) |
| `verbatimModuleSyntax` | All type imports must use `import type` |
| `moduleResolution: "bundler"` | No `.js` extensions needed in imports |

### 5.2 noUncheckedIndexedAccess Fixes

Several patterns in the codebase access arrays without bounds checking:

```typescript
// Before (unsafe)
const sampleTrade = trades[0]
const inputCurrency = this.swaps[0].inputAmount.currency
route.tokenPath[0].address
route.pools[0].fee

// After (with assertion - these are invariant-protected)
const sampleTrade = trades[0]!  // validated by invariant above
const inputCurrency = this.swaps[0]!.inputAmount.currency  // constructor ensures non-empty
```

Or use `invariant` to narrow:

```typescript
invariant(trades.length > 0, 'NO_TRADES')
const sampleTrade = trades[0]  // TypeScript knows this is defined after invariant
```

Note: `tiny-invariant` does not narrow types by default. A custom type assertion may be needed, or use non-null assertions after the invariant call.

### 5.3 Biome Lint Fixes

Run `pnpm lint:fix` to auto-fix:

- Import organization
- Quote style (single quotes)
- Semicolons (ASI - remove unnecessary)
- Trailing commas (ES5 style)
- Unused imports

### Checklist

- [ ] Fix all `noUncheckedIndexedAccess` errors
- [ ] Fix all `exactOptionalPropertyTypes` errors
- [ ] Fix all `verbatimModuleSyntax` errors (type imports)
- [ ] Run `pnpm lint:fix` to apply Biome formatting
- [ ] Manually review Biome lint warnings (e.g., `noExplicitAny`)
- [ ] Remove `.eslintrc.js` and prettier config (if copied from source)
- [ ] Run `pnpm typecheck` with zero errors
- [ ] Run `pnpm lint` with zero errors

---

## Phase 6: Test Migration

**Goal**: Migrate all tests from Jest to Vitest and ensure full coverage parity.

### 6.1 Test File Inventory

| Test File | Tests | Migration Notes |
|-----------|-------|----------------|
| `swapRouter.test.ts` | V2/V3/mixed swap encoding, fee handling, ETH wrap/unwrap | Update SDK imports, JSBI → bigint in test fixtures |
| `entities/trade.test.ts` | Multi-route aggregation, price impact, slippage | Update SDK imports, token construction |
| `entities/route.test.ts` | Route wrapping, protocol assignment, mid-price | Update SDK imports |
| `entities/mixedRoute/route.test.ts` | Mixed path construction, fake V4 pools | Update SDK imports, pool construction |
| `entities/mixedRoute/trade.test.ts` | Mixed trade execution, bestTradeExactIn | Update SDK imports |
| `multicallExtended.test.ts` | Deadline/blockhash encoding | Update ABI encoding expectations |
| `paymentsExtended.test.ts` | WETH unwrap, sweep, pull, wrap | Update ABI encoding expectations |
| `utils/encodeMixedRouteToPath.test.ts` | Hex path encoding for mixed routes | Update pool construction |
| `utils/pathCurrency.test.ts` | Currency path handling | Update SDK imports |

### 6.2 Jest to Vitest Changes

```typescript
// No changes needed for test syntax - Vitest supports describe/it/expect
// With globals: true in vitest.config.ts, no import needed

// Before (Jest)
import { describe, it, expect } from '@jest/globals'  // or implicit

// After (Vitest with globals: true)
// No import needed - describe, it, expect are global
```

### 6.3 Test Fixture Updates

All test fixtures that create tokens, pools, or amounts need updating:

```typescript
// Before
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
const amount = CurrencyAmount.fromRawAmount(token, JSBI.BigInt('1000000'))

// After
import { CurrencyAmount, Token } from '@muniswap/sdk-core'
const amount = CurrencyAmount.fromRawAmount(token, 1000000n)
```

### 6.4 ABI Encoding Assertion Updates

Tests that assert specific calldata hex strings may need updating if ox produces slightly different encoding (padding, etc.). Run both old and new tests side-by-side to verify encoding parity.

Strategy:
1. Capture all expected calldata strings from the legacy test suite first
2. Use these as golden values in the modernized tests
3. Any mismatches indicate an encoding regression

### Checklist

- [ ] Copy all test files to `packages/router-sdk/src/`
- [ ] Update all test imports (`@uniswap/*` → `@muniswap/*`)
- [ ] Replace all JSBI usage in test fixtures with native BigInt
- [ ] Verify encoding assertions match legacy output
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm test:coverage` - verify coverage parity
- [ ] Add any missing edge case tests discovered during migration

---

## Phase 7: Validation & Integration

**Goal**: Full end-to-end verification that the modernized router-sdk builds, passes tests, and integrates correctly with the monorepo.

### 7.1 Build Verification

```bash
# Clean build from root
pnpm clean && pnpm install && pnpm build

# Verify dist outputs
ls packages/router-sdk/dist/
# Expected: index.js, index.cjs, index.d.ts, index.d.cts, index.js.map, index.cjs.map
```

### 7.2 Full Test Suite

```bash
# Run all package tests (ensures no regressions in dependent packages)
pnpm test

# Router-sdk specific coverage
cd packages/router-sdk && pnpm test:coverage
```

### 7.3 Type Checking

```bash
pnpm typecheck
```

### 7.4 Lint

```bash
pnpm lint
```

### 7.5 Bundle Size Comparison

```bash
# Compare to legacy
du -h packages/router-sdk/dist/index.js
du -h packages/router-sdk/dist/index.cjs

# The modernized bundle should be smaller due to:
# - Removal of JSBI (no polyfill overhead)
# - Removal of @ethersproject/abi (replaced with lighter ox)
# - Removal of @uniswap/swap-router-contracts (inline ABIs)
# - Tree-shaking via tsup
```

### 7.6 API Compatibility Audit

Verify the public API surface is preserved. Every export from the legacy `src/index.ts` should exist in the modern version:

| Export | Status |
|--------|--------|
| `ADDRESS_ZERO`, `MSG_SENDER`, `ADDRESS_THIS` | Must exist |
| `ZERO`, `ONE` | Type changed: `JSBI` → `bigint` (breaking) |
| `MIXED_QUOTER_*` fee placeholders | Must exist |
| `ZERO_PERCENT`, `ONE_HUNDRED_PERCENT` | Must exist |
| `Protocol` enum | Must exist |
| `IRoute`, `RouteV2`, `RouteV3`, `RouteV4`, `MixedRoute` | Must exist |
| `Trade` class | Must exist, BigInt types change |
| `MixedRouteSDK` | Must exist |
| `MixedRouteTrade` | Must exist |
| `SwapRouter`, `SwapOptions`, `SwapAndAddOptions` | Must exist |
| `MulticallExtended`, `Validation` | Must exist |
| `PaymentsExtended` | Must exist, `JSBI` params → `bigint` |
| `ApproveAndCall`, `ApprovalTypes`, `CondensedAddLiquidityOptions` | Must exist |
| `encodeMixedRouteToPath` | Must exist |
| `TPool` | Must exist |
| `partitionMixedRouteByProtocol`, `getOutputOfPools` | Must exist |
| `amountWithPathCurrency`, `getPathCurrency` | Must exist |

### 7.7 Breaking Changes Documentation

Document the following breaking changes:

1. **JSBI → BigInt**: All `JSBI` types in public API become `bigint`
2. **Node.js >= 20**: Required for native BigInt performance and ESM support
3. **ESM-first**: Primary module format is now ESM (CJS still available)
4. **Address types**: `string` → `Address.Address` (branded string, compatible)

### Checklist

- [ ] `pnpm build` succeeds from root
- [ ] `pnpm test` passes for all packages
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Bundle size is acceptable (ideally smaller)
- [ ] All public exports preserved
- [ ] Breaking changes documented
- [ ] No regressions in sdk-core, v2-sdk, v3-sdk, v4-sdk

---

## Phase 8: Documentation & Release

**Goal**: Update documentation and prepare for release.

### 8.1 Package README

Create `packages/router-sdk/README.md` with:
- Installation instructions (`pnpm add @muniswap/router-sdk`)
- Basic usage examples (ESM import syntax)
- Migration notes from `@uniswap/router-sdk`

### 8.2 Monorepo Documentation

- Update root `README.md` dependency chain to include router-sdk
- Update `CLAUDE.md` dependency chain:

```
sdk-core → v2-sdk → v3-sdk → v4-sdk → router-sdk
```

- Add router-sdk page to `apps/docs/`

### 8.3 CHANGELOG

```
feat(breaking): modernize router-sdk

- Replace tsdx with tsup (ESM + CJS dual output)
- Replace eslint + prettier with Biome
- Replace Jest with Vitest
- Replace @ethersproject/abi with ox
- Replace JSBI with native BigInt
- Remove @uniswap/swap-router-contracts (inline ABI definitions)
- Replace @uniswap/* dependencies with @muniswap/* workspace packages
- Enable strict TypeScript options
- Update package.json exports for ESM-first

BREAKING CHANGE: All JSBI types become native bigint
BREAKING CHANGE: Requires Node.js >= 20
BREAKING CHANGE: ESM is now the primary module format
```

### Checklist

- [ ] Create `packages/router-sdk/README.md`
- [ ] Update root `README.md`
- [ ] Update `CLAUDE.md` dependency chain
- [ ] Add docs page in `apps/docs/`
- [ ] Write CHANGELOG entry
- [ ] Verify `pnpm docs:build` succeeds

---

## Execution Order Summary

| Phase | Description | Depends On | Risk |
|-------|-------------|-----------|------|
| 1 | Package scaffold & build tooling | None | Low |
| 2 | JSBI → native BigInt | Phase 1 | Low |
| 3 | ethers.js → ox | Phase 1 | **High** - ABI encoding parity |
| 4 | SDK dependency migration | Phases 2, 3 | Medium |
| 5 | TypeScript strictness & code quality | Phase 4 | Low |
| 6 | Test migration | Phases 2, 3, 4, 5 | Medium - encoding assertions |
| 7 | Validation & integration | Phase 6 | Low |
| 8 | Documentation & release | Phase 7 | Low |

Phases 2 and 3 can be worked on in parallel since they modify different parts of the code (BigInt constants/types vs. ABI encoding). Phase 4 depends on both being complete. Phase 6 should be done last among the code phases since tests need all source changes finalized.
