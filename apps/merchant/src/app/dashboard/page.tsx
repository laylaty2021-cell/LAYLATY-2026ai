"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Organization, Store } from "@/lib/types";
import { CreateOrganizationForm } from "./create-organization-form";
import { CreateStoreForm } from "./create-store-form";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending_review: "bg-amber-100 text-amber-800",
  draft: "bg-zinc-100 text-zinc-700",
  suspended: "bg-red-100 text-red-800",
  closed: "bg-zinc-100 text-zinc-500",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export default function DashboardPage() {
  const { status, logout } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [stores, setStores] = useState<Store[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [orgs, myStores] = await Promise.all([
        apiFetch<Organization[]>("/organizations"),
        apiFetch<Store[]>("/merchant/stores"),
      ]);
      setOrganizations(orgs);
      setStores(myStores);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      // Fetch-on-mount/status-change is the standard data-loading effect
      // pattern; loadData sets state asynchronously once the fetch resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [status, router, loadData]);

  if (status !== "authenticated" || organizations === null || stores === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">{error ?? "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Merchant Dashboard</h1>
        <button
          onClick={() => logout().then(() => router.replace("/login"))}
          className="text-sm text-zinc-500 underline"
        >
          Log out
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {organizations.length === 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-medium text-zinc-900">
            Start your merchant onboarding
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Create your organization first (blueprint §8) — you&apos;ll create a
            store under it next.
          </p>
          <CreateOrganizationForm onCreated={loadData} />
        </section>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-900">Your organizations</h2>
            <ul className="space-y-2">
              {organizations.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
                >
                  <span className="font-medium text-zinc-900">{org.name}</span>
                  <StatusBadge status={org.status} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-900">Your stores</h2>
            {stores.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <p className="mb-4 text-sm text-zinc-500">
                  No stores yet. Create one under an organization to enable its
                  Business Template modules (blueprint §9).
                </p>
                <CreateStoreForm organizations={organizations} onCreated={loadData} />
              </div>
            ) : (
              <ul className="space-y-2">
                {stores.map((store) => (
                  <li key={store.id}>
                    <Link
                      href={`/dashboard/stores/${store.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300"
                    >
                      <div>
                        <p className="font-medium text-zinc-900">{store.name}</p>
                        <p className="text-sm text-zinc-500">
                          {store.businessType.replace("_", " ")} · /{store.slug}
                        </p>
                      </div>
                      <StatusBadge status={store.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-sm text-zinc-400">
            Catalog, bookings, and order management aren&apos;t built yet in this
            dashboard — see docs/backlog/sprint-backlog.md for what&apos;s next.
          </p>
        </div>
      )}
    </main>
  );
}
