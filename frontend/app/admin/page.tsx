"use client";

import Link from "next/link";
import { withRouteGuard } from "@/lib/routeGuards";
import { useAuth } from "@/context/AuthContext";

function AdminPage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Administration</p>
        <h1 className="mt-2 text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-neutral-400">
          Review access controls and manage protocol permissions.
        </p>

        <section className="mt-8 grid gap-5 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">RBAC administration</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
                  Inspect protocol roles, edit granular permission bitmasks, grant or revoke access,
                  manage expiring delegation tickets, and review the role-change timeline.
                </p>
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                Preview mode
              </span>
            </div>
            <Link
              href="/settings/rbac"
              className="mt-6 inline-flex items-center rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
            >
              Open RBAC dashboard <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="text-lg font-semibold">Signed-in administrator</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Name</dt>
                <dd className="mt-0.5 text-neutral-200">{user?.name || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Address</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-neutral-300">{user?.address || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Granted admin permissions</dt>
                <dd className="mt-0.5 text-neutral-200">
                  {user?.permissions.filter((permission) => permission.startsWith("admin:")).join(", ") || "None"}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <p className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs leading-relaxed text-neutral-400">
          RBAC contract and API integration are not configured in this repository. Dashboard changes are an
          interactive preview and are not submitted to the Stellar network.
        </p>
      </div>
    </main>
  );
}

export default withRouteGuard(AdminPage, ["admin:users"], {
  redirectTo: "/unauthorized",
});
