"use client";

import React from "react";
import { ZKProverPanel } from "@/src/components/zk-proof";
import type { ZkTask } from "@/src/lib/zk-proof";
import { useWalletOptional } from "@/app/context/WalletContext";

export default function ZKProverPage() {
  const { session, openConnectModal } = useWalletOptional();
  const tasks: ZkTask[] = [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              ZK Browser Prover Engine
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Generate and locally verify zero-knowledge proofs in your browser
            </p>
          </div>
          <button
            onClick={openConnectModal}
            className="text-xs font-medium px-4 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 transition hover:bg-neutral-800"
          >
            {session ? `Wallet ${session.address.slice(0, 5)}…${session.address.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>

        <ZKProverPanel
          tasks={tasks}
          walletConnected={Boolean(session)}
          walletAddress={session?.address ?? null}
        />
      </div>
    </div>
  );
}
