"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

function OtpVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = searchParams.get("identifier") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/otp/verify", {
        method: "POST",
        body: { identifier, code, purpose: "register" },
        auth: false,
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <h1 className="text-xl font-semibold text-zinc-900">Verify your account</h1>
      <p className="text-sm text-zinc-500">We sent a code to {identifier}</p>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">6-digit code</label>
        <input
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tracking-widest"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}

export default function OtpVerifyPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <OtpVerifyForm />
      </Suspense>
    </main>
  );
}
