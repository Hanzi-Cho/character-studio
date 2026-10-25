import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
const webDemo = process.argv.includes("--web-demo");
const output = webDemo ? "dist-web" : "dist";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: `${output}/app.js`,
  format: "esm",
  target: ["es2022"],
  minify: true,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    __WEB_DEMO__: String(webDemo),
  },
});
await copyFile("index.html", `${output}/index.html`);
if (webDemo) await writeFile(`${output}/.nojekyll`, "");
console.log(`Built Character Studio → ${output}`);
