"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, UserPlus } from "lucide-react";

interface Member {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  created_at: string;
}

interface Credentials {
  email: string;
  password: string;
  reason: "created" | "reset";
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const inputClass =
  "h-10 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 text-sm text-[#F4F4F6] placeholder:text-[#52525B] focus:border-[#6C63FF]/60 focus:outline-none";

export default function MediaMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/media-users", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<Member[]>;
      if (!res.ok || !json.success) {
        setError(
          res.status === 403
            ? "Only a super admin can manage media members."
            : json.error ?? "Failed to load media members."
        );
        return;
      }
      setMembers(json.data ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setCredentials(null);
    try {
      const res = await fetch("/api/admin/media-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName }),
      });
      const json = (await res.json()) as ApiResult<{ email: string; temporaryPassword: string }>;
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? "Could not create the account.");
        return;
      }
      setCredentials({ email: json.data.email, password: json.data.temporaryPassword, reason: "created" });
      setEmail("");
      setDisplayName("");
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const patchMember = async (member: Member, body: { active?: boolean; resetPassword?: boolean }) => {
    setError("");
    setCredentials(null);
    try {
      const res = await fetch(`/api/admin/media-users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResult<{ temporaryPassword?: string }>;
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not update the member.");
        return;
      }
      if (json.data?.temporaryPassword) {
        setCredentials({ email: member.email, password: json.data.temporaryPassword, reason: "reset" });
      }
      await load();
    } catch {
      setError("Network error. Please try again.");
    }
  };

  const copyPassword = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the password is visible on screen to copy by hand */
    }
  };

  return (
    <div
      className="min-h-screen text-[#F4F4F6] pb-24"
      style={{
        background:
          "radial-gradient(1000px 500px at 15% 0%, rgba(108,99,255,0.14), transparent 70%), #08080B",
      }}
    >
      <main className="mx-auto max-w-4xl space-y-8 px-4 pt-28 sm:px-6 sm:pt-36">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold">Media members</h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Accounts for the media team. They sign in at{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">/media/login</code> and can
              never open the admin dashboard.
            </p>
          </div>
          <a
            href="/admin"
            className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 text-xs font-medium leading-9 text-[#A1A1AA] hover:text-white"
          >
            ← Back to dashboard
          </a>
        </header>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {credentials && (
          <div role="status" className="space-y-3 rounded-2xl border border-[#6C63FF]/30 bg-[#6C63FF]/10 p-5">
            <p className="text-sm font-medium">
              {credentials.reason === "created" ? "Account created." : "Password reset."} Share these
              details securely.
            </p>
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2"><dt className="w-24 text-[#A1A1AA]">Email</dt><dd>{credentials.email}</dd></div>
              <div className="flex items-center gap-2">
                <dt className="w-24 text-[#A1A1AA]">Password</dt>
                <dd className="font-mono">{credentials.password}</dd>
                <button
                  onClick={copyPassword}
                  className="ml-1 flex items-center gap-1 rounded-lg border border-white/[0.1] px-2 py-1 text-xs hover:bg-white/[0.06] cursor-pointer"
                >
                  <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </dl>
            <p className="text-xs text-[#A1A1AA]">
              This password is shown only once and is not stored. If it is lost, reset it.
            </p>
          </div>
        )}

        <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-xs text-[#A1A1AA]">
            Full name
            <input
              className={inputClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Aarav Sharma"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label className="grid gap-1.5 text-xs text-[#A1A1AA]">
            Email
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              required
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6C63FF] px-4 text-sm font-medium text-white hover:bg-[#5B52F0] disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <section aria-labelledby="members-heading" className="space-y-3">
          <h2 id="members-heading" className="text-lg font-semibold">
            Current members {members.length > 0 && <span className="text-[#71717A]">({members.length})</span>}
          </h2>

          {loading ? (
            <p className="text-sm text-[#A1A1AA]">Loading…</p>
          ) : members.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-[#A1A1AA]">
              No media members yet.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.display_name}</p>
                    <p className="truncate text-xs text-[#A1A1AA]">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        m.active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {m.active ? "Active" : "Disabled"}
                    </span>
                    <button
                      onClick={() => patchMember(m, { resetPassword: true })}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-xs hover:bg-white/[0.06] cursor-pointer"
                    >
                      <KeyRound className="h-3 w-3" /> Reset password
                    </button>
                    <button
                      onClick={() => patchMember(m, { active: !m.active })}
                      className="rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-xs hover:bg-white/[0.06] cursor-pointer"
                    >
                      {m.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
