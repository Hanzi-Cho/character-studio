import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { PatchSchema } from "../src/domain/character.js";

const port = Number(process.env.SOFTFORM_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid SOFTFORM_PORT");
const base = `http://127.0.0.1:${port}`;
const server = new McpServer({ name: "softform-studio", version: "0.1.0" });
async function call(path: string, body?: unknown) {
  try {
    const response = await fetch(`${base}${path}`, {
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      ...(response.ok ? { structuredContent: data } : { isError: true }),
    };
  } catch {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: "Softform Studio 로컬 앱을 먼저 실행해 주세요. 앱과 같은 PC에서 연결해야 합니다.",
        },
      ],
    };
  }
}
server.registerTool(
  "get_character",
  {
    description:
      "Read the current local 3D character and revision. Call before changing it. The user can see changes in their running Softform Studio browser.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  () => call("/api/state"),
);
server.registerTool(
  "update_character",
  {
    description:
      "Change only attributes requested by the user: hex colors, bounded proportions, expression, accessory, name. Read get_character first and use its revision. On conflict re-read and explain; never silently overwrite. This edits a procedural model, not arbitrary mesh generation.",
    inputSchema: z
      .object({ revision: z.number().int().min(0), patch: PatchSchema })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  (args) => call("/api/patch", args),
);
server.registerTool(
  "edit_character",
  {
    description:
      "Apply a supported local Korean/English editing command or undo/redo/reset to the visible character. Does not call an AI provider. Read revision first. Reset requires the user to request reset.",
    inputSchema: z
      .object({
        text: z.string().min(1).max(1000),
        revision: z.number().int().min(0),
      })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  (args) => call("/api/command", args),
);
await server.connect(new StdioServerTransport());
