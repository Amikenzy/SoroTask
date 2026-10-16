import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { TransactionToasts } from "../TransactionToasts";
import {
  emitRateLimit,
  cancelCurrentRateLimit,
  executeWithRateLimitRetry,
  parseRetryAfterHeader,
  calculateExponentialBackoff,
  RateLimitError,
} from "../../lib/api/tasks";

describe("Rate Limit & Retry Visualizer (Issue #1520)", () => {
  beforeEach(() => {
    emitRateLimit(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      emitRateLimit(null);
    });
    jest.useRealTimers();
  });

  describe("Utility Functions", () => {
    it("parses Retry-After headers in seconds and HTTP dates", () => {
      expect(parseRetryAfterHeader("120")).toBe(120000);
      expect(parseRetryAfterHeader("0")).toBe(0);
      expect(parseRetryAfterHeader(null)).toBeNull();

      const futureDate = new Date(Date.now() + 5000).toUTCString();
      const parsed = parseRetryAfterHeader(futureDate);
      expect(parsed).toBeGreaterThan(0);
      expect(parsed).toBeLessThanOrEqual(5000);
    });

    it("calculates exponential backoff correctly", () => {
      expect(calculateExponentialBackoff(1, 1000, 30000, false)).toBe(1000);
      expect(calculateExponentialBackoff(2, 1000, 30000, false)).toBe(2000);
      expect(calculateExponentialBackoff(3, 1000, 30000, false)).toBe(4000);
      expect(calculateExponentialBackoff(4, 1000, 30000, false)).toBe(8000);
      expect(calculateExponentialBackoff(10, 1000, 10000, false)).toBe(10000); // capped at max
    });
  });

  describe("TransactionToasts Component", () => {
    it("does not render when there is no rate limit event", () => {
      render(<TransactionToasts />);
      expect(screen.queryByTestId("rate-limit-toast")).not.toBeInTheDocument();
    });

    it("renders rate limit toast with millisecond countdown and exponential backoff metadata", () => {
      render(<TransactionToasts />);

      act(() => {
        emitRateLimit({
          id: "test-rl-1",
          endpoint: "https://soroban-testnet.stellar.org",
          attempt: 2,
          maxRetries: 4,
          retryAfterMs: 3000,
          startTime: Date.now(),
          actionLabel: "Execute Task #42",
          status: "waiting",
        });
      });

      expect(screen.getByTestId("rate-limit-toast")).toBeInTheDocument();
      expect(
        screen.getByText(/Rate Limit Exceeded \(HTTP 429\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Attempt 2 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Execute Task #42/i)).toBeInTheDocument();
      expect(screen.getByTestId("countdown-timer")).toBeInTheDocument();
      expect(screen.getByTestId("backoff-progress")).toBeInTheDocument();
      expect(screen.getByTestId("rage-click-blocker")).toBeInTheDocument();
    });

    it("updates millisecond countdown as time passes", () => {
      render(<TransactionToasts />);

      const startTime = Date.now();
      act(() => {
        emitRateLimit({
          id: "test-rl-2",
          endpoint: "https://soroban-testnet.stellar.org",
          attempt: 1,
          maxRetries: 3,
          retryAfterMs: 4000,
          startTime,
          actionLabel: "Register Task",
          status: "waiting",
        });
      });

      expect(screen.getByTestId("countdown-timer")).toHaveTextContent(/4.00s/);

      // Advance by 1500ms
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      expect(screen.getByTestId("countdown-timer")).toHaveTextContent(/2.50s/);
    });

    it("allows cancelling retry backoff", () => {
      render(<TransactionToasts />);

      act(() => {
        emitRateLimit({
          id: "test-rl-3",
          endpoint: "https://soroban-testnet.stellar.org",
          attempt: 1,
          maxRetries: 3,
          retryAfterMs: 5000,
          startTime: Date.now(),
          actionLabel: "Deposit Gas",
          status: "waiting",
        });
      });

      const cancelBtn = screen.getByText("Cancel Retry");
      fireEvent.click(cancelBtn);

      // Status transitioned to cancelled
      expect(screen.queryByTestId("countdown-timer")).not.toBeInTheDocument();
    });

    it("tracks rage clicks on the toast and updates blocker notice", () => {
      render(<TransactionToasts />);

      act(() => {
        emitRateLimit({
          id: "test-rl-4",
          endpoint: "https://soroban-testnet.stellar.org",
          attempt: 1,
          maxRetries: 3,
          retryAfterMs: 5000,
          startTime: Date.now(),
          actionLabel: "Withdraw Gas",
          status: "waiting",
        });
      });

      const container = screen.getByTestId("rate-limit-toast");
      fireEvent.click(container);
      fireEvent.click(container);

      expect(
        screen.getByText(/Rage clicks blocked \(2\)/i),
      ).toBeInTheDocument();
    });
  });

  describe("executeWithRateLimitRetry", () => {
    it("retries on rate limit errors and succeeds when resolved", async () => {
      let callCount = 0;
      const mockAction = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new RateLimitError("Throttled", 50, 1);
        }
        return "success-data";
      });

      const promise = executeWithRateLimitRetry(mockAction, {
        maxRetries: 3,
        baseBackoffMs: 50,
      });

      // Advance fake timers asynchronously
      await act(async () => {
        await jest.advanceTimersByTimeAsync(100);
      });

      const result = await promise;
      expect(result).toBe("success-data");
      expect(mockAction).toHaveBeenCalledTimes(2);
    });
  });
});
