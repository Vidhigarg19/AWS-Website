"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only ever send people back to somewhere inside the media portal. */
function safeRedirectTarget(): string {
  const target = new URLSearchParams(window.location.search).get("redirect");
  if (target && target.startsWith("/media") && !target.startsWith("//") && !target.startsWith("/media/login")) {
    return target;
  }
  return "/media";
}

export default function MediaLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError("Invalid email or password.");
        return;
      }

      // Signing in is not enough: the account must have media access.
      const res = await fetch("/api/media/me", { cache: "no-store" });
      if (!res.ok) {
        await supabase.auth.signOut();
        setError(
          res.status === 403
            ? "This account does not have media portal access. Ask a super admin to create your media account."
            : "Could not verify your access. Please try again."
        );
        return;
      }

      // Still on the temporary password: go straight to the form that replaces it.
      const me = await res.json().catch(() => null);
      router.push(me?.data?.mustChangePassword ? "/media/change-password" : safeRedirectTarget());
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-bg relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <Card className="w-full max-w-sm z-10 border-white/10 bg-bg/60 backdrop-blur-xl shadow-2xl p-0">
        <CardHeader className="border-b border-white/10 p-6 pb-4">
          <CardTitle className="text-2xl font-display text-text-primary">Media Portal</CardTitle>
          <CardDescription className="text-text-secondary">
            Sign in to upload and manage event photos and videos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form id="media-login-form" onSubmit={handleLogin}>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-text-primary">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                  className="bg-black/20 border-white/10 text-text-primary focus:border-primary/50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-text-primary">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required
                  autoComplete="current-password"
                  className="bg-black/20 border-white/10 text-text-primary focus:border-primary/50"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-400 text-center">{error}</p>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t border-white/10 p-6 pt-4">
          <Button
            type="submit"
            form="media-login-form"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium h-10 cursor-pointer"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
