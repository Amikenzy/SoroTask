"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import {
  type WalletSession,
  type WalletError,
  type SupportedWallet,
  connectWallet,
  connectWalletWith,
  disconnectWallet,
  restoreSession,
} from "@/app/lib/wallet";
import {
  type HardwareWalletSession,
  type LedgerStellarBridge,
} from "@/app/lib/hardwareWallet";
import { LedgerModal } from "@/src/components/LedgerModal";

export type ConnectionStatus =
  "idle" | "restoring" | "connecting" | "connected" | "disconnected" | "error";

export type WalletContextValue = {
  status: ConnectionStatus;
  session: WalletSession | null;
  hardwareSession: HardwareWalletSession | null;
  errorCode: WalletError | null;
  errorMessage: string | null;
  isLoading: boolean;
  isConnectModalOpen: boolean;
  isLedgerModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  openLedgerModal: () => void;
  closeLedgerModal: () => void;
  connect: () => Promise<void>;
  connectWith: (walletId: SupportedWallet) => Promise<void>;
  connectLedger: (
    session: HardwareWalletSession,
    bridge?: LedgerStellarBridge,
  ) => void;
  disconnect: () => void;
  clearError: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [session, setSession] = useState<WalletSession | null>(null);
  const [hardwareSession, setHardwareSession] =
    useState<HardwareWalletSession | null>(null);
  const [errorCode, setErrorCode] = useState<WalletError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setStatus("restoring");
    restoreSession()
      .then((saved) => {
        if (saved) {
          setSession(saved);
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      })
      .catch(() => {
        setStatus("disconnected");
      });
  }, []);

  const openConnectModal = useCallback(() => setIsConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setIsConnectModalOpen(false), []);
  const openLedgerModal = useCallback(() => setIsLedgerModalOpen(true), []);
  const closeLedgerModal = useCallback(() => setIsLedgerModalOpen(false), []);

  const clearError = useCallback(() => {
    setErrorCode(null);
    setErrorMessage(null);
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setStatus("connecting");
    clearError();
    try {
      const s = await connectWallet();
      setSession(s);
      setStatus("connected");
    } catch (err: unknown) {
      setStatus("error");
      const msg =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [clearError]);

  const connectWith = useCallback(
    async (walletId: SupportedWallet) => {
      if (walletId === ("ledger" as SupportedWallet)) {
        openLedgerModal();
        return;
      }
      setIsLoading(true);
      setStatus("connecting");
      clearError();
      try {
        const s = await connectWalletWith(walletId);
        setSession(s);
        setStatus("connected");
      } catch (err: unknown) {
        setStatus("error");
        const msg =
          err instanceof Error ? err.message : "Failed to connect wallet";
        setErrorMessage(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [clearError, openLedgerModal],
  );

  const connectLedger = useCallback(
    (hSession: HardwareWalletSession) => {
      setHardwareSession(hSession);
      const mockSession: WalletSession = {
        address: hSession.address,
        network: "testnet",
        walletId: "freighter",
      };
      setSession(mockSession);
      setStatus("connected");
      closeLedgerModal();
    },
    [closeLedgerModal],
  );

  const disconnect = useCallback(() => {
    disconnectWallet();
    setSession(null);
    setHardwareSession(null);
    setStatus("disconnected");
  }, []);

  return (
    <WalletContext.Provider
      value={{
        status,
        session,
        hardwareSession,
        errorCode,
        errorMessage,
        isLoading,
        isConnectModalOpen,
        isLedgerModalOpen,
        openConnectModal,
        closeConnectModal,
        openLedgerModal,
        closeLedgerModal,
        connect,
        connectWith,
        connectLedger,
        disconnect,
        clearError,
      }}
    >
      {children}
      <LedgerModal
        isOpen={isLedgerModalOpen}
        onClose={closeLedgerModal}
        onConnected={connectLedger}
      />
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
