import "@fontsource/lilita-one/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { leaveInterruptedMatch } from "./app/router";
import { sounds } from "./game/audio/sound-board";

leaveInterruptedMatch();

// navegadores só liberam áudio depois de um gesto do usuário
window.addEventListener("pointerdown", () => sounds.unlock(), { once: true });
window.addEventListener("keydown", () => sounds.unlock(), { once: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
