import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import coffee from "coffeescript";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const srcEntry = path.join(rootDir, "src", "main.ts");

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

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

rm(distDir);
fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });

// Copy static assets
copyDir(publicDir, distDir);

// Copy index.html
fs.copyFileSync(path.join(rootDir, "index.html"), path.join(distDir, "index.html"));

await build({
  entryPoints: [srcEntry],
  bundle: true,
  sourcemap: true,
  format: "esm",
  target: ["es2020"],
  outfile: path.join(distDir, "assets", "app.js"),
  plugins: [coffeePlugin],
  loader: {
    ".png": "file",
    ".jpg": "file",
    ".jpeg": "file",
    ".svg": "file",
    ".webp": "file",
  },
  logLevel: "info",
});
