import { navigate } from "@/app/router";
import { GameButton } from "@/ui/controls";

export function LogbookScreen({ tab }: { tab: "ranking" | "history" }) {
  return (
    <main className="screen screen--menu">
      <section className="wood-panel wood-panel--wide" aria-labelledby="logbook-title">
        <h1 className="panel-title" id="logbook-title">
          Captain's log
        </h1>
        <p className="panel-note">{tab}</p>
        <div className="panel-actions">
          <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
        </div>
      </section>
    </main>
  );
}
