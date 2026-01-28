import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	// Bundle SDK dependencies to avoid ESM JSON import issues
	noExternal: [
		"@uniswap/sdk-core-next",
		"@uniswap/v4-sdk-next",
		"@uniswap/v3-sdk-next",
	],
});
