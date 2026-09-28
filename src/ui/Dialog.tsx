import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  onCancel(): void;
  children: ReactNode;
}

// o <dialog> nativo já prende o foco, fecha com esc e devolve o foco ao sair
export function Dialog({ open, labelledBy, describedBy, onCancel, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="game-dialog"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="wood-panel wood-panel--dialog">{open ? children : null}</div>
    </dialog>
  );
}
