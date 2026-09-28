import { useState, type FormEvent } from "react";
import { optionsStore, saveOptions } from "@/app/preferences";
import { navigate } from "@/app/router";
import { OPTION_LIMITS, type MatchOptions } from "@/game/config";
import { useStore } from "@/lib/store";
import { GameButton, RoundButton } from "@/ui/controls";

type Field = keyof MatchOptions;

const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: "sessionSeconds", label: "Game session time", unit: "seconds" },
  { key: "spawnSeconds", label: "Enemy spawn time", unit: "seconds" },
];

export function validateOption(key: Field, raw: string): string | null {
  const limits = OPTION_LIMITS[key];
  if (raw.trim() === "") return "Enter a number.";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "Enter a number.";
  if (value < limits.min || value > limits.max) return `Choose between ${limits.min} and ${limits.max} seconds.`;
  // compara com tolerância pra 1.5 / 0.5 não falhar por arredondamento de ponto flutuante
  const steps = (value - limits.min) / limits.step;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) return `Use steps of ${limits.step} seconds.`;
  return null;
}

export function OptionsScreen() {
  const saved = useStore(optionsStore, (options) => options);
  const [draft, setDraft] = useState<Record<Field, string>>({
    sessionSeconds: String(saved.sessionSeconds),
    spawnSeconds: String(saved.spawnSeconds),
  });
  const [notice, setNotice] = useState("");

  const errors: Record<Field, string | null> = {
    sessionSeconds: validateOption("sessionSeconds", draft.sessionSeconds),
    spawnSeconds: validateOption("spawnSeconds", draft.spawnSeconds),
  };
  const valid = !errors.sessionSeconds && !errors.spawnSeconds;
  const dirty = Number(draft.sessionSeconds) !== saved.sessionSeconds || Number(draft.spawnSeconds) !== saved.spawnSeconds;

  function change(key: Field, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function nudge(key: Field, direction: 1 | -1) {
    const limits = OPTION_LIMITS[key];
    const current = Number(draft[key]);
    const base = Number.isFinite(current) ? current : limits.fallback;
    const next = Math.min(limits.max, Math.max(limits.min, Math.round((base + direction * limits.step) / limits.step) * limits.step));
    change(key, String(next));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const stored = saveOptions({ sessionSeconds: Number(draft.sessionSeconds), spawnSeconds: Number(draft.spawnSeconds) });
    setNotice(stored ? "Options saved. They apply to your next battle." : "Options apply now, but this browser blocked saving them.");
  }

  return (
    <main className="screen screen--menu">
      <section className="wood-panel options-panel" aria-labelledby="options-title">
        <h1 className="panel-title" id="options-title">
          Options
        </h1>

        <form className="options-form" onSubmit={submit} noValidate>
          {FIELDS.map(({ key, label, unit }) => {
            const limits = OPTION_LIMITS[key];
            const error = errors[key];
            return (
              <div className="option-field" key={key}>
                <label htmlFor={`option-${key}`}>{label}</label>
                <div className="stepper">
                  <RoundButton icon="minus" label={`Decrease ${label.toLowerCase()}`} size={44} onClick={() => nudge(key, -1)} />
                  <div className="stepper__value">
                    <input
                      id={`option-${key}`}
                      name={key}
                      type="number"
                      inputMode="decimal"
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      value={draft[key]}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={`hint-${key}${error ? ` error-${key}` : ""}`}
                      onChange={(event) => change(key, event.target.value)}
                    />
                    <span aria-hidden="true">s</span>
                  </div>
                  <RoundButton icon="plus" label={`Increase ${label.toLowerCase()}`} size={44} onClick={() => nudge(key, 1)} />
                </div>
                <p className="option-hint" id={`hint-${key}`}>
                  {limits.min} to {limits.max} {unit}, in steps of {limits.step}.
                </p>
                {error ? (
                  <p className="option-error" id={`error-${key}`} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}

          <p className="option-notice" role="status">
            {notice}
          </p>

          <div className="panel-actions">
            <GameButton type="submit" disabled={!valid || !dirty}>
              Save
            </GameButton>
            <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
          </div>
        </form>
      </section>
    </main>
  );
}
