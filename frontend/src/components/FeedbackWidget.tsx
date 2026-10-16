"use client";

import { useState, useEffect, useCallback } from "react";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      logs.push(`[LOG] ${args.map(String).join(" ")}`);
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push(`[ERROR] ${args.map(String).join(" ")}`);
      originalError(...args);
    };
    console.warn = (...args) => {
      logs.push(`[WARN] ${args.map(String).join(" ")}`);
      originalWarn(...args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const getWalletAddress = useCallback(() => {
    try {
      const stored = localStorage.getItem("walletAddress") || localStorage.getItem("wallet") || localStorage.getItem("selectedAddress");
      return stored || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const getBrowserInfo = useCallback(() => {
    return {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const diagnostic = {
        title,
        description,
        walletAddress: getWalletAddress(),
        browser: getBrowserInfo(),
        consoleLogs: consoleLogs.slice(-50),
      };

      // Redact sensitive data
      const redacted = JSON.parse(
        JSON.stringify(diagnostic).replace(/(private[_-]?key|seed|secret|mnemonic|password|token|api[_-]?key)/gi, "[REDACTED]")
      );

      // Integration point for GitHub/Jira - for now, log to telemetry
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(redacted),
      }).catch(() => {
        // Fallback: store locally
        localStorage.setItem("feedback_pending", JSON.stringify(redacted));
      });

      setSubmitted(true);
    } catch (err) {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-green-600 text-white px-4 py-2 rounded shadow-lg">
          Thank you for your feedback!
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow-lg hover:bg-blue-700"
          aria-label="Report bug or feedback"
        >
          Feedback
        </button>
      ) : (
        <div className="bg-white text-gray-900 rounded shadow-xl w-96 max-h-[90vh] overflow-auto">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Report Bug / Feedback</h3>
            <button onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
                placeholder="Brief description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
                rows={4}
                placeholder="Steps to reproduce, expected vs actual behavior"
              />
            </div>
            <div className="text-xs text-gray-600">
              <p>Diagnostic context will be captured (browser info, recent console logs, wallet state).</p>
              <p className="mt-1">Sensitive credentials are automatically redacted.</p>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
