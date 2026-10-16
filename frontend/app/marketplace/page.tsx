import type { Metadata } from 'next';
import Link from 'next/link';
import { KeeperMarketplace } from './components/KeeperMarketplace';

export const metadata: Metadata = {
  title: 'Marketplace | SoroTask',
  description: 'Browse keeper profiles, task templates, and priority execution bids.',
};

export default function MarketplacePage() {
  return (
    <div className="space-y-4">
      <div className="mx-6 mt-4 flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex gap-3">
          <Link
            href="/marketplace"
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow"
          >
            Keeper Bidding Marketplace
          </Link>
          <Link
            href="/marketplace/templates"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          >
            Decentralized Template Marketplace →
          </Link>
        </div>
      </div>
      <KeeperMarketplace />
    </div>
  );
}
