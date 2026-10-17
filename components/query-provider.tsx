"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for the client-side reads (the session list, the latest
 * session, reviews, a session's share link, the AI-app token list). One client
 * per page load (per request on the server). Writes stay plain `fetch` and put
 * their result into the cache with `setQueryData`.
 *
 * Defaults match how the app behaved before: a failed load shows its own
 * "Try again" instead of retrying by itself, and nothing refetches because the
 * window got focus. Each query sets its own `staleTime` / `gcTime`.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
