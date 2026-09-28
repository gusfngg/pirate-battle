import type { GameSession } from "@/game/session/game-session";
import { formatClock } from "@/lib/format";
import { useStore } from "@/lib/store";
import { RoundButton } from "@/ui/controls";

const FILL_LEFT = 30 / 256;
const FILL_WIDTH = 196 / 256;

function healthTone(ratio: number) {
  if (ratio > 0.5) return "green";
  if (ratio > 0.25) return "amber";
  return "red";
}

export function Hud({ session }: { session: GameSession }) {
  const health = useStore(session.hud, (hud) => hud.health);
  const maxHealth = useStore(session.hud, (hud) => hud.maxHealth);
  const score = useStore(session.hud, (hud) => hud.score);
  const remaining = useStore(session.hud, (hud) => hud.remainingSeconds);
  const phase = useStore(session.hud, (hud) => hud.phase);
  const countdown = useStore(session.hud, (hud) => hud.countdown);

  const ratio = Math.max(0, health) / maxHealth;
  // recorta o preenchimento pela direita, do mesmo jeito que a arte foi pensada
  const clipRight = (1 - (FILL_LEFT + FILL_WIDTH * ratio)) * 100;

  return (
    <>
      <div className="hud" aria-hidden="true">
        <div className="hud__health">
          <img className="hud__heart" src="/game/ui/hud/icon_heart.png" alt="" />
          <div className="health-bar">
            <img src="/game/ui/hud/health_frame.png" alt="" />
            <img
              className="health-bar__fill"
              src={`/game/ui/hud/health_fill_${healthTone(ratio)}.png`}
              alt=""
              style={{ clipPath: `inset(0 ${clipRight}% 0 0)` }}
            />
            <span className="health-bar__text">
              {Math.max(0, health)} / {maxHealth}
            </span>
          </div>
        </div>

        <div className="hud__counters">
          <div className="counter" data-testid="hud-score">
            <img src="/game/ui/hud/icon_score.png" alt="" />
            <span>{score}</span>
          </div>
          <div className={`counter ${remaining <= 10 && phase === "running" ? "counter--warning" : ""}`} data-testid="hud-time">
            <img src="/game/ui/hud/icon_time.png" alt="" />
            <span>{formatClock(remaining)}</span>
          </div>
        </div>
      </div>

      <RoundButton className="hud__pause" icon="pause" label="Pause" onClick={() => session.pause("manual")} />

      {phase === "countdown" && countdown > 0 ? (
        <div className="countdown" aria-hidden="true" key={countdown}>
          {countdown}
        </div>
      ) : null}

      <MatchStatus session={session} />
    </>
  );
}

// resumo semântico pra leitor de tela: anuncia mudanças de fase, nunca a cada frame
function MatchStatus({ session }: { session: GameSession }) {
  const score = useStore(session.hud, (hud) => hud.score);
  const remaining = useStore(session.hud, (hud) => hud.remainingSeconds);
  const health = useStore(session.hud, (hud) => hud.health);
  const phase = useStore(session.hud, (hud) => hud.phase);
  const paused = useStore(session.hud, (hud) => hud.paused);
  const status = paused ? "Paused" : phase === "countdown" ? "Get ready" : phase === "running" ? "In battle" : "Battle over";
  const lowHealth = health > 0 && health <= 30 && status === "In battle";
  const announcement = lowHealth ? "Warning, hull integrity low" : status === "In battle" ? "Battle started" : status;

  return (
    <div className="visually-hidden">
      <h2>Match status</h2>
      <dl data-testid="match-status">
        <dt>Status</dt>
        <dd data-testid="status-phase">{status}</dd>
        <dt>Score</dt>
        <dd data-testid="status-score">{score}</dd>
        <dt>Time left</dt>
        <dd data-testid="status-time">{formatClock(remaining)}</dd>
        <dt>Health</dt>
        <dd data-testid="status-health">{Math.max(0, health)}</dd>
      </dl>
      <p role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
