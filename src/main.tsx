import { createRoot } from "react-dom/client";
import App from "./App.js";
import { createStudioRuntime } from "./bootstrap.js";
import "./styles.css";
if (new URLSearchParams(location.search).has("benchmark")) {
  const { default: BatchBenchmark } = await import("./dev/BatchBenchmark.js");
  createRoot(document.getElementById("root")!).render(<BatchBenchmark />);
} else
  createRoot(document.getElementById("root")!).render(
    <App runtime={createStudioRuntime()} />,
  );
