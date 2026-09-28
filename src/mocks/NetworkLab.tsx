import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requestSync, resetOutbox } from "@/api/outbox";
import { useStore } from "@/lib/store";
import { GameButton } from "@/ui/controls";
import { Dialog } from "@/ui/Dialog";
import { mockDb } from "./db";
import { SCENARIOS, scenarioStore, setScenario, type ScenarioId } from "./scenarios";

// painel pra escolher cenários de rede do msw e voltar tudo ao estado inicial
export function NetworkLab() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const scenario = useStore(scenarioStore, (state) => state.scenario);
  const queryClient = useQueryClient();

  function choose(next: ScenarioId) {
    setScenario(next);
    setNotice(`Network scenario set to ${next}.`);
    void queryClient.invalidateQueries();
    requestSync();
  }

  function reset() {
    mockDb.reset();
    resetOutbox();
    setScenario("healthy");
    void queryClient.resetQueries();
    setNotice("Mock data, pending records and scenario were reset.");
  }

  return (
    <>
      <button type="button" className="network-lab-toggle" onClick={() => setOpen(true)} data-scenario={scenario}>
        Network lab · <strong>{scenario}</strong>
      </button>
      <Dialog open={open} labelledBy="network-lab-title" onCancel={() => setOpen(false)}>
        <h2 className="panel-title" id="network-lab-title">
          Network lab
        </h2>
        <fieldset className="network-lab">
          <legend>Mock API scenario</legend>
          {(Object.entries(SCENARIOS) as [ScenarioId, string][]).map(([id, description]) => (
            <label key={id} className="network-lab__option">
              <input type="radio" name="scenario" value={id} checked={scenario === id} onChange={() => choose(id)} />
              <span>
                <strong>{id}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="option-notice" role="status">
          {notice}
        </p>
        <div className="panel-actions panel-actions--row">
          <GameButton size="small" variant="secondary" onClick={reset}>
            Reset data
          </GameButton>
          <GameButton size="small" autoFocus onClick={() => setOpen(false)}>
            Close
          </GameButton>
        </div>
      </Dialog>
    </>
  );
}
