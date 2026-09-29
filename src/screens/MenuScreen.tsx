import { navigate } from "@/app/router";
import { GameButton } from "@/ui/controls";

const CONTROLS = [
  { keys: ["W", "↑"], action: "Sail forward" },
  { keys: ["A", "D"], action: "Turn port / starboard" },
  { keys: ["Space"], action: "Fire bow cannon" },
  { keys: ["Q", "E"], action: "Fire left / right broadside" },
  { keys: ["Esc"], action: "Pause" },
];

export function MenuScreen() {
  return (
    <main className="screen screen--menu">
      <section className="wood-panel menu-panel" aria-labelledby="game-title">
        <h1 id="game-title" className="menu-title">
          <img src="/game/ui/menu/title_pirate_battle.png" alt="Pirate Battle" width={384} height={128} />
        </h1>
        <p className="tagline">Set sail. Take command.</p>

        <nav className="menu-actions" aria-label="Main menu">
          <GameButton autoFocus onClick={() => navigate("play")}>
            Play
          </GameButton>
          <GameButton onClick={() => navigate("options")}>Options</GameButton>
        </nav>

        <details className="controls-help">
          <summary>How to sail</summary>
          <dl>
            {CONTROLS.map((control) => (
              <div key={control.action} className="controls-help__row">
                <dt>
                  {control.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{control.action}</dd>
              </div>
            ))}
          </dl>
          <p>On touch screens, use the helm buttons on the left and the cannons on the right. Sink enemy ships for one point each.</p>
        </details>

        <p className="panel-note">Navigate the islands. Survive the battle.</p>

        <div className="menu-tabs" role="group" aria-label="Captain's log">
          <GameButton variant="secondary" size="small" onClick={() => navigate("ranking")}>
            Ranking
          </GameButton>
          <GameButton variant="secondary" size="small" onClick={() => navigate("history")}>
            Match history
          </GameButton>
        </div>
      </section>
    </main>
  );
}
