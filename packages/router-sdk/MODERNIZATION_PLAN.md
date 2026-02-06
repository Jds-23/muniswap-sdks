# Router SDK Modernization Plan

Phase-based plan for modernizing `external/uniswap-sdks/sdks/router-sdk` into `packages/router-sdk` following the patterns in `MODERNIZATION.md`.

---

## Source Inventory

### Current Stack (Legacy)

| Area | Current | Target |
|------|---------|--------|
| Package name | `@uniswap/router-sdk` | `@muniswap/router-sdk` |
| Package manager | yarn | pnpm (workspace) |
| Bundler | tsdx v0.14.1 | tsup v8.3+ |
| Linter/formatter | eslint + prettier | biome v1.9+ |
| Test runner | jest (via tsdx) | vitest v2.1+ |
| Ethereum utils | `@ethersproject/abi` v5.5 | ox v0.6+ |
| Big integers | JSBI (via sdk-core) | native BigInt |
| TypeScript target | ES2018 | ES2022 |
| Module resolution | node | bundler |

### Dependencies to Replace

| Legacy Dependency | Modern Replacement |
|-------------------|--------------------|
| `@uniswap/sdk-core` ^7.10.1 | `@muniswap/sdk-core` (workspace:*) |
| `@uniswap/v2-sdk` ^4.17.0 | `@muniswap/v2-sdk` (workspace:*) |
| `@uniswap/v3-sdk` ^3.27.0 | `@muniswap/v3-sdk` (workspace:*) |
| `@uniswap/v4-sdk` ^1.25.6 | `@muniswap/v4-sdk` (workspace:*) |
| `@ethersproject/abi` ^5.5.0 | ox ^0.6.0 |
| `@uniswap/swap-router-contracts` ^1.3.0 | Keep (ABI artifacts only) |

### Source Files (15 source + 9 test)

```
src/
├── index.ts                              # Re-exports all modules
├── constants.ts                          # JSBI constants, address constants, fee placeholders
├── approveAndCall.ts                     # ApproveAndCall encoding (130 lines)
├── multicallExtended.ts                  # Multicall with deadline/blockhash (48 lines)
├── paymentsExtended.ts                   # Extended payment encoding (76 lines)
├── swapRouter.ts                         # Main swap router encoding (692 lines)
├── entities/
│   ├── protocol.ts                       # Protocol enum (6 lines)
│   ├── route.ts                          # Route wrappers: RouteV2/V3/V4/Mixed (95 lines)
│   ├── trade.ts                          # Aggregated Trade class (527 lines)
│   └── mixedRoute/
│       ├── route.ts                      # MixedRouteSDK class (137 lines)
│       └── trade.ts                      # MixedRouteTrade class (~150 lines)
└── utils/
    ├── index.ts                          # partitionMixedRouteByProtocol, getOutputOfPools (56 lines)
    ├── TPool.ts                          # TPool type alias (5 lines)
    ├── encodeMixedRouteToPath.ts         # Mixed route hex path encoding (112 lines)
    └── pathCurrency.ts                   # Currency path resolution (37 lines)
```

### Key Migration Concerns

1. **`@ethersproject/abi`** is used heavily in `swapRouter.ts`, `approveAndCall.ts`, `multicallExtended.ts`, and `paymentsExtended.ts` for ABI encoding via `Interface.encodeFunctionData()`
2. **`@ethersproject/solidity`** is used in `encodeMixedRouteToPath.ts` for `solidityPacked()` encoding
3. **JSBI** is used in `constants.ts` (`ZERO`, `ONE`) and transitively through sdk-core types
4. **Upstream SDK types** — Route, Trade, Pool, Pair classes from v2/v3/v4-sdk are used extensively and must align with modernized `@muniswap/*` equivalents
5. **ABI artifacts** from `@uniswap/swap-router-contracts` are used for encoding — these can be kept or inlined

---

## Phase 1: Scaffold & Configuration

**Goal**: Create the `packages/router-sdk` directory with modern tooling configuration. No source code yet.

### Tasks

- [ ] 1.1 Create `packages/router-sdk/` directory
- [ ] 1.2 Create `package.json` following v4-sdk pattern:
  - Name: `@muniswap/router-sdk`
  - `"type": "module"` with dual ESM/CJS exports
  - Scripts: build (tsup), test (vitest), lint (biome), typecheck (tsc)
  - Dependencies: `@muniswap/sdk-core`, `@muniswap/v2-sdk`, `@muniswap/v3-sdk`, `@muniswap/v4-sdk` (all workspace:*), `ox`, `tiny-invariant`, `@uniswap/swap-router-contracts`
  - DevDependencies: `@biomejs/biome`, `tsup`, `typescript`, `vitest`, `@vitest/coverage-v8`, `@types/node`
  - Node engines: `>=20`
