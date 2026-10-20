"use client";

import { useEffect } from "react";
import { instrumentFetch } from "@/src/lib/errors/fetchTracker";
import { SYNC_TAG } from "@/src/lib/offline/backgroundSync";

/** Custom event used to hand a Background Sync trigger to the page. */
export const REPLAY_QUEUE_EVENT = "sorotask:replay-queue";

export function ClientInit() {
  useEffect(() => {
    // Sentry is initialized in sentry.client.config.ts
    instrumentFetch();

    if (!("serviceWorker" in navigator)) return;

    // The SW cannot replay writes by itself — the pending queue lives in
    // IndexedDB behind a typed API owned by OfflineSyncProvider. So when the
    // browser reports Background Sync, the SW posts a message here and the
    // page emits REPLAY_QUEUE_EVENT, which the provider subscribes to.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === SYNC_TAG) {
        window.dispatchEvent(new CustomEvent(REPLAY_QUEUE_EVENT));
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
