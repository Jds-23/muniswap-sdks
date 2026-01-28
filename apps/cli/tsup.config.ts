import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Bundle SDK dependencies to avoid ESM JSON import issues
	noExternal: [
		"@muniswap/sdk-core",
		"@muniswap/v4-sdk",
		"@muniswap/v3-sdk",
	],
});
