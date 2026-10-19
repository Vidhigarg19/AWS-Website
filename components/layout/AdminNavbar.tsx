"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  GraduationCap,
  SlidersHorizontal,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminTab = "overview" | "events" | "registrations" | "team" | "settings";

const NAV_LINKS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "events", label: "Events", icon: Calendar },
  { id: "registrations", label: "Registrations", icon: Users },
  { id: "team", label: "Team", icon: GraduationCap },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

function AdminNavbarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isMediaLead, setIsMediaLead] = useState(false);

  // Check role on mount
  useEffect(() => {
    const checkRole = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        if (
          user.email?.toLowerCase().includes("media") ||
          user.user_metadata?.role === "media"
        ) {
          setIsMediaLead(true);
          setActiveTab("events");
          return;
        }

        const { data } = await supabase
          .from("admin_users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.role === "media" || data?.role === "media_lead") {
          setIsMediaLead(true);
          setActiveTab("events");
        }
      } catch {
        // fail gracefully
      }
    };
    checkRole();
  }, []);

  // Sync from URL search params
  useEffect(() => {
    if (isMediaLead) {
      setActiveTab("events");
      return;
    }
    const tab = searchParams.get("tab") as AdminTab | null;
    if (tab && NAV_LINKS.some((l) => l.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, isMediaLead]);

  // Sync from custom window event
  useEffect(() => {
    const handler = (e: Event) => {
      if (isMediaLead) return;
      const custom = e as CustomEvent<AdminTab>;
      if (custom.detail) {
        setActiveTab(custom.detail);
      }
    };
    window.addEventListener("admin-tab-change", handler);
    return () => window.removeEventListener("admin-tab-change", handler);
  }, [isMediaLead]);

  const handleTabClick = useCallback(
    (tabId: AdminTab) => {
      if (isMediaLead && tabId !== "events") return;
      setActiveTab(tabId);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tabId);
        window.history.replaceState({}, "", url.toString());
        window.dispatchEvent(new CustomEvent("admin-tab-change", { detail: tabId }));
      }
      router.push(`/admin?tab=${tabId}`, { scroll: false });
    },
    [router, isMediaLead]
  );

  return (
    <header className="fixed inset-x-0 top-0 w-full z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-4">
        <div className="flex items-center justify-between gap-3 rounded-full bg-white/5 border border-white/10 shadow-lg px-3.5 sm:px-5 py-2 dark:bg-black/25 dark:border-white/10 backdrop-blur-[16px]">
          {/* Left: Full Logo with texts */}
          <Link
            href="/"
            className="relative z-20 flex items-center space-x-2.5 sm:space-x-3 px-1 py-0.5 group transition-opacity hover:opacity-95 shrink-0"
            title="AWS SBG — Go to Public Home"
          >
            <div className="relative bg-black/40 border border-white/10 rounded-xl flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 p-1.5 overflow-hidden shrink-0 shadow-md">
              <img
                src="/logos/SBG_logo.png"
                alt="AWS SBG Logo"
                className="w-full h-full object-contain relative z-10"
              />
              <motion.div
                className="absolute top-0 left-0 size-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 pointer-events-none"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 2.2,
                  ease: "linear",
                  repeat: Infinity,
                  repeatType: "loop",
                }}
                style={{ willChange: "transform" }}
              />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-wide text-text-primary text-[11px] sm:text-xs leading-tight group-hover:text-primary-light transition-colors truncate">
                AWS STUDENT BUILDER GROUP
              </span>
              <span className="text-text-secondary text-[9px] sm:text-[10px] leading-tight truncate">
                at Tulas University Dehradun
              </span>
            </div>
          </Link>

          {/* Right: Quick Admin Function Navigation */}
          <nav
            aria-label="Admin functions navigation"
            className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full"
          >
            {(isMediaLead ? NAV_LINKS.filter((l) => l.id === "events") : NAV_LINKS).map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleTabClick(link.id)}
                  className={cn(
                    "h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-[#6C63FF]/25 text-[#A78BFA] border border-[#6C63FF]/40 font-semibold shadow-sm"
                      : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.05]"
                  )}
                  title={`Go to ${link.label}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </button>
              );
            })}
            {isMediaLead && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold ml-1 shrink-0">
                Media Studio
              </span>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function AdminNavbar() {
  return (
    <Suspense fallback={null}>
      <AdminNavbarContent />
    </Suspense>
  );
}
