# Muniswap SDKs

A TypeScript monorepo containing SDK packages for interacting with Uniswap V2, V3, and V4 protocols. Built with modern tooling including native BigInt support and the [ox](https://oxlib.sh/) type-safe RPC library.

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
└── publishing/         # Release configuration
```

The SDK packages form a dependency chain:

```
sdk-core → v2-sdk → v3-sdk → v4-sdk
```

## Tech Stack

| Category | Tool |
|----------|------|
| Runtime | Node.js >= 20 |
| Package Manager | pnpm >= 9 |
| Build Orchestration | Turbo |
| Bundler | tsup (ESM + CJS dual output) |
| TypeScript | v5.6+ with strict mode |
| Testing | Vitest with V8 coverage |
| Linting/Formatting | Biome |
| Ethereum Utils | ox |

## Getting Started

```bash
# Clone (include submodules for reference SDKs)
git clone --recurse-submodules https://github.com/Jds-23/muniswap-sdks.git
cd muniswap-sdks

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

## Development Commands

```bash
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
pnpm docs:dev       # Local dev server
pnpm docs:build     # Build for production

# Clean everything
pnpm clean
```

### Per-Package Commands

Run from within any package directory:

```bash
pnpm build            # Build the package
pnpm dev              # Watch mode
pnpm test             # Run tests
pnpm test:watch       # Tests in watch mode
pnpm test:coverage    # Run with coverage report
pnpm lint             # Check with Biome
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format code
pnpm typecheck        # Type check
```

## Publishing SDKs

Publishing of each SDK is done on merge to main using semantic-release and semantic-release-monorepo. PR titles and commits follow Angular conventional commits:

| Commit Format | Release |
|---------------|---------|
| `fix(<SDK name>):` | Patch version |
| `<type>(public):` | Patch version |
| `feat(<SDK name>):` | Minor version |
| `feat(breaking):` | Major version |
| `chore(<scope>):` | No release |

Versions are only generated based on the changelog of the relevant SDK's folder/files.
