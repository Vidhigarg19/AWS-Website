"use client";

import { cn } from "@/lib/utils";
import React, { useRef, useState, MouseEvent } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  borderColor?: string;
  radius?: number;
}

export const SpotlightCard = ({
  children,
  className,
  spotlightColor = "rgba(167, 139, 250, 0.025)",
  borderColor = "rgba(192, 132, 252, 0.08)",
  radius = 200,
  ...props
}: SpotlightCardProps) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => {
    setOpacity(0.65);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/80 bg-bg-card/70 cursor-pointer backdrop-blur-md transition-all duration-500 hover:bg-bg-card hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(124,58,237,0.04)]",
        className
      )}
      {...props}
    >
      {/* 1. Tight Border Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(${Math.round(radius * 0.8)}px circle at ${position.x}px ${position.y}px, ${borderColor}, transparent 70%)`,
        }}
      />

      {/* 2. Compact Inner Glow */}
      <div
        className="pointer-events-none absolute inset-px rounded-[15px] transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(${radius}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 65%)`,
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};
