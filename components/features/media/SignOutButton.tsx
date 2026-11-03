"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/media/login");
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={busy}
      className="h-9 px-3.5 rounded-xl text-xs font-medium text-[#71717A] hover:text-red-400 hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/20 transition-all flex items-center gap-2 cursor-pointer bg-white/[0.02] disabled:opacity-50"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>{busy ? "Signing out…" : "Sign Out"}</span>
    </button>
  );
}
