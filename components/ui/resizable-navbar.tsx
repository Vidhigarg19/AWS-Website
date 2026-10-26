"use client";
import { cn } from "@/lib/utils";
import { Menu } from "@/components/ui/animate-ui/icons/menu";
import { X } from "@/components/ui/animate-ui/icons/x";
import { usePathname } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";

import React, { useRef, useState } from "react";


interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest: number) => {
    if (latest > 100) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div
      // IMPORTANT: Change this to class of `fixed` if you want the navbar to be fixed
      className={cn("sticky inset-x-0 top-4 sm:top-6 lg:top-8 z-40 w-full", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== "string"
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
          : "none",
        width: visible ? "40%" : "100%",
        y: visible ? 20 : 16,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      style={{
        minWidth: "950px",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full border border-[rgba(255,153,0,0.18)] bg-[rgba(15,12,8,0.72)] shadow-lg px-4 py-2 backdrop-blur-[16px] lg:flex",
        visible && "bg-[rgba(15,12,8,0.82)]",
        className,
      )}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== "string"
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const pathname = usePathname();

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-text-secondary transition duration-200 lg:flex lg:space-x-2",
        className,
      )}
    >
      {items.map((item, idx) => {
        const isActive = pathname === item.link;
        return (
          <a
            onMouseEnter={() => setHovered(idx)}
            onClick={onItemClick}
            className={cn(
              "relative px-4 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9900]",
              isActive
                ? "text-[#FF9900]"
                : "text-white/65 hover:text-[#FF9900]"
            )}
            key={`link-${idx}`}
            href={item.link}
          >
            {isActive && (
              <motion.div
                layoutId="active"
                className="absolute inset-0 h-full w-full rounded-full bg-[rgba(255,153,0,0.15)]"
              />
            )}
            {hovered === idx && !isActive && (
              <motion.div
                layoutId="hovered"
                className="absolute inset-0 h-full w-full rounded-full bg-[rgba(255,153,0,0.12)]"
              />
            )}
            <span className="relative z-20">{item.name}</span>
          </a>
        );
      })}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
          : "none",
        width: visible ? "90%" : "100%",
        borderRadius: "9999px",
        y: visible ? 20 : 16,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between self-start rounded-full border border-[rgba(255,153,0,0.18)] bg-[rgba(15,12,8,0.72)] shadow-lg px-4 py-2 backdrop-blur-[16px] lg:hidden",
        visible && "bg-[rgba(15,12,8,0.82)]",
        className,
      )}
      style={{ overflow: "visible" }}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== "string"
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
  visible,
}: MobileNavHeaderProps & { visible?: boolean }) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== "string"
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 -z-10 h-[100dvh] w-screen bg-bg/40 sm:hidden"
            style={{ pointerEvents: "auto" }}
          />
          
          {/* Menu Container */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "absolute inset-x-0 top-[calc(100%+0.75rem)] z-50 flex w-full flex-col items-start justify-start gap-1 rounded-2xl border border-[rgba(255,153,0,0.25)] bg-[#0F0C08]/95 p-3 shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,153,0,0.08)_inset] backdrop-blur-xl",
              className,
            )}
          >
            {/* Decorative top accent */}
            <div className="mx-auto mb-2 h-[2px] w-12 rounded-full bg-gradient-to-r from-transparent via-[#FF9900]/70 to-transparent" />
            {/* Stagger children (nav items) with cascading entrance */}
            <div className="flex w-full flex-col gap-1">
              {React.Children.map(children, (child, index) => (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.15,
                    delay: 0.05 + index * 0.04,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                >
                  {child}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="relative z-20 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-[rgba(255,153,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9900] active:scale-90"
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <X size={20} className="text-text-primary" />
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ opacity: 0, rotate: 90, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Menu size={20} className="text-text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export const NavbarLogo = ({ visible }: { visible?: boolean }) => {
  return (
    <a
      href="/"
      className="relative z-20 mr-4 flex items-center space-x-2.5 rounded-xl px-1 py-1 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9900]"
    >
      <div className="relative bg-black/40 border rounded-xl flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 p-1.5 overflow-hidden shrink-0">

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
            duration: 2,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
          }}
          style={{ willChange: "transform" }}
        />
      </div>
      {!visible && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex flex-col"
        >
          {/* Full name on desktop, abbreviated on mobile */}
          <span className="font-bold tracking-wide text-text-primary text-xs sm:text-sm leading-tight hidden sm:block">
            AWS STUDENT BUILDER GROUP
          </span>
          <span className="font-bold tracking-wide text-text-primary text-xs leading-tight sm:hidden">
            AWS Student Builder Group
          </span>
          <span className="text-text-secondary text-[10px] sm:text-[11px] leading-tight hidden sm:block">
            at Tulas University Dehradun
          </span>
          <span className="text-text-secondary text-[9px] sm:text-[10px] leading-tight sm:hidden">
            Tulas University
          </span>
        </motion.div>
      )}
    </a>
  );
};


export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-5 py-2 rounded-full text-[13px] font-semibold relative cursor-pointer hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-300 inline-block text-center tracking-wide overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF9900]";
  const variantStyles = {
    primary:
      "border border-[rgba(255,153,0,0.25)] bg-[#FF9900] text-[#070604] shadow-[0_2px_12px_rgba(255,153,0,0.3)] hover:border-[rgba(255,153,0,0.45)] hover:bg-[#E68A00] hover:shadow-[0_4px_22px_rgba(255,153,0,0.55)] hover:scale-[1.04]",
    secondary: "bg-transparent shadow-none dark:text-white",
    dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    gradient:
      "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
  };

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-[#FFB733]/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative z-10">{children}</span>
    </Tag>
  );
};
