import axios, { isAxiosError } from "axios";
import type { ApiErrorBody } from "./contracts";

export const REQUEST_TIMEOUT_MS = 5000;

export type ApiErrorKind = "timeout" | "offline" | "server" | "client" | "cancelled";

// um erro só com o que a interface precisa saber, sem detalhes do axios vazando
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get retryable() {
    return this.kind === "timeout" || this.kind === "offline" || this.kind === "server";
  }
}

export const http = axios.create({
  baseURL: "/api",
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error)) return new ApiError("cancelled", "The request was cancelled.");
  if (!isAxiosError(error)) return new ApiError("server", "Something unexpected went wrong.");

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new ApiError("timeout", "The harbour master took too long to answer.");
  }
  if (!error.response) return new ApiError("offline", "No connection to the harbour. Check your network.");

  const status = error.response.status;
  const body = error.response.data as Partial<ApiErrorBody> | undefined;
  const message = body?.error?.message ?? `The server answered with status ${status}.`;
  return new ApiError(status >= 500 ? "server" : "client", message, status);
}

http.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)));