- [ ] 1.3 Create `tsconfig.json` matching v3-sdk/v4-sdk pattern:
  - Target: ES2022, module: ESNext, moduleResolution: bundler
  - All strict options enabled (`noImplicitOverride`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`)
- [ ] 1.4 Create `tsup.config.ts` (ESM + CJS, dts, sourcemap, treeshake, target es2022)
- [ ] 1.5 Create `biome.json` matching existing SDK packages
- [ ] 1.6 Create `vitest.config.ts` with V8 coverage
- [ ] 1.7 Create placeholder `src/index.ts` to verify build works
- [ ] 1.8 Run `pnpm install` from root to register the new workspace package
- [ ] 1.9 Verify `pnpm build`, `pnpm typecheck`, and `pnpm test` pass for the new package

### Updated Dependency Chain

```
sdk-core  (base)
    ↓
v2-sdk    (depends on sdk-core)
    ↓
v3-sdk    (depends on sdk-core, v2-sdk)
    ↓
v4-sdk    (depends on sdk-core, v3-sdk)
    ↓
router-sdk (depends on sdk-core, v2-sdk, v3-sdk, v4-sdk)
```

---

## Phase 2: Port Entities & Types

**Goal**: Migrate the entity layer (Protocol, Route wrappers, Trade, MixedRoute). This is the foundation that everything else depends on.

### Tasks

- [ ] 2.1 Port `src/entities/protocol.ts` — Copy as-is (simple enum, no dependencies to update)
- [ ] 2.2 Port `src/utils/TPool.ts` — Update imports to `@muniswap/*` types (Pair, V3Pool, V4Pool)
- [ ] 2.3 Port `src/entities/mixedRoute/route.ts` (MixedRouteSDK):
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - Replace JSBI usage with native BigInt (midPrice computation)
  - Use `import type` for type-only imports
- [ ] 2.4 Port `src/entities/route.ts` (RouteV2, RouteV3, RouteV4, MixedRoute wrappers):
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - Verify IRoute interface aligns with modernized SDK types
- [ ] 2.5 Port `src/entities/trade.ts` (aggregated Trade class, 527 lines):
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - Replace all JSBI operations with native BigInt
  - Update Fraction/Percent/CurrencyAmount operations to match modernized sdk-core API
  - Verify `inputTax`/`outputTax` getters work with modernized Token type
- [ ] 2.6 Port `src/entities/mixedRoute/trade.ts` (MixedRouteTrade):
  - Same updates as 2.5
  - Verify tradeComparator function works with native BigInt
- [ ] 2.7 Port corresponding test files:
  - `src/entities/route.test.ts`
  - `src/entities/trade.test.ts`
  - `src/entities/mixedRoute/route.test.ts`
  - `src/entities/mixedRoute/trade.test.ts`
  - Convert from Jest syntax to Vitest (import `describe`, `it`, `expect` from `vitest`)
  - Replace JSBI in test fixtures with native BigInt
- [ ] 2.8 Run `pnpm test` and `pnpm typecheck` — all entity tests pass

---

## Phase 3: Port Utilities

**Goal**: Migrate utility functions that the router encoding layer depends on.

### Tasks

- [ ] 3.1 Port `src/utils/pathCurrency.ts`:
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - Verify logic for V4 native currency detection works with modernized types
- [ ] 3.2 Port `src/utils/encodeMixedRouteToPath.ts` (112 lines):
  - Replace `@ethersproject/solidity` `pack()` with `ox` `AbiParameters.encodePacked()`
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - Update fee placeholder constants to use native BigInt
  - This is the most complex utility — verify hex encoding output matches legacy
- [ ] 3.3 Port `src/utils/index.ts`:
  - Replace `@uniswap/*` imports with `@muniswap/*`
  - `partitionMixedRouteByProtocol()` and `getOutputOfPools()` should need minimal changes
- [ ] 3.4 Port `src/constants.ts`:
  - Remove JSBI import; replace `JSBI.BigInt(0)` / `JSBI.BigInt(1)` with `0n` / `1n`
  - Keep address constants and fee placeholders
  - Convert fee placeholder arithmetic to native BigInt if applicable
- [ ] 3.5 Port corresponding test files:
  - `src/utils/encodeMixedRouteToPath.test.ts`
  - `src/utils/pathCurrency.test.ts`
  - Convert Jest → Vitest imports
  - Verify encoded path output matches expected hex strings
- [ ] 3.6 Run `pnpm test` and `pnpm typecheck` — all utility tests pass

---

## Phase 4: Port Router Encoding Layer

**Goal**: Migrate the core router functionality — SwapRouter, ApproveAndCall, MulticallExtended, PaymentsExtended. This is the largest and most complex phase.

### Tasks

- [ ] 4.1 Port `src/multicallExtended.ts` (48 lines):
  - Replace `@ethersproject/abi` `Interface` with ox ABI encoding
  - Replace `@uniswap/v3-sdk` Multicall import with `@muniswap/v3-sdk`
  - Replace `@uniswap/swap-router-contracts` ABI usage — either keep the package or inline the ABI
  - Method: `encodeMulticall()` encodes `multicall(uint256,bytes[])` or `multicall(bytes32,bytes[])` — rewrite using ox `AbiParameters.encode()` or `Hex.concat()`
- [ ] 4.2 Port `src/paymentsExtended.ts` (76 lines):
  - Replace `@ethersproject/abi` with ox
  - Replace `@uniswap/v3-sdk` Payments import with `@muniswap/v3-sdk`
  - Encoding methods: `unwrapWETH9`, `sweepToken`, `pull`, `wrapETH` — rewrite `Interface.encodeFunctionData()` calls using ox
- [ ] 4.3 Port `src/approveAndCall.ts` (130 lines):
  - Replace `@ethersproject/abi` with ox
  - Replace `@uniswap/v3-sdk` and `@uniswap/v4-sdk` imports with `@muniswap/*`
  - Convert JSBI comparisons in approval type logic to native BigInt
  - Rewrite `Interface.encodeFunctionData()` calls using ox
- [ ] 4.4 Port `src/swapRouter.ts` (692 lines — largest file):
  - Replace `@ethersproject/abi` with ox for all `Interface.encodeFunctionData()` calls
  - Replace all `@uniswap/*` imports with `@muniswap/*`
  - Replace JSBI operations with native BigInt throughout
  - Key methods to port:
    - `encodeV2Swap()` — straightforward ABI encoding
    - `encodeV3Swap()` — single/multi-hop V3 encoding
    - `encodeMixedRouteSwap()` — complex multi-protocol encoding
    - `encodeSwaps()` — consolidation with slippage/native handling
    - `swapCallParameters()` — public API method
    - `swapAndAddCallParameters()` — swap + liquidity
    - `riskOfPartialFill()` — risk detection
  - **ABI encoding strategy**: Define ABI fragments as ox-compatible tuples, then use `AbiFunction.encodeData()` or equivalent
- [ ] 4.5 Port corresponding test files:
  - `src/swapRouter.test.ts` (~800 lines)
  - `src/multicallExtended.test.ts`
  - `src/paymentsExtended.test.ts`
  - Convert Jest → Vitest
  - Replace JSBI in test fixtures
  - Verify encoded calldata matches expected hex values
- [ ] 4.6 Update `src/index.ts` to re-export all modules
- [ ] 4.7 Run `pnpm test` and `pnpm typecheck` — all tests pass

### ABI Encoding Migration Strategy

The legacy code uses `@ethersproject/abi` `Interface` class extensively:

```typescript
// Legacy pattern (used throughout swapRouter, approveAndCall, etc.)
import { Interface } from '@ethersproject/abi'
import ISwapRouter02 from '@uniswap/swap-router-contracts/.../SwapRouter02.json'

const iface = new Interface(ISwapRouter02.abi)
const calldata = iface.encodeFunctionData('exactInputSingle', [params])
```

**Recommended ox replacement**:

```typescript
// Option A: Using ox AbiFunction
import { AbiFunction } from 'ox'

const exactInputSingle = AbiFunction.from(
  'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))'
)
const calldata = AbiFunction.encodeData(exactInputSingle, [params])
```

```typescript
// Option B: Inline ABI definitions (avoids swap-router-contracts dependency)
const swapRouterAbi = [
  { type: 'function', name: 'exactInputSingle', inputs: [...], outputs: [...] },
  // ...
] as const
```

Choose Option A or B based on whether `@uniswap/swap-router-contracts` should remain as a dependency. Option B is cleaner long-term but requires manually defining the ABI fragments.

---

## Phase 5: Validation & Build Verification

**Goal**: Ensure the modernized package is production-ready.

### Tasks

- [ ] 5.1 Run full test suite: `pnpm test` — all tests pass
- [ ] 5.2 Run type checking: `pnpm typecheck` — no errors
- [ ] 5.3 Run linting: `pnpm lint` — no warnings or errors
- [ ] 5.4 Run build: `pnpm build` — verify dist/ output:
  - `dist/index.js` (ESM)
  - `dist/index.cjs` (CJS)
  - `dist/index.d.ts` (type declarations)
  - `dist/index.d.cts` (CJS type declarations)
- [ ] 5.5 Run `pnpm lint:fix` and `pnpm format` to ensure code style conformance
- [ ] 5.6 Verify bundle size is reasonable (should be smaller without ethers/JSBI)
- [ ] 5.7 Run full monorepo build from root: `pnpm build` — no regressions
- [ ] 5.8 Run full monorepo tests from root: `pnpm test` — no regressions
- [ ] 5.9 Verify the package exports are correct by checking imports resolve

---

## Phase 6: Integration & Documentation

**Goal**: Integrate router-sdk into the monorepo ecosystem and update documentation.

### Tasks

- [ ] 6.1 Update root `turbo.json` if needed to include router-sdk in the build pipeline
- [ ] 6.2 Update `CLAUDE.md` package dependency chain to include router-sdk
- [ ] 6.3 Add router-sdk to `pnpm-workspace.yaml` (should auto-detect from `packages/*` glob)
- [ ] 6.4 Verify `pnpm build` builds router-sdk in correct order (after v4-sdk)
- [ ] 6.5 Update docs site (`apps/docs/`) with router-sdk API documentation if applicable
- [ ] 6.6 Write CHANGELOG entry documenting the modernization

---

## Risk Assessment

### High Risk

| Item | Risk | Mitigation |
|------|------|------------|
| ABI encoding parity | ox `AbiFunction.encodeData()` must produce identical calldata to `@ethersproject/abi` | Compare hex output in tests byte-for-byte |
| Mixed route path encoding | `solidityPacked()` replacement with `AbiParameters.encodePacked()` must match | Test with known hex fixtures |
| BigInt overflow/underflow | Native BigInt has no size limits but Solidity uint256 does | Validate ranges at boundaries |

### Medium Risk

| Item | Risk | Mitigation |
|------|------|------------|
| Type compatibility | `@muniswap/*` types may have subtle differences from `@uniswap/*` | Compile-time checking + tests |
| Trade aggregation math | Price impact, slippage calculations changing from JSBI to BigInt | Verify numerical precision in tests |
| V4 pool edge cases | Fake ETH/WETH pools (tickSpacing=0) behavior | Port all existing edge case tests |

### Low Risk

| Item | Risk | Mitigation |
|------|------|------------|
| Config files | Tooling config is well-established from other packages | Copy from v4-sdk |
| Protocol enum | Trivial migration | Copy as-is |
| Test conversion | Jest → Vitest API is nearly identical | Find-replace imports |

---

## Estimated Complexity by File

| File | Lines | Complexity | Notes |
|------|-------|------------|-------|
| `swapRouter.ts` | 692 | **High** | Heaviest ABI encoding, most JSBI usage |
| `entities/trade.ts` | 527 | **High** | Complex BigInt math, Fraction operations |
| `entities/mixedRoute/route.ts` | 137 | **Medium** | ETH/WETH edge cases, midPrice |
| `entities/mixedRoute/trade.ts` | ~150 | **Medium** | Similar to trade.ts |
| `approveAndCall.ts` | 130 | **Medium** | ABI encoding + approval logic |
| `utils/encodeMixedRouteToPath.ts` | 112 | **Medium** | solidityPacked replacement |
| `entities/route.ts` | 95 | **Low** | Thin wrappers, mostly imports |
| `paymentsExtended.ts` | 76 | **Low** | Simple ABI encoding |
| `utils/index.ts` | 56 | **Low** | Pure logic, minimal deps |
| `multicallExtended.ts` | 48 | **Low** | Simple ABI encoding |
| `utils/pathCurrency.ts` | 37 | **Low** | Pure logic |
| `constants.ts` | 25 | **Low** | Replace JSBI constants |
| `entities/protocol.ts` | 6 | **Trivial** | Copy as-is |
| `utils/TPool.ts` | 5 | **Trivial** | Update imports |
