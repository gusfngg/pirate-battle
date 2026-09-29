import "@fontsource/lilita-one/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./styles/index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "./api/queries";
import { App } from "./app/App";
import { leaveInterruptedMatch } from "./app/router";
import { sounds } from "./game/audio/sound-board";
import { startMockApi } from "./mocks/browser";

leaveInterruptedMatch();

// navegadores só liberam áudio depois de um gesto do usuário
window.addEventListener("pointerdown", () => sounds.unlock(), { once: true });
window.addEventListener("keydown", () => sounds.unlock(), { once: true });

const queryClient = createQueryClient();

function render() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

// o jogo abre mesmo se o service worker falhar, só o ranking fica fora do ar
startMockApi()
  .catch((error: unknown) => console.warn("mock api could not start, ranking and history will be offline", error))
  .finally(render);
