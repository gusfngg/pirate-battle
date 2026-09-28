import { useEffect, useRef, useState } from "react";
import { countdownOverride, E2E, MANUAL_CLOCK, matchSeed } from "@/app/env";
import { optionsStore } from "@/app/preferences";
import { navigate } from "@/app/router";
import { assetProgress, loadGameAssets, type GameAssets } from "@/game/assets/game-assets";
import { sounds } from "@/game/audio/sound-board";
import { GameSession, type MatchSummary } from "@/game/session/game-session";
import { installTestBridge } from "@/game/testing/test-bridge";
import { useStore } from "@/lib/store";
import { GameButton } from "@/ui/controls";
import { Dialog } from "@/ui/Dialog";
import { Hud } from "./Hud";
import { finishMatch } from "./finish-match";
import { TouchControls } from "./TouchControls";

type LoadState = { status: "loading" } | { status: "ready"; assets: GameAssets } | { status: "error"; message: string };

export function PlayScreen() {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const progress = useStore(assetProgress, (state) => state.progress);

  useEffect(() => {
    let cancelled = false;
    loadGameAssets()
      .then((assets) => {
        if (!cancelled) setLoad({ status: "ready", assets });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("game assets failed to load", error);
        setLoad({ status: "error", message: "The ship's charts could not be loaded. Check your connection and try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (load.status === "ready") return <GameStage assets={load.assets} />;

  return (
    <main className="screen screen--menu">
      <div className="wood-panel loading-panel">
        <h1 className="panel-title" id="loading-title">
          {load.status === "error" ? "Charts lost" : "Setting sail"}
        </h1>
        {load.status === "loading" ? (
          <>
            <div
              className="progress"
              role="progressbar"
              aria-labelledby="loading-title"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div className="progress__fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="panel-note">Loading ships and islands… {Math.round(progress * 100)}%</p>
          </>
        ) : (
          <>
            <p className="panel-error" role="alert">
              {load.message}
            </p>
            <div className="panel-actions">
              <GameButton
                autoFocus
                onClick={() => {
                  setLoad({ status: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </GameButton>
              <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function GameStage({ assets }: { assets: GameAssets }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    sounds.unlock();

    const created = new GameSession({
      host,
      assets,
      options: optionsStore.get(),
      seed: matchSeed(),
      manualClock: MANUAL_CLOCK,
      countdownSeconds: countdownOverride(),
      onEnded: (summary: MatchSummary) => finishMatch(summary),
    });
    const removeBridge = E2E ? installTestBridge(created) : () => undefined;
    created.mount().catch((error: unknown) => {
      console.warn("the renderer could not start", error);
      setFailed(true);
    });
    setSession(created);

    return () => {
      removeBridge();
      created.destroy();
    };
  }, [assets]);

  return (
    <main className="play-screen" data-testid="play-screen">
      <h1 className="visually-hidden">Pirate Battle, match in progress</h1>
      <div className="play-screen__canvas" ref={hostRef} data-testid="arena" />
      {session ? <PlayOverlay session={session} /> : null}
      {failed ? (
        <div className="play-screen__failure" role="alert">
          <p>Your browser could not start the game renderer.</p>
          <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
        </div>
      ) : null}
    </main>
  );
}

const PAUSE_TEXT = {
  manual: "Ready when you are.",
  blur: "The battle paused because the window lost focus.",
  hidden: "The battle paused while the tab was hidden.",
  rotate: "The battle paused while the device was upright.",
} as const;

function PlayOverlay({ session }: { session: GameSession }) {
  const paused = useStore(session.hud, (hud) => hud.paused);
  const phase = useStore(session.hud, (hud) => hud.phase);
  const portrait = usePortraitTouch();

  useEffect(() => {
    if (portrait) session.pause("rotate");
  }, [portrait, session]);

  return (
    <>
      <Hud session={session} />
      <TouchControls pad={session.pad} disabled={paused !== null || phase === "ended"} />
      <p className="controls-legend" aria-hidden="true">
        <kbd>W</kbd> sail · <kbd>A</kbd>
        <kbd>D</kbd> turn · <kbd>Space</kbd> bow · <kbd>Q</kbd>
        <kbd>E</kbd> broadsides · <kbd>Esc</kbd> pause
      </p>

      <Dialog open={paused !== null && !portrait} labelledBy="pause-title" describedBy="pause-text" onCancel={() => session.resume()}>
        <h2 className="panel-title" id="pause-title">
          Paused
        </h2>
        <p className="panel-note" id="pause-text">
          {paused ? PAUSE_TEXT[paused] : ""}
        </p>
        <div className="panel-actions">
          <GameButton autoFocus onClick={() => session.resume()}>
            Resume
          </GameButton>
          <GameButton onClick={() => session.restart()}>Restart</GameButton>
          <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
        </div>
      </Dialog>

      {portrait ? (
        <div className="rotate-overlay" role="alert">
          <img src="/game/ships/ship_3.png" alt="" />
          <p>Turn your device sideways to keep sailing.</p>
        </div>
      ) : null}
    </>
  );
}

function usePortraitTouch() {
  const query = "(orientation: portrait) and (pointer: coarse)";
  const [portrait, setPortrait] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setPortrait(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return portrait;
}
