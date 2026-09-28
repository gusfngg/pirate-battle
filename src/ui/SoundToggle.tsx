import { sounds } from "@/game/audio/sound-board";
import { useStore } from "@/lib/store";

export function SoundToggle({ className = "" }: { className?: string }) {
  const muted = useStore(sounds.settings, (settings) => settings.muted);
  return (
    <button
      type="button"
      className={`sound-toggle ${className}`}
      aria-pressed={!muted}
      onClick={() => {
        sounds.unlock();
        sounds.setMuted(!muted);
      }}
    >
      Sound: <strong>{muted ? "off" : "on"}</strong>
    </button>
  );
}
