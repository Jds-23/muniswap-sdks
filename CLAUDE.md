# CLAUDE.md

This document provides guidance for AI assistants working with the muniswap-sdks monorepo.

## Project Overview

A TypeScript monorepo containing Uniswap SDK packages for interacting with Uniswap V2, V3, and V4 protocols. Built with modern tooling including native BigInt support and the `ox` type-safe RPC library.

## Repository Structure

```
muniswap-sdks/
├── packages/           # SDK packages (published to npm)
│   ├── sdk-core/       # @muniswap/sdk-core - Core entities and utilities
│   ├── v2-sdk/         # @muniswap/v2-sdk - V2 protocol support
│   ├── v3-sdk/         # @muniswap/v3-sdk - V3 protocol support
│   └── v4-sdk/         # @muniswap/v4-sdk - V4 protocol with hooks
├── apps/               # Application packages (not published)
│   ├── cli/            # @muniswap/cli - Command-line tools
│   ├── docs/           # @muniswap/docs - Documentation site (Vocs)
│   └── ui/             # @muniswap/ui - React UI application
├── external/           # Git submodule (Uniswap/sdks reference)
├── publishing/         # Release configuration
└── .claude/            # Claude AI prompts for PR reviews
```

## Tech Stack

- **Runtime**: Node.js >= 20
- **Package Manager**: pnpm >= 9 (workspace monorepo)
- **Build Orchestration**: Turbo v2.3
- **Bundler**: tsup (ESM + CJS dual output)
- **TypeScript**: v5.6+ with strict mode
- **Testing**: Vitest with V8 coverage
- **Linting/Formatting**: Biome (replaces ESLint + Prettier)
- **Documentation**: Vocs (deployed to Cloudflare Pages)

## Essential Commands

```bash
# Install dependencies
pnpm install

# Build all packages (uses Turbo caching)
pnpm build

# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Lint all packages
pnpm lint

# Development mode (watch)
pnpm dev

# Documentation
pnpm docs:dev     # Local dev server
pnpm docs:build   # Build for production

# Clean everything
pnpm clean
```

### Per-Package Commands

Run from within any package directory:

```bash
pnpm build          # Build the package
pnpm dev            # Watch mode
pnpm test           # Run tests
pnpm test:watch     # Tests in watch mode
pnpm test:coverage  # Run with coverage report
pnpm lint           # Check with Biome
pnpm lint:fix       # Auto-fix lint issues
pnpm format         # Format code
pnpm typecheck      # Type check
```

## Package Dependencies

The SDK packages form a dependency chain:

```
sdk-core  (base - no SDK dependencies)
    ↓
v2-sdk    (depends on sdk-core)
    ↓
v3-sdk    (depends on sdk-core, v2-sdk)
    ↓
v4-sdk    (depends on sdk-core, v3-sdk)
```

When modifying a base package, run `pnpm build` from root to rebuild dependents.

## Code Style Conventions

### Biome Configuration (SDK packages)

- **Indentation**: 2 spaces
- **Line width**: 120 characters
- **Quotes**: Single quotes
- **Semicolons**: Only as needed (ASI)
- **Trailing commas**: ES5 style

### TypeScript Configuration

- **Target**: ES2022
- **Strict mode**: Enabled with additional checks
- **Module**: ESNext with bundler resolution
- Key strict options:
  - `noImplicitOverride`
  - `noUnusedLocals` and `noUnusedParameters`
  - `noUncheckedIndexedAccess`
  - `exactOptionalPropertyTypes`
  - `verbatimModuleSyntax`

### Import Style

Use `type` keyword for type-only imports:

```typescript
import type { Token } from './token'
import { Currency } from './currency'
```

## Testing Guidelines

- Tests use Vitest and live alongside source files or in `src/__tests__/`
- Coverage targets: text, json, html reports
- Run tests after building: `pnpm build && pnpm test`

Example test structure:

```typescript
import { describe, it, expect } from 'vitest'
import { Token } from '../token'

describe('Token', () => {
  it('should create a valid token', () => {
    const token = new Token(1, '0x...', 18, 'TEST')
    expect(token.decimals).toBe(18)
  })
})
```

## Commit Message Conventions

Follow Angular conventional commits for semantic versioning:

```
feat(sdk-core): add new chain support       # Minor version bump
fix(v3-sdk): correct tick math calculation  # Patch version bump
feat(breaking): remove deprecated API       # Major version bump
chore(docs): update documentation           # No release
```

- `fix(<SDK name>):` triggers patch version
- `feat(<SDK name>):` triggers minor version
- `feat(breaking):` triggers major version
- `<type>(public):` triggers patch version
- `chore(<scope>):` no release

## Key Dependencies

- **ox**: Type-safe Ethereum RPC library (replaces ethers utilities)
- **tiny-invariant**: Runtime assertions
- **zod**: Schema validation (sdk-core)
- **viem**: Ethereum client (apps/cli, apps/ui)
- **wagmi**: React hooks for Ethereum (apps/ui)

## Working with the SDKs

### Adding a New Chain

1. Add chain ID to `packages/sdk-core/src/chains.ts`
2. Add WETH9 address to `packages/sdk-core/src/weth9.ts`
3. Update relevant address mappings in `packages/sdk-core/src/addresses.ts`

### Adding a New Entity

1. Create entity file in appropriate package's `src/entities/`
2. Export from the package's `src/index.ts`
3. Add tests in `src/__tests__/` or alongside the file
4. Update documentation in `apps/docs/pages/`

### Modifying Contract Interfaces

V3 and V4 SDKs wrap contract ABIs. When updating:

1. Update ABI definitions in `src/abis/`
2. Regenerate types if using codegen
3. Update wrapper functions in `src/`

## CI/CD

### Workflows (`.github/workflows/`)

- **publish.yml**: Manual NPM publishing with dry-run option
- **deploy-docs.yml**: Auto-deploy docs on push to main

### Publishing

Packages use provenance-enabled npm publishing:

```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

## Common Tasks for AI Assistants

### Before Making Changes

1. Run `pnpm build` to ensure baseline builds
2. Run `pnpm test` to confirm tests pass
3. Read relevant source files before editing

### After Making Changes

1. Run `pnpm typecheck` to verify types
2. Run `pnpm lint:fix` to auto-fix style issues
3. Run `pnpm test` to verify tests still pass
4. Run `pnpm build` to confirm build succeeds

### Code Review Priorities

When reviewing code (from `.claude/prompts/`):

**Phase 1 - Critical (blockers)**:
- Bugs or logic errors
- Security vulnerabilities
- Performance problems
- Data corruption risks
- Race conditions

**Phase 2 - Patterns (rarely blockers)**:
- Functions doing too many things
- Hidden dependencies
- Missing error handling

**Phase 3 - Polish (mention if obvious)**:
- Naming improvements
- Test coverage gaps
- Documentation

### Communication Style

- Be direct and brief
- Review code, not the coder
- Teach through specific examples
- One issue, one or two lines
- Skip emojis and "Why this matters" sections
- When in doubt, approve

## External References

- **Uniswap Reference SDKs**: `external/uniswap-sdks` (git submodule)
- **Original Repo**: https://github.com/Uniswap/sdks

## Notes

- The root README.md mentions `yarn` but this repo uses `pnpm`
- Apps (cli, docs, ui) are private packages not published to npm
- The UI app uses different Biome settings (double quotes, semicolons always)
- The CLI app uses tabs for indentation
