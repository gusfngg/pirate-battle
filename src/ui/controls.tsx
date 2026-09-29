import type { ButtonHTMLAttributes, ReactNode } from "react";
import { sounds } from "@/game/audio/sound-board";

type Variant = "primary" | "secondary";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "large" | "small";
  children: ReactNode;
}

export function GameButton({ variant = "primary", size = "large", className = "", onClick, children, ...rest }: GameButtonProps) {
  return (
    <button
      type="button"
      className={`game-button game-button--${variant} game-button--${size} ${className}`}
      onClick={(event) => {
        sounds.play("ui_click");
        onClick?.(event);
      }}
      {...rest}
    >
      <span className="game-button__label">{children}</span>
    </button>
  );
}

export type IconName =
  | "close"
  | "fire_front"
  | "fire_left"
  | "fire_right"
  | "forward"
  | "home"
  | "minus"
  | "pause"
  | "play"
  | "plus"
  | "restart"
  | "settings"
  | "turn_left"
  | "turn_right";

export function iconUrl(icon: IconName) {
  return `/game/ui/controls/icon_${icon}.png`;
}

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: number;
}

export function RoundButton({ icon, label, size = 56, className = "", style, onClick, ...rest }: RoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`round-button ${className}`}
      style={{ width: size, height: size, ...style }}
      onClick={(event) => {
        sounds.play("ui_click");
        onClick?.(event);
      }}
      {...rest}
    >
      <img src={iconUrl(icon)} alt="" draggable={false} />
    </button>
  );
}
