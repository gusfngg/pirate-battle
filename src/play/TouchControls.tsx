import type { PointerEvent } from "react";
import type { Action, ControlPad } from "@/game/input/control-pad";
import { iconUrl, type IconName } from "@/ui/controls";

interface PadButton {
  action: Action;
  icon: IconName;
  label: string;
}

const HELM: PadButton[] = [
  { action: "turnLeft", icon: "turn_left", label: "Turn left" },
  { action: "forward", icon: "forward", label: "Sail forward" },
  { action: "turnRight", icon: "turn_right", label: "Turn right" },
];

const GUNS: PadButton[] = [
  { action: "fireLeft", icon: "fire_left", label: "Fire left broadside" },
  { action: "fireFront", icon: "fire_front", label: "Fire bow cannon" },
  { action: "fireRight", icon: "fire_right", label: "Fire right broadside" },
];

// cada dedo é uma fonte separada, assim dá pra navegar e atirar ao mesmo tempo
export function TouchControls({ pad, disabled }: { pad: ControlPad; disabled: boolean }) {
  function press(action: Action) {
    return (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      pad.press(action, `touch-${event.pointerId}`);
      event.currentTarget.dataset.pressed = "true";
      // a captura segura o botão mesmo se o dedo escorregar, mas o ponteiro pode já ter sumido
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // sem captura o botão ainda solta no pointerup
      }
    };
  }

  function release(action: Action) {
    return (event: PointerEvent<HTMLButtonElement>) => {
      delete event.currentTarget.dataset.pressed;
      pad.release(action, `touch-${event.pointerId}`);
    };
  }

  function renderButton(button: PadButton) {
    return (
      <button
        key={button.action}
        type="button"
        className={`touch-button touch-button--${button.action}`}
        aria-label={button.label}
        data-testid={`touch-${button.action}`}
        onPointerDown={press(button.action)}
        onPointerUp={release(button.action)}
        onPointerCancel={release(button.action)}
        onLostPointerCapture={release(button.action)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <img src={iconUrl(button.icon)} alt="" draggable={false} />
      </button>
    );
  }

  return (
    <div className="touch-controls" aria-label="Touch controls">
      <div className="touch-controls__cluster touch-controls__cluster--helm">{HELM.map(renderButton)}</div>
      <div className="touch-controls__cluster touch-controls__cluster--guns">{GUNS.map(renderButton)}</div>
    </div>
  );
}
