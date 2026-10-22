"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  GraduationCap,
  SlidersHorizontal,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);

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
      setIsMobileNavOpen(false);
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

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileDrawerRef.current?.querySelector<HTMLButtonElement>("nav button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      mobileMenuButtonRef.current?.focus();
    };
  }, [isMobileNavOpen]);

  return (
    <header className="fixed inset-x-0 top-0 w-full z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-4">
        <div className="hidden lg:flex items-center justify-between gap-3 rounded-full bg-white/5 border border-white/10 shadow-lg px-3.5 sm:px-5 py-2 dark:bg-black/25 dark:border-white/10 backdrop-blur-[16px]">
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
        <div className="flex lg:hidden h-14 items-center justify-between gap-3 rounded-2xl bg-[#0C0C12]/95 border border-white/10 shadow-lg px-3.5 backdrop-blur-[16px]">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#D4D4D8] hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
            aria-label={isMobileNavOpen ? "Close admin navigation" : "Open admin navigation"}
            aria-expanded={isMobileNavOpen}
            aria-controls="admin-mobile-navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white">
            {isMediaLead ? "Media Studio" : "Admin Portal"}
          </span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("admin-logout-request"))}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#A1A1AA] hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Sign out of Admin Portal"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className={cn("fixed inset-0 z-[60] lg:hidden", isMobileNavOpen ? "block" : "hidden")}
        aria-hidden={!isMobileNavOpen}
      >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close admin navigation"
          />
          <aside
            id="admin-mobile-navigation"
            ref={mobileDrawerRef}
            className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] max-w-full flex-col border-r border-white/10 bg-[#0B0B11] p-4 shadow-2xl"
            aria-label="Admin navigation"
          >
            <div className="mb-5 flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {isMediaLead ? "Media Studio" : "Admin Portal"}
                </p>
                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
                  Navigation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#A1A1AA] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
                aria-label="Close admin navigation"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Admin functions navigation" className="flex flex-col gap-1.5">
              {(isMediaLead ? NAV_LINKS.filter((link) => link.id === "events") : NAV_LINKS).map((link) => {
                const Icon = link.icon;
                const isActive = activeTab === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleTabClick(link.id)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]",
                      isActive
                        ? "border border-[#6C63FF]/40 bg-[#6C63FF]/20 font-semibold text-[#C4B5FD]"
                        : "border border-transparent text-[#D4D4D8] hover:bg-white/[0.05]"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
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
