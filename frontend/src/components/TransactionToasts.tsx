"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  RateLimitEvent,
  subscribeRateLimit,
  cancelCurrentRateLimit,
  isRateLimitActive,
} from "../lib/api/tasks";

export interface ToastItem {
  id: string;
  type: "info" | "success" | "warning" | "error" | "ratelimit";
  title: string;
  message?: string;
  duration?: number;
}

/**
 * Custom hook for components to prevent rage clicks when rate limits are active
 * or when a user rapidly clicks multiple times within a short threshold.
 */
export function useRageClickPrevention(thresholdMs = 400, maxClicks = 3) {
  const [isBlocked, setIsBlocked] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  useEffect(() => {
    const unsub = subscribeRateLimit((event) => {
      if (
        event &&
        (event.status === "waiting" || event.status === "retrying")
      ) {
        setIsBlocked(true);
      } else {
        setIsBlocked(false);
      }
    });
    return unsub;
  }, []);

  const guardClick = useCallback(
    (e: React.MouseEvent, onAllowedClick: () => void) => {
      const now = Date.now();
      if (isBlocked || isRateLimitActive()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Filter clicks within threshold
      clickTimestamps.current = clickTimestamps.current.filter(
        (t) => now - t < thresholdMs,
      );
      clickTimestamps.current.push(now);

      if (clickTimestamps.current.length >= maxClicks) {
        e.preventDefault();
        e.stopPropagation();
        setIsBlocked(true);
        setTimeout(() => setIsBlocked(false), thresholdMs * 2);
        return;
      }

      onAllowedClick();
    },
    [isBlocked, thresholdMs, maxClicks],
  );

  return { isBlocked, guardClick };
}

export function TransactionToasts() {
  const [rateLimit, setRateLimit] = useState<RateLimitEvent | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [rageClickCount, setRageClickCount] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribeRateLimit((event) => {
      setRateLimit(event);
      if (event) {
        const elapsed = Date.now() - event.startTime;
        const remaining = Math.max(0, event.retryAfterMs - elapsed);
        setRemainingMs(remaining);
      } else {
        setRemainingMs(0);
      }
    });

    return unsub;
  }, []);

  // Precision millisecond countdown timer
  useEffect(() => {
    if (!rateLimit || rateLimit.status !== "waiting") return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - rateLimit.startTime;
      const left = Math.max(0, rateLimit.retryAfterMs - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 20); // 20ms precision update

    return () => clearInterval(interval);
  }, [rateLimit]);

  // Global rage-click detector to catch frustrated rapid clicking during active backoff
  const handleContainerClick = () => {
    if (
      rateLimit &&
      (rateLimit.status === "waiting" || rateLimit.status === "retrying")
    ) {
      setRageClickCount((c) => c + 1);
    }
  };

  if (!rateLimit) return null;

  const totalMs = rateLimit.retryAfterMs || 1000;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalMs - remainingMs) / totalMs) * 100),
  );
  const secondsFormatted = (remainingMs / 1000).toFixed(2);

  return (
    <aside
      aria-label="Transaction Notifications"
      aria-live="assertive"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full px-4 sm:px-0"
      onClick={handleContainerClick}
    >
      <div
        role="alert"
        data-testid="rate-limit-toast"
        className="bg-neutral-900/95 border border-amber-500/40 shadow-2xl rounded-xl p-4 text-neutral-100 backdrop-blur-md transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <h4 className="font-semibold text-amber-400 text-sm">
              {rateLimit.status === "retrying"
                ? "Retrying Request..."
                : rateLimit.status === "success"
                  ? "Retry Succeeded"
                  : rateLimit.status === "failed"
                    ? "Rate Limit Retry Failed"
                    : "Rate Limit Exceeded (HTTP 429)"}
            </h4>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-mono border border-amber-800/50">
            Attempt {rateLimit.attempt} of {rateLimit.maxRetries}
          </span>
        </div>

        {/* Action description */}
        <p className="text-xs text-neutral-300 mt-2">
          <span className="font-medium text-neutral-100">
            {rateLimit.actionLabel || "Action"}
          </span>{" "}
          throttled by upstream RPC endpoint. Backing off exponentially.
        </p>

        {/* Millisecond Countdown Timer */}
        {rateLimit.status === "waiting" && (
          <div className="mt-3 bg-neutral-950/70 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Automatic Retry In:
            </span>
            <div className="text-right">
              <span
                data-testid="countdown-timer"
                className="font-mono text-sm font-bold text-amber-300 tracking-wide"
              >
                {secondsFormatted}s ({remainingMs}ms)
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {rateLimit.status === "waiting" && (
          <div className="mt-2 w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              data-testid="backoff-progress"
              className="bg-amber-500 h-full transition-all duration-75 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Rage-click blocker notice */}
        <div
          data-testid="rage-click-blocker"
          className="mt-3 text-[11px] bg-red-950/40 border border-red-900/50 text-red-300 px-2.5 py-1.5 rounded flex items-center gap-1.5"
        >
          <svg
            className="w-3.5 h-3.5 text-red-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>
            {rageClickCount > 0
              ? `Rage clicks blocked (${rageClickCount}). Action buttons are locked to prevent node bans.`
              : "Action buttons locked during backoff window to prevent rage clicking."}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={() => cancelCurrentRateLimit()}
            className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel Retry
          </button>
        </div>
      </div>
    </aside>
  );
}
