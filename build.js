import { context } from "esbuild";

const isProduction = process.env.NODE_ENV === "production";

const ctx = await context({
	entryPoints: ["./src/index.ts"],
	outdir: "./dist",
	minify: isProduction,
	target: "es2022",
	bundle: true,
	format: "esm",
	platform: "neutral",
	sourcemap: false,
});

if (isProduction === false) {
	await ctx.watch();

	console.info("Watchig for changes");
} else {
	await ctx.rebuild();
	await ctx.dispose();
}
