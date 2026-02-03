# Web3 SDK Modernization Guide

A phase-based guide for SDK maintainers migrating legacy web3 TypeScript SDKs to a modern tooling stack.

**Audience**: SDK maintainers with existing codebases
**Non-goals**: Greenfield project setup, framework comparisons

---

## Monorepo Structure

### Directory Layout

| Directory | Purpose |
|-----------|---------|
| `external/uniswap-sdks/sdks/` | Legacy reference SDKs (read-only submodule) |
| `packages/` | Modern SDKs (your work goes here) |

### Internal Dependency Mapping

When modernizing, replace `@uniswap/*` dependencies with workspace `@muniswap/*` packages:

| Legacy Dependency | Modern Replacement |
|-------------------|-------------------|
| `@uniswap/sdk-core` | `@muniswap/sdk-core` (workspace:*) |
| `@uniswap/v2-sdk` | `@muniswap/v2-sdk` (workspace:*) |
| `@uniswap/v3-sdk` | `@muniswap/v3-sdk` (workspace:*) |

Example from v4-sdk `package.json`:

```json
// Legacy (external/uniswap-sdks/sdks/v4-sdk)
"dependencies": {
  "@uniswap/sdk-core": "^7.10.1",
  "@uniswap/v3-sdk": "3.27.0"
}

// Modern (packages/v4-sdk)
"dependencies": {
  "@muniswap/sdk-core": "workspace:*",
  "@muniswap/v3-sdk": "workspace:*"
}
```

---

## Phase 1: Audit & Plan

Inventory your current stack before making changes.

### What to Audit

| Area | Legacy Examples | Modern Replacements |
|------|-----------------|---------------------|
| Package manager | yarn, npm | pnpm |
| Build orchestration | lerna, nx | turbo |
| Bundler | tsdx, rollup, webpack | tsup |
| Linter/formatter | eslint + prettier | biome |
| Test runner | jest, mocha | vitest |
| Ethereum utils | ethers.js, web3.js | ox |
| Big integers | JSBI, bn.js | native BigInt |

### Comparison Resources

- [Jest vs Vitest](https://vitest.dev/guide/comparisons.html)
- [ESLint vs Biome](https://biomejs.dev/linter/)
- [Why pnpm](https://pnpm.io/motivation)

### Checklist

- [ ] Audit `package.json` dependencies
- [ ] Document current build configuration
- [ ] Document current test configuration
- [ ] Document current lint/format configuration
- [ ] Identify deprecated or unmaintained dependencies

---

## Phase 2: Package Manager & Monorepo

Migrate from yarn/npm to pnpm with Turbo orchestration.

### pnpm Migration

```bash
# Install pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Remove old lockfile
rm -f yarn.lock package-lock.json

# Install dependencies (generates pnpm-lock.yaml)
pnpm install
```

### Workspace Configuration

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### Turbo Configuration

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json", "tsup.config.ts"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Checklist

- [ ] Install pnpm globally
- [ ] Remove old lockfile, run `pnpm install`
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json`
- [ ] Update CI workflows to use pnpm

---

## Phase 3: Build & Dev Tooling

Replace bundler, linter, and test runner.

### Bundler: tsup

Replace tsdx/rollup/webpack with tsup. Create `tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
})
```

### Linter/Formatter: Biome

Replace eslint + prettier with Biome. Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "off"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "noNonNullAssertion": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "es5"
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", "coverage"]
  }
}
```

### Test Runner: Vitest

Replace jest with Vitest. Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
})
```

### Update package.json Scripts

```json
{
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
  }
}
```

### Checklist

- [ ] Replace bundler with tsup
- [ ] Replace eslint + prettier with Biome
- [ ] Replace jest with Vitest
- [ ] Update package.json scripts
- [ ] Remove old config files (`.eslintrc`, `.prettierrc`, `jest.config.*`, etc.)

---

## Phase 4: Code Modernization

Update Ethereum utilities, BigInt usage, and TypeScript configuration.

### ethers.js to ox

Replace ethers.js utilities with ox equivalents:

#### Address Validation

```typescript
// Before (ethers)
import { getAddress } from 'ethers'
const checksummed = getAddress(address)

// After (ox)
import { Address } from 'ox'
const checksummed = Address.checksum(address)
```

#### Hashing

```typescript
// Before (ethers)
import { keccak256, toUtf8Bytes } from 'ethers'
const hash = keccak256(toUtf8Bytes('hello'))

