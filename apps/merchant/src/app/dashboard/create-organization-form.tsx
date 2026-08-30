"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Organization } from "@/lib/types";

export function CreateOrganizationForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [commercialRegistration, setCommercialRegistration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<Organization>("/organizations", {
        method: "POST",
        body: {
          name,
          commercialRegistration: commercialRegistration || undefined,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">Organization name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Commercial registration (optional)
        </label>
        <input
          value={commercialRegistration}
          onChange={(e) => setCommercialRegistration(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
