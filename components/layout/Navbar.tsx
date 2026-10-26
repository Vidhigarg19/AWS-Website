"use client";
import {
  Navbar as ResizableNavbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRecruitment } from "@/hooks/useRecruitment";
import { AdminNavbar } from "@/components/layout/AdminNavbar";

export function Navbar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return <AdminNavbar />;
  }

  const BUILDER_CENTER_URL = "https://www.meetup.com/tulas-university-dehradun/";

  const navItems = [
    {
      name: "Home",
      link: "/",
    },
    {
      name: "About",
      link: "/about",
    },
    {
      name: "Events",
      link: "/events",
    },
    {
      name: "Team",
      link: "/team",
    },
    {
      name: "Learning Hub",
      link: "/learning-hub",
    },
    {
      name: "Gallery",
      link: "/gallery",
    },
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-0 w-full z-50">
      <ResizableNavbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-4">
            <NavbarButton as={Link} href="/register" variant="primary">
              Join Group
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <Link
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative w-full rounded-xl px-4 py-3 text-[15px] font-medium transition-colors transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9900] active:scale-[0.98] ${
                  pathname === item.link
                    ? "bg-[rgba(255,153,0,0.15)] text-[#FF9900]"
                    : "text-white/65 hover:bg-[rgba(255,153,0,0.12)] hover:text-[#FF9900]"
                }`}
              >
                <span className="block">{item.name}</span>
              </Link>
            ))}
            <div className="mt-2 flex w-full flex-col gap-3 border-t border-white/5 pt-3">
              <NavbarButton
                as={Link}
                href="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                variant="primary"
                className="w-full"
              >
                Join Group
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </ResizableNavbar>
    </div>
  );
}
