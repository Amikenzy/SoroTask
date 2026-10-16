import type { Metadata } from "next";
import { KeeperMarketplace } from "./components/KeeperMarketplace";
import { TradingChart } from "@/src/components/TradingChart";

export const metadata: Metadata = {
  title: "Marketplace & Autonomous Trading | SoroTask",
  description:
    "Autonomous limit order management with TradingView chart integration, depth profiles, and keeper priority bidding.",
};

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-2">
        <TradingChart />
      </div>
      <KeeperMarketplace />
    </div>
  );
}
