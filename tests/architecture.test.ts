import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(path, entry.name)]
        : [],
  );
}
test("domain/application, presentation, HTTP and rendering obey replaceable boundaries", () => {
  for (const path of [...files("src"), "server/http.ts"]) {
    const name = relative(".", path).replaceAll("\\", "/");
    // Guard static source imports (not a security sandbox or a general TS parser).
    const imports = [
      ...readFileSync(path, "utf8").matchAll(
        /\b(?:from\s+|import\s*)["']([^"']+)["']/g,
      ),
    ].map((match) => match[1]);
    for (const dependency of imports) {
      if (/^src\/(domain|application)\//.test(name))
        assert.ok(
          !/react|three|node:|adapters|components|presentation|server/.test(
            dependency,
          ),
          `${name} -> ${dependency}`,
        );
      if (/^src\/(presentation|components)\/|^src\/App.tsx$/.test(name))
        assert.ok(
          !/adapters|server|three/.test(dependency),
          `${name} -> ${dependency}`,
        );
      if (name === "server/http.ts")
        assert.ok(
          !/store|LocalCommandInterpreter/.test(dependency),
          `${name} -> ${dependency}`,
        );
      if (name === "src/adapters/ThreeCharacterRenderer.ts")
        assert.ok(
          !/Chiikawa|HttpStudio|LocalCommand/.test(dependency),
          `${name} -> ${dependency}`,
        );
    }
  }
});
