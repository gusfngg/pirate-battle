import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { MatchConfigSnapshot } from "./contracts";
import { ApiError, toApiError } from "./http";
import { fetchHistory, fetchRanking, registerMatch } from "./matches-api";
import { markFailed, markRegistered, onSyncRequest, outboxStore } from "./outbox";

export const queryKeys = {
  ranking: (config: MatchConfigSnapshot, page: number) => ["ranking", config.sessionSeconds, config.spawnSeconds, page] as const,
  history: (playerId: string, page: number) => ["history", playerId, page] as const,
};

// erro 4xx não melhora tentando de novo, falha de rede e 5xx sim
function shouldRetry(failureCount: number, error: unknown) {
  const apiError = toApiError(error);
  return apiError.retryable && failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: 5 * 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
      },
    },
  });
}

// o signal cancela a requisição antiga, então resposta atrasada nunca sobrescreve a nova
export function useRanking(config: MatchConfigSnapshot, page: number) {
  return useQuery({
    queryKey: queryKeys.ranking(config, page),
    queryFn: ({ signal }) => fetchRanking(config, page, signal),
    placeholderData: keepPreviousData,
  });
}

export function useHistory(playerId: string, page: number) {
  return useQuery({
    queryKey: queryKeys.history(playerId, page),
    queryFn: ({ signal }) => fetchHistory(playerId, page, signal),
    placeholderData: keepPreviousData,
  });
}

export const REGISTER_MUTATION_KEY = ["register-matches"] as const;
const AUTO_RETRY_MS = 10_000;

// envia a fila de partidas pendentes, uma por vez, e atualiza as duas abas no fim
export function useMatchSync() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: REGISTER_MUTATION_KEY,
    mutationFn: async () => {
      let confirmed = 0;
      for (const item of outboxStore.get().pending) {
        try {
          await registerMatch(item.record);
          markRegistered(item.record.matchId);
          confirmed++;
        } catch (error) {
          markFailed(item.record.matchId, toApiError(error).message);
        }
      }
      return confirmed;
    },
    onSettled: (confirmed) => {
      if (!confirmed) return;
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });

  const { mutate, isPending } = mutation;

  useEffect(() => {
    const flush = () => {
      if (outboxStore.get().pending.length === 0) return;
      if (queryClient.isMutating({ mutationKey: REGISTER_MUTATION_KEY }) > 0) return;
      mutate();
    };
    flush();
    const timer = window.setInterval(flush, AUTO_RETRY_MS);
    window.addEventListener("online", flush);
    const stopListening = onSyncRequest(flush);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", flush);
      stopListening();
    };
  }, [mutate, queryClient]);

  return { isSyncing: isPending };
}

export function describeError(error: unknown) {
  const apiError = error instanceof ApiError ? error : toApiError(error);
  return apiError.message;
}
