import { ChiikawaModel } from "./adapters/ChiikawaModel.js";
import { ThreeCharacterRenderer } from "./adapters/ThreeCharacterRenderer.js";
import { HttpStudioGateway } from "./adapters/HttpStudioGateway.js";
import { ChatDock } from "./components/ChatDock.js";
import type { StudioRuntime } from "./presentation/ports.js";

/** The only browser composition root choosing concrete transport, model and chat UI. */
export function createStudioRuntime(): StudioRuntime {
  return {
    gateway: new HttpStudioGateway(),
    createRenderer: (host, onError) => {
      const model = new ChiikawaModel();
      try {
        return new ThreeCharacterRenderer(host, onError, model);
      } catch (error) {
        model.dispose();
        throw error;
      }
    },
    ChatPanel: ChatDock,
  };
}
