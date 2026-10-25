import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { PatchSchema } from "../src/domain/character.js";
import { EditPlanSchema } from "../src/domain/editPlan.js";

const port = Number(process.env.SOFTFORM_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid SOFTFORM_PORT");
const base = `http://127.0.0.1:${port}`;
const server = new McpServer({ name: "character-studio", version: "0.2.0" });
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
      signal: AbortSignal.timeout(path === "/api/command" ? 160000 : 5000),
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
          text: "Character Studio 로컬 앱을 먼저 실행해 주세요. 앱과 같은 PC에서 연결해야 합니다.",
        },
      ],
    };
  }
}
server.registerTool(
  "get_character",
  {
    description:
      "Read the current local 3D character and revision. Call before changing it. The user can see changes in their running Character Studio browser.",
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
      "Submit natural language to the app's configured interpreter (Codex by default). Prefer apply_edit_plan to serialize edits yourself without a second model call. Read revision first. Reset only on user request.",
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
server.registerTool(
  "apply_edit_plan",
  {
    description:
      "Apply multiple validated edits atomically to the visible Chiikawa. Read get_character first. set changes a base property. upsert_part adds/replaces a stable id: recipes wings, shirt, cape, hat, crown, glasses, scarf, bow, star; custom creates new geometry from bounded primitives. Preserve unrelated parts. Part fields: id,label,kind,anchor,color,accentColor,position/rotation/scale triples,components. Default transforms [0,0,0]/[0,0,0]/[1,1,1], components [] for recipes. Anchors head,face,neck,body,back,leftEar,rightEar. Read get_model_capabilities for recipe guidance. Never claim Blender or arbitrary mesh generation. Undo/reset only when requested.",
    inputSchema: z
      .object({ revision: z.number().int().min(0), plan: EditPlanSchema })
      .strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: false,
    },
  },
  (args) => call("/api/plan", args),
);
server.registerTool(
  "get_model_capabilities",
  {
    description:
      "Read character recipe/primitive editing rules and supported limits.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          recipes: {
            wings: "back; pair of feathers",
            shirt: "body; fitted top",
            cape: "back",
            hat: "head",
            crown: "head",
            glasses: "face",
            scarf: "neck",
            bow: "neck",
            star: "rightEar",
          },
          custom:
            "Use kind custom and 1-32 components. shapes sphere(radius1), box(size1), cylinder/cone(radius.5,height1), torus(radius.5,tube.1 XY), capsule(radius.5,totalheight2), star(radius.5). Each component has shape,color,position,rotation(degrees),scale. Character height3.3/headwidth2.32. Front is +z; up+y. Bounded JSON data only.",
          limits: {
            parts: 12,
            componentsPerPart: 32,
            totalComponents: 128,
            operations: 24,
          },
          persistence:
            "All operations in a plan commit together. Undo reverts one plan. Existing saved parts survive restarts. Unsupported requests must be explained without edits.",
        }),
      },
    ],
  }),
);
await server.connect(new StdioServerTransport());
