import { lazy, Suspense, useEffect, useRef } from "react";
import { useMatchSync } from "@/api/queries";
import { NetworkLab } from "@/mocks/NetworkLab";
import { SoundToggle } from "@/ui/SoundToggle";
import { LogbookScreen } from "@/screens/LogbookScreen";
import { MenuScreen } from "@/screens/MenuScreen";
import { OptionsScreen } from "@/screens/OptionsScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { useRoute, type Route } from "./router";

// o pixi só é baixado quando a partida começa, os menus abrem mais leves
const PlayScreen = lazy(() => import("@/play/PlayScreen").then((module) => ({ default: module.PlayScreen })));

const TITLES: Record<Route, string> = {
  menu: "Pirate Battle",
  options: "Options · Pirate Battle",
  ranking: "Ranking · Pirate Battle",
  history: "Match history · Pirate Battle",
  play: "Battle · Pirate Battle",
  result: "Result · Pirate Battle",
};

export function App() {
  const route = useRoute();
  useMatchSync();
  const previous = useRef(route);

  // ao trocar de tela, o foco vai pro título pra quem navega por teclado ou leitor de tela
  useEffect(() => {
    document.title = TITLES[route];
    if (previous.current === route) return;
    previous.current = route;
    if (document.activeElement && document.activeElement !== document.body) return;
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [route]);

  return (
    <>
      {route === "menu" && <MenuScreen />}
      {route === "options" && <OptionsScreen />}
      {(route === "ranking" || route === "history") && <LogbookScreen tab={route} />}
      {route === "play" && (
        <Suspense fallback={<LoadingScreen />}>
          <PlayScreen key="play" />
        </Suspense>
      )}
      {route === "result" && <ResultScreen />}
      {route !== "play" && <NetworkLab />}
      {route !== "play" && <SoundToggle className="sound-toggle--corner" />}
      <img className="brand" src="/game/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </>
  );
}

function LoadingScreen() {
  return (
    <main className="screen screen--menu">
      <div className="wood-panel loading-panel">
        <h1 className="panel-title">Setting sail</h1>
        <p className="panel-note" role="status">
          Preparing the fleet…
        </p>
      </div>
    </main>
  );
}
