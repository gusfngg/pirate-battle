import { useEffect, useRef } from "react";
import { PlayScreen } from "@/play/PlayScreen";
import { LogbookScreen } from "@/screens/LogbookScreen";
import { MenuScreen } from "@/screens/MenuScreen";
import { OptionsScreen } from "@/screens/OptionsScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { useRoute, type Route } from "./router";

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
  const first = useRef(true);

  // ao trocar de tela, o foco vai pro título pra quem navega por teclado ou leitor de tela
  useEffect(() => {
    document.title = TITLES[route];
    if (first.current) {
      first.current = false;
      return;
    }
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
      {route === "play" && <PlayScreen key="play" />}
      {route === "result" && <ResultScreen />}
      <img className="brand" src="/game/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </>
  );
}
