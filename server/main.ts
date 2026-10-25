import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CharacterStore } from "./store.js";
import { createStudioServer } from "./http.js";
import { CharacterService } from "../src/application/CharacterService.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
import { CodexCommandInterpreter } from "./CodexCommandInterpreter.js";
import { ExampleCommandInterpreter } from "../src/adapters/ExampleCommandInterpreter.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SOFTFORM_PORT ?? 4317);
const mode = process.argv.includes("--demo")
  ? "local"
  : (process.env.CHARACTER_CHAT_MODE ?? "codex");
const model = process.env.CHARACTER_CODEX_MODEL ?? "gpt-6.1-sol";
const server = createStudioServer(
  new CharacterService(
    new CharacterStore(
      resolve(
        process.env.SOFTFORM_DATA_DIR ?? resolve(root, ".data"),
        "character.json",
      ),
    ),
    new ExampleCommandInterpreter(
      mode === "local"
        ? new LocalCommandInterpreter()
        : new CodexCommandInterpreter({
            executable: process.env.CHARACTER_CODEX_PATH ?? "codex",
            model,
            runtimeDirectory: resolve(root, ".data/ai-runtime"),
          }),
    ),
  ),
  resolve(root, "dist"),
  { chatMode: mode === "local" ? "local" : "codex", model },
);
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Character Studio ready: http://127.0.0.1:${port} (${mode}: ${model})`,
  ),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
const shutdown = () => {
  server.closeAllConnections();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
