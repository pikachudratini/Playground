"use client";

import { useRef, useState } from "react";

export default function LeadForm({
  visitorId,
  funnelId,
  pageId,
  ctaText,
}: {
  visitorId: string;
  funnelId: string;
  pageId: string;
  ctaText: string;
}) {
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const ctaFired = useRef(false);

  function trackEngagement() {
    if (ctaFired.current) return;
    ctaFired.current = true;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ visitorId, funnelId, pageId, type: "cta_click" }),
    }).catch(() => {});
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          funnelId,
          pageId,
          name: String(data.get("name") ?? "").trim(),
          email,
          fields: {},
        }),
      });
      if (!res.ok) throw new Error("capture failed");
      setDone(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-lg text-emerald-600">
          ✓
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900">You&apos;re in.</h3>
        <p className="mt-1 text-sm text-slate-500">
          Thanks — we&apos;ll be in touch shortly. The agent has already qualified
          you and added you to the CRM.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200"
    >
      <input
        name="name"
        placeholder="Your name"
        onFocus={trackEngagement}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Work email"
        onFocus={trackEngagement}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {submitting ? "Sending…" : ctaText}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">
        No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}
