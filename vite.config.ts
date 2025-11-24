import { Plugin, UserConfig, defineConfig } from "vite";
import path, { dirname } from "path";
import builtins from "builtin-modules";
import { fileURLToPath } from "url";
import fs from "fs"
import copy from "rollup-plugin-copy"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import manifest from "./manifest.json" with { type: "json" }
const PLUGIN_PATH = path.join('~/Documents/Obsidian/Vaults/The Dev Lab', '.obsidian', 'plugins', manifest.id)

export default defineConfig(async ({ mode }) => {
	const { resolve } = path;
	const prod = mode === "production";

	const hotReloadPlugin: Plugin = {
		name: "hot-reload",
		writeBundle: {
			sequential: true,
			order: 'post',
			handler: () => {
				if (!prod) {
					const hotReloadPath = path.join("../../", `${manifest.id}.git`, '.hotreload')
					fs.writeFileSync(hotReloadPath, '')
				}
			}
		}
	}

	return {
		plugins: [
			copy({
				targets: [{
					src: ["./dist/main.js", "./dist/styles.css", "./manifest.json"],
					dest: [`../../${manifest.id}.git`]
				}],
				hook: 'writeBundle'
			}),
			hotReloadPlugin
		],
		resolve: {
			alias: {
				"~": path.resolve(__dirname, "./src"),
			},
		},
		build: {
			lib: {
				entry: resolve(__dirname, "src/index.ts"),
				name: "main",
				fileName: () => "main.js",
				formats: ["cjs"],
			},
			minify: prod,
			sourcemap: prod ? false : "inline",
			cssCodeSplit: false,
			emptyOutDir: false,
			outDir: "dist",
			rollupOptions: {
				input: {
					main: resolve(__dirname, "src/index.ts"),
				},
				output: {
					entryFileNames: "main.js",
					assetFileNames: "styles.css",
				},
				external: [
					"obsidian",
					"electron",
					"@codemirror/autocomplete",
					"@codemirror/collab",
					"@codemirror/commands",
					"@codemirror/language",
					"@codemirror/lint",
					"@codemirror/search",
					"@codemirror/state",
					"@codemirror/view",
					"@lezer/common",
					"@lezer/highlight",
					"@lezer/lr",
					...builtins,
				],
			},
		},
	} as UserConfig;
});
