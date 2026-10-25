import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CharacterStore } from "./store.js";
import { createStudioServer } from "./http.js";
import { CharacterService } from "../src/application/CharacterService.js";
import { LocalCommandInterpreter } from "../src/adapters/LocalCommandInterpreter.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SOFTFORM_PORT ?? 4317);
const server = createStudioServer(
  new CharacterService(
    new CharacterStore(
      resolve(
        process.env.SOFTFORM_DATA_DIR ?? resolve(root, ".data"),
        "character.json",
      ),
    ),
    new LocalCommandInterpreter(),
  ),
  resolve(root, "dist"),
);
server.listen(port, "127.0.0.1", () =>
  console.log(`Softform Studio ready: http://127.0.0.1:${port}`),
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
