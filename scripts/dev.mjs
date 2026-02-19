import { context } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import coffee from "coffeescript";

const coffeePlugin = {
  name: "coffee",
  setup(buildApi) {
    buildApi.onLoad({ filter: /\.coffee$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, "utf8");
      const compiled = coffee.compile(source, { bare: true, filename: args.path });
      return { contents: compiled, loader: "js" };
    });
  },
};

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });

// Copy static assets and index.html for dev (simple approach)
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
copyDir(publicDir, distDir);
fs.copyFileSync(path.join(rootDir, "index.html"), path.join(distDir, "index.html"));

const ctx = await context({
  entryPoints: [path.join(rootDir, "src", "main.ts")],
  bundle: true,
  sourcemap: true,
  format: "esm",
  target: ["es2020"],
  outfile: path.join(distDir, "assets", "app.js"),
  plugins: [coffeePlugin],
  logLevel: "info",
});

await ctx.watch();

const { host, port } = await ctx.serve({
  servedir: distDir,
  port: 5173,
});

console.log(`Dev server running on http://${host}:${port}`);
