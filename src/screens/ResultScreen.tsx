import { lastResultStore } from "@/app/preferences";
import { navigate } from "@/app/router";
import { formatClock, formatEndReason } from "@/lib/format";
import { useStore } from "@/lib/store";
import { GameButton } from "@/ui/controls";

export function ResultScreen() {
  const result = useStore(lastResultStore, (state) => state.result);

  if (!result) {
    return (
      <main className="screen screen--menu">
        <section className="wood-panel result-panel" aria-labelledby="result-title">
          <h1 className="panel-title" id="result-title">
            No battles yet
          </h1>
          <p className="panel-note">Finish a battle and its result will wait for you here.</p>
          <div className="panel-actions">
            <GameButton autoFocus onClick={() => navigate("play")}>
              Play
            </GameButton>
            <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
          </div>
        </section>
      </main>
    );
  }

  const survived = result.endReason === "time";

  return (
    <main className="screen screen--menu">
      <section className="wood-panel result-panel" aria-labelledby="result-title">
        <h1 className="panel-title" id="result-title">
          {survived ? "Battle complete" : "Ship destroyed"}
        </h1>
        <p className="result-score" data-testid="result-score">
          {result.score}
        </p>
        <p className="result-meta" data-testid="result-meta">
          <span>{result.score === 1 ? "Point" : "Points"}</span> · <span data-testid="result-duration">{formatClock(result.durationMs / 1000)}</span> ·{" "}
          <span data-testid="result-reason">{formatEndReason(result.endReason)}</span>
        </p>
        <p className="result-config">
          {result.config.sessionSeconds} second battle · {result.config.spawnSeconds} second spawn interval
        </p>
        <div className="panel-actions">
          <GameButton autoFocus onClick={() => navigate("play")}>
            Play again
          </GameButton>
          <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
        </div>
      </section>
    </main>
  );
}
