import type { UseQueryResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { MatchRecord, Page, RankingEntry } from "@/api/contracts";
import { outboxStore, requestSync } from "@/api/outbox";
import { playerStore } from "@/api/player";
import { describeError, useHistory, useRanking } from "@/api/queries";
import { lastResultStore, optionsStore } from "@/app/preferences";
import { navigate } from "@/app/router";
import { formatClock, formatDay, formatEndReason, formatTime } from "@/lib/format";
import { useStore } from "@/lib/store";
import { GameButton, RoundButton } from "@/ui/controls";

type Tab = "ranking" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "ranking", label: "Ranking" },
  { id: "history", label: "Match history" },
];

export function LogbookScreen({ tab }: { tab: Tab }) {
  const pending = useStore(outboxStore, (state) => state.pending.length);

  return (
    <main className="screen screen--menu">
      <section className="wood-panel wood-panel--wide logbook" aria-labelledby="logbook-title">
        <h1 className="panel-title" id="logbook-title">
          Captain&apos;s log
        </h1>

        <div className="logbook__tabs" role="tablist" aria-label="Captain's log">
          {TABS.map(({ id, label }) => (
            <GameButton
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              aria-current={tab === id ? "page" : undefined}
              tabIndex={tab === id ? 0 : -1}
              variant="secondary"
              size="small"
              onClick={() => navigate(id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") navigate(id === "ranking" ? "history" : "ranking");
              }}
            >
              {label}
            </GameButton>
          ))}
        </div>

        {pending > 0 ? (
          <p className="logbook__pending" role="status">
            {pending === 1 ? "1 battle is" : `${pending} battles are`} waiting to be saved.{" "}
            <button type="button" className="link-button" onClick={() => requestSync()}>
              Retry now
            </button>
          </p>
        ) : null}

        <div className="logbook__panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "ranking" ? <RankingTab key="ranking" /> : <HistoryTab key="history" />}
        </div>

        <GameButton onClick={() => navigate("menu")}>Main menu</GameButton>
      </section>
    </main>
  );
}

function RankingTab() {
  const config = useStore(optionsStore, (options) => options);
  const me = useStore(playerStore, (player) => player.playerId);
  const [page, setPage] = useState(1);
  const query = useRanking(config, page);

  return (
    <QueryView
      query={query}
      subtitle={`${config.sessionSeconds} second battles · ${config.spawnSeconds} second spawn interval`}
      noun="ranking"
      emptyText="No battles recorded with this setup yet. Be the first captain on the board."
      page={page}
      onPage={setPage}
      head={["Rank", "Captain", "Points", "Played"]}
      renderRow={(entry: RankingEntry) => {
        const mine = entry.playerId === me;
        return (
          <tr key={entry.matchId} className={mine ? "is-mine" : undefined}>
            <td className="cell-rank">{String(entry.rank).padStart(2, "0")}</td>
            <td className="cell-captain">
              {entry.rank === 1 ? <img src="/game/ui/hud/icon_score.png" alt="Top captain" className="cell-star" /> : null}
              {entry.playerName}
              {mine ? <span className="you-badge">You</span> : null}
            </td>
            <td className="cell-points">{entry.score}</td>
            <td className="cell-date">
              {formatDay(entry.playedAt)} · {formatTime(entry.playedAt)}
            </td>
          </tr>
        );
      }}
    />
  );
}

function HistoryTab() {
  const player = useStore(playerStore, (state) => state);
  const lastMatchId = useStore(lastResultStore, (state) => state.result?.matchId);
  const [page, setPage] = useState(1);
  const query = useHistory(player.playerId, page);

  return (
    <QueryView
      query={query}
      subtitle={`${player.playerName} · your recent battles`}
      noun="match history"
      emptyText="No battles in your log yet. Finish a battle and it will show up here."
      page={page}
      onPage={setPage}
      head={["Date", "Points", "Duration", "Result"]}
      renderRow={(record: MatchRecord) => (
        <tr key={record.matchId} className={record.matchId === lastMatchId ? "is-mine" : undefined}>
          <td className="cell-date">
            <strong>{formatDay(record.playedAt)}</strong> · {formatTime(record.playedAt)}
          </td>
          <td className="cell-points">{record.score}</td>
          <td>{formatClock(record.durationMs / 1000)}</td>
          <td className={`cell-result cell-result--${record.endReason}`}>
            {formatEndReason(record.endReason)}
            <small>
              {record.config.sessionSeconds}s · {record.config.spawnSeconds}s
            </small>
          </td>
        </tr>
      )}
    />
  );
}

interface QueryViewProps<T> {
  query: UseQueryResult<Page<T>>;
  subtitle: string;
  noun: string;
  emptyText: string;
  page: number;
  onPage(page: number): void;
  head: string[];
  renderRow(item: T): ReactNode;
}

// carregando, vazio, erro, atualização em segundo plano e paginação num lugar só
function QueryView<T>({ query, subtitle, noun, emptyText, page, onPage, head, renderRow }: QueryViewProps<T>) {
  const { data, isPending, isError, isFetching, isPlaceholderData, error, refetch } = query;
  const totalPages = data?.totalPages ?? 1;

  let body: ReactNode;
  if (isPending) {
    body = (
      <p className="logbook__state" role="status" data-testid="logbook-loading">
        Loading the {noun}…
      </p>
    );
  } else if (isError && !data) {
    body = (
      <div className="logbook__state" role="alert" data-testid="logbook-error">
        <p>
          Could not load the {noun}. {describeError(error)}
        </p>
        <GameButton size="small" variant="secondary" onClick={() => void refetch()}>
          Try again
        </GameButton>
      </div>
    );
  } else if (data && data.items.length === 0) {
    body = (
      <p className="logbook__state" data-testid="logbook-empty">
        {emptyText}
      </p>
    );
  } else if (data) {
    body = (
      <table className={`logbook__table ${isPlaceholderData ? "is-stale" : ""}`} data-testid="logbook-table" aria-busy={isFetching}>
        <caption className="visually-hidden">
          {noun}, page {data.page} of {data.totalPages}
        </caption>
        <thead>
          <tr>
            {head.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{data.items.map(renderRow)}</tbody>
      </table>
    );
  }

  return (
    <>
      <p className="logbook__subtitle">
        {subtitle}
        <span className="logbook__sync" aria-live="polite">
          {isFetching && !isPending ? " · updating…" : ""}
        </span>
      </p>
      {isError && data ? (
        <p className="logbook__warning" role="alert">
          Showing the last saved {noun}. It could not be refreshed: {describeError(error)}
        </p>
      ) : null}
      {body}
      {data && data.totalItems > 0 ? (
        <nav className="pager" aria-label={`${noun} pages`}>
          <RoundButton icon="turn_left" label="Previous page" size={44} disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))} />
          <span data-testid="pager-label">
            Page {data.page} of {totalPages}
          </span>
          <RoundButton
            icon="turn_right"
            label="Next page"
            size={44}
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPage(Math.min(totalPages, page + 1))}
          />
        </nav>
      ) : null}
    </>
  );
}