// After (ox)
import { Hash, Hex } from 'ox'
const hash = Hash.keccak256(Hex.fromString('hello'))
```

#### ABI Encoding (Packed)

```typescript
// Before (ethers)
import { solidityPacked } from 'ethers'
const encoded = solidityPacked(
  ['address', 'address', 'uint24'],
  [token0, token1, fee]
)

// After (ox)
import { AbiParameters } from 'ox'
const encoded = AbiParameters.encodePacked(
  ['address', 'address', 'uint24'],
  [token0, token1, fee]
)
```

#### CREATE2 Address

```typescript
// Before (ethers)
import { getCreate2Address } from 'ethers'
const addr = getCreate2Address(factory, salt, initCodeHash)

// After (ox)
import { ContractAddress, Address } from 'ox'
const addr = ContractAddress.fromCreate2({
  from: factory,
  salt,
  bytecodeHash: initCodeHash,
})
```

#### Hex Utilities

```typescript
// Before (ethers)
import { hexlify, zeroPadValue, concat } from 'ethers'

// After (ox)
import { Hex } from 'ox'
Hex.fromBytes(bytes)
Hex.padLeft(value, 32)
Hex.concat(a, b, c)
```

### JSBI to Native BigInt

```typescript
// Before (JSBI)
import JSBI from 'jsbi'
const a = JSBI.BigInt('1000000000000000000')
const b = JSBI.add(a, JSBI.BigInt(1))
const c = JSBI.multiply(a, b)
const isGreater = JSBI.greaterThan(a, b)

// After (native BigInt)
const a = 1000000000000000000n
const b = a + 1n
const c = a * b
const isGreater = a > b
```

### TypeScript Strictness

Update `tsconfig.json` with strict options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ESM-First Package Exports

Update `package.json` with proper exports field:

```json
{
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20"
  }
}
```

### Checklist

- [ ] Replace ethers.js imports with ox
- [ ] Remove JSBI, use native BigInt
- [ ] Update tsconfig.json with strict options
- [ ] Update package.json exports field
- [ ] Use `import type` for type-only imports

---

## Phase 5: Validation

Verify the migration before releasing.

### Test Suite

```bash
# Run full test suite
pnpm test

# Compare coverage to baseline
pnpm test:coverage
```

### Type Checking

```bash
pnpm typecheck
```

### Build Verification

```bash
pnpm build

# Check bundle outputs exist
ls dist/
# Should contain: index.js, index.cjs, index.d.ts, index.d.cts
```

### Bundle Size

```bash
# Check bundle size (compare to pre-migration)
du -h dist/index.js dist/index.cjs
```

### API Compatibility

- Ensure no breaking changes to public API
- Run any existing integration tests
- Test imports from both ESM and CJS consumers

### Checklist

- [ ] All tests pass
- [ ] Type checking passes
- [ ] Build succeeds
- [ ] Bundle size is acceptable (ideally smaller)
- [ ] No breaking API changes (or intentionally documented)

---

## Phase 6: Documentation

Update your SDK's documentation to reflect the modernized stack.

### What to Update

- Installation instructions (pnpm instead of yarn/npm)
- Import examples (ESM-first syntax)
- API documentation for any changed signatures
- Migration guide for users upgrading from previous versions
- CHANGELOG entry documenting the modernization

### Checklist

- [ ] Update installation docs
- [ ] Update code examples
- [ ] Write migration guide (if breaking changes)
- [ ] Update CHANGELOG
- [ ] Verify docs build successfully

---

## Appendix

### Reference Documentation

- [pnpm](https://pnpm.io/motivation)
- [Turbo](https://turbo.build/repo/docs)
- [tsup](https://tsup.egoist.dev/)
- [Biome](https://biomejs.dev/)
- [Vitest](https://vitest.dev/)
- [ox](https://oxlib.sh/)

### Sample Migration PR Structure

```
feat(breaking): modernize SDK tooling

- Migrate from yarn to pnpm
- Replace tsdx with tsup (ESM + CJS dual output)
- Replace eslint + prettier with Biome
- Replace jest with Vitest
- Replace ethers.js with ox
- Replace JSBI with native BigInt
- Enable strict TypeScript options
- Update package.json exports for ESM-first

BREAKING CHANGE: Requires Node.js >= 20
BREAKING CHANGE: ESM is now the primary module format
```
