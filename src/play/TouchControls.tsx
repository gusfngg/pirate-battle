import { useRef, type PointerEvent } from "react";
import type { Action, ControlPad } from "@/game/input/control-pad";
import { iconUrl, type IconName } from "@/ui/controls";

interface PadButton {
  action: Action;
  icon: IconName;
  label: string;
}

const GUNS: PadButton[] = [
  { action: "fireLeft", icon: "fire_left", label: "Fire left broadside" },
  { action: "fireFront", icon: "fire_front", label: "Fire bow cannon" },
  { action: "fireRight", icon: "fire_right", label: "Fire right broadside" },
];

const STICK_RADIUS = 56;

function capture(event: PointerEvent<HTMLElement>) {
  // a captura segura o dedo mesmo se ele escorregar pra fora, mas o ponteiro pode já ter sumido
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // sem captura o controle ainda solta no pointerup
  }
}

// cada dedo é uma fonte separada, assim dá pra pilotar com o polegar esquerdo e atirar com o direito
export function TouchControls({ pad, disabled }: { pad: ControlPad; disabled: boolean }) {
  return (
    <div className="touch-controls" aria-label="Touch controls">
      <SteeringStick pad={pad} disabled={disabled} />
      <div className="touch-controls__cluster touch-controls__cluster--guns">
        {GUNS.map((button) => (
          <GunButton key={button.action} button={button} pad={pad} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

function GunButton({ button, pad, disabled }: { button: PadButton; pad: ControlPad; disabled: boolean }) {
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    delete event.currentTarget.dataset.pressed;
    pad.release(button.action, `touch-${event.pointerId}`);
  };

  return (
    <button
      type="button"
      className={`touch-button touch-button--${button.action}`}
      aria-label={button.label}
      data-testid={`touch-${button.action}`}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        pad.press(button.action, `touch-${event.pointerId}`);
        event.currentTarget.dataset.pressed = "true";
        capture(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img src={iconUrl(button.icon)} alt="" draggable={false} />
    </button>
  );
}

// joystick flutuante: onde o polegar encosta vira o centro, arrastar aponta pra onde o barco deve ir
function SteeringStick({ pad, disabled }: { pad: ControlPad; disabled: boolean }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; pointer: number } | null>(null);

  // mexe no dom direto: o joystick atualiza a cada movimento do dedo sem renderizar o react
  function place(x: number, y: number, dx: number, dy: number) {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    base.style.transform = `translate(${x}px, ${y}px)`;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function relativePoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function update(event: PointerEvent<HTMLDivElement>) {
    const start = origin.current;
    if (!start || start.pointer !== event.pointerId) return;
    const point = relativePoint(event);
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const reach = Math.hypot(dx, dy);
    const clamped = Math.min(reach, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    place(start.x, start.y, Math.cos(angle) * clamped, Math.sin(angle) * clamped);
    pad.setStick(`stick-${event.pointerId}`, angle, reach / STICK_RADIUS);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (origin.current?.pointer !== event.pointerId) return;
    origin.current = null;
    pad.releaseSource(`stick-${event.pointerId}`);
    event.currentTarget.dataset.active = "false";
    const knob = knobRef.current;
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }

  return (
    <div
      className="stick-zone"
      data-testid="touch-stick"
      role="application"
      aria-label="Steering stick: touch and drag toward where the ship should sail"
      data-active="false"
      onPointerDown={(event) => {
        if (disabled || origin.current) return;
        event.preventDefault();
        const point = relativePoint(event);
        origin.current = { ...point, pointer: event.pointerId };
        event.currentTarget.dataset.active = "true";
        place(point.x, point.y, 0, 0);
        capture(event);
      }}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="stick" ref={baseRef}>
        <div className="stick__knob" ref={knobRef}>
          <img src={iconUrl("forward")} alt="" draggable={false} />
        </div>
      </div>
    </div>
  );
}
