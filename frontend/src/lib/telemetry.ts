export interface DiagnosticReport {
  title: string;
  description: string;
  walletAddress?: string;
  browser: {
    userAgent: string;
    language: string;
    url: string;
    timestamp: string;
  };
  consoleLogs: string[];
}

export class Telemetry {
  private static instance: Telemetry;

  private constructor() {}

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  async sendReport(report: DiagnosticReport): Promise<void> {
    const redacted = this.redactSensitiveData(report);
    await fetch("/api/telemetry/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(redacted),
    });
  }

  private redactSensitiveData(report: DiagnosticReport): DiagnosticReport {
    const serialized = JSON.stringify(report);
    const redacted = serialized.replace(
      /(private[_-]?key|seed|secret|mnemonic|password|token|api[_-]?key|authorization)/gi,
      "[REDACTED]"
    );
    return JSON.parse(redacted) as DiagnosticReport;
  }

  captureConsoleSnapshot(maxLogs: number = 50): string[] {
    // This is a placeholder - actual implementation would capture console history
    return [];
  }

  captureNetworkErrors(): Array<{ url: string; status: number; error: string }> {
    return [];
  }
}

export const telemetry = Telemetry.getInstance();
