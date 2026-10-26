"use client";

import Image from "next/image";

type TeamMascotProps = {
  variant: "hero" | "leadership" | "wings" | "faq" | "footer";
  alt: string;
  className?: string;
};

export function TeamMascot({ alt, className = "" }: TeamMascotProps) {
  return (
    <Image
      src="/chatbotmascot.webp"
      alt={alt}
      fill
      sizes="(max-width: 768px) 80vw, 420px"
      className={className}
      unoptimized
    />
  );
}
