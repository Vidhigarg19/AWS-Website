"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { checkNewPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ email, forced }: { email: string | null; forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Same rules as the server (lib/auth/password-policy.ts), shown as you type.
  const policyProblem = next.length > 0 ? checkNewPassword(next, { currentPassword: current, email }) : null;
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current.length > 0 && next.length > 0 && !policyProblem && confirm === next;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        router.push("/media");
        router.refresh();
        return;
      }
      setError(typeof json?.error === "string" ? json.error : "Something went wrong.");
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/media/login");
      router.refresh();
    }
  };

  const field =
    "w-full rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-[#8B5CF6] focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email ?? ""} readOnly hidden />

      <div className="space-y-1.5">
        <label htmlFor="current-password" className="text-sm text-[#D4D4D8]">
          {forced ? "Temporary password" : "Current password"}
        </label>
        <input
          id="current-password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={current}
          onChange={(e) => { setCurrent(e.target.value); setError(null); }}
          required
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm text-[#D4D4D8]">New password</label>
        <input
          id="new-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={next}
          onChange={(e) => { setNext(e.target.value); setError(null); }}
          required
          aria-describedby="new-password-help"
          className={field}
        />
        <p id="new-password-help" className={`text-xs ${policyProblem ? "text-amber-400" : "text-[#71717A]"}`}>
          {policyProblem ?? `At least ${MIN_PASSWORD_LENGTH} characters. A few unrelated words works well.`}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm text-[#D4D4D8]">Confirm new password</label>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(null); }}
          required
          className={field}
        />
        {mismatch && <p className="text-xs text-amber-400">The two passwords do not match.</p>}
      </div>

      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex items-center gap-2 text-xs text-[#A1A1AA] hover:text-white"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
        {show ? "Hide passwords" : "Show passwords"}
      </button>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || (touched && !ready)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Saving…" : "Change password"}
        </button>
        {forced && (
          <button type="button" onClick={signOut} className="text-xs text-[#71717A] hover:text-white">
            Sign out
          </button>
        )}
      </div>
    </form>
  );
}
