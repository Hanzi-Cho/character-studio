import { build } from "esbuild";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { basename } from "node:path";
const webDemo = process.argv.includes("--web-demo");
const output = webDemo ? "dist-web" : "dist";
await mkdir(output, { recursive: true });
if (webDemo) {
  const profile = await build({
    entryPoints: ["src/profile/main.ts"],
    outdir: output,
    entryNames: "profile-[hash]",
    metafile: true,
    bundle: true,
    format: "esm",
    target: ["es2022"],
    minify: true,
    legalComments: "eof",
  });
  const profileEntry = Object.entries(profile.metafile.outputs).find(
    ([, info]) => info.entryPoint === "src/profile/main.ts",
  );
  if (!profileEntry) throw new Error("Profile viewer entry is missing");
  await writeFile(
    `${output}/profile.html`,
    (await readFile("profile.html", "utf8")).replace(
      "./profile.js",
      `./${basename(profileEntry[0])}`,
    ),
  );
}
const result = await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  ...(webDemo
    ? { outdir: output, entryNames: "app-[hash]", metafile: true }
    : { outfile: `${output}/app.js` }),
  format: "esm",
  target: ["es2022"],
  minify: true,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    __WEB_DEMO__: String(webDemo),
  },
});
if (webDemo) {
  const entry = Object.entries(result.metafile.outputs).find(
    ([, info]) => info.entryPoint === "src/main.tsx",
  );
  if (!entry?.[1].cssBundle)
    throw new Error("Web demo entry assets are missing");
  const html = (await readFile("index.html", "utf8"))
    .replace("./app.js", `./${basename(entry[0])}`)
    .replace("./app.css", `./${basename(entry[1].cssBundle)}`);
  await writeFile(`${output}/index.html`, html);
  await writeFile(`${output}/.nojekyll`, "");
} else await copyFile("index.html", `${output}/index.html`);
console.log(`Built Character Studio → ${output}`);
