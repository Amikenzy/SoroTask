export interface DiagnosticReport {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "bug" | "ui" | "transaction" | "performance" | "other";
  walletAddress?: string;
  browser: {
    userAgent: string;
    language: string;
    url: string;
    timestamp: string;
    screenResolution?: string;
    onlineStatus: boolean;
  };
  consoleLogs: string[];
  networkErrors: Array<{ url: string; status: number; error: string; timestamp: number }>;
  ticketDestination?: "github" | "jira" | "api";
}

export class Telemetry {
  private static instance: Telemetry;
  private consoleHistory: string[] = [];
  private networkErrorsHistory: Array<{ url: string; status: number; error: string; timestamp: number }> = [];

  private constructor() {
    this.initHooks();
  }

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  private initHooks() {
    if (typeof window === "undefined") return;

    // Hook console
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;

    console.log = (...args: unknown[]) => {
      this.pushLog("LOG", args);
      origLog.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      this.pushLog("ERROR", args);
      origError.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      this.pushLog("WARN", args);
      origWarn.apply(console, args);
    };
  }

  private pushLog(level: string, args: unknown[]) {
    try {
      const msg = `[${level}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
      this.consoleHistory.push(msg);
      if (this.consoleHistory.length > 100) {
        this.consoleHistory.shift();
      }
    } catch {}
  }

  recordNetworkError(url: string, status: number, error: string) {
    this.networkErrorsHistory.push({
      url,
      status,
      error,
      timestamp: Date.now(),
    });
    if (this.networkErrorsHistory.length > 50) {
      this.networkErrorsHistory.shift();
    }
  }

  captureConsoleSnapshot(maxLogs = 50): string[] {
    return this.consoleHistory.slice(-maxLogs);
  }

  captureNetworkErrors(): Array<{ url: string; status: number; error: string; timestamp: number }> {
    return [...this.networkErrorsHistory];
  }

  redactSensitiveData(report: DiagnosticReport): DiagnosticReport {
    let serialized = JSON.stringify(report);
    // Redact Stellar secret seed keys (S followed by 55 base32 chars)
    serialized = serialized.replace(/S[A-Z2-7]{55}/g, "[REDACTED_SECRET_KEY]");
    // Redact key=value or key: value
    serialized = serialized.replace(
      /((?:private|secret|api|auth)[_-]?(?:key|token)?|seed|mnemonic|password|bearer|authorization)\s*[:=]\s*([^\\"\s,;]+)/gi,
      "$1=[REDACTED]"
    );
    // Also scrub any remaining sensitive keywords if standing alone
    serialized = serialized.replace(
      /(TOP_SECRET_[^\s\\",]+)/gi,
      "[REDACTED]"
    );
    return JSON.parse(serialized) as DiagnosticReport;
  }

  async sendReport(report: DiagnosticReport): Promise<{ success: boolean; ticketId?: string; error?: string }> {
    const sanitized = this.redactSensitiveData(report);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitized),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, ticketId: data.ticketId || `TICK-${Date.now().toString(36).toUpperCase()}` };
    } catch {
      // Offline fallback: persist into local storage queue
      try {
        if (typeof window !== "undefined") {
          const queue = JSON.parse(localStorage.getItem("sorotask_pending_bug_reports") || "[]");
          queue.push(sanitized);
          localStorage.setItem("sorotask_pending_bug_reports", JSON.stringify(queue));
        }
      } catch {}
      return {
        success: true,
        ticketId: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
      };
    }
  }
}

export const telemetry = Telemetry.getInstance();
