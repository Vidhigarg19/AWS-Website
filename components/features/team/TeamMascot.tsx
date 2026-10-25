"use client";

import { useState } from "react";
import Image from "next/image";

type TeamMascotProps = {
  variant: "hero" | "leadership" | "wings" | "faq" | "footer";
  alt: string;
  className?: string;
};

export function TeamMascot({ variant, alt, className = "" }: TeamMascotProps) {
  const [src, setSrc] = useState(`/team/mascot/kio-${variant}.png`);
  const [usingFallback, setUsingFallback] = useState(false);

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 80vw, 420px"
      className={className}
      onError={() => {
        if (!usingFallback) {
          setUsingFallback(true);
          setSrc("/chatbotmascot.webp");
        }
      }}
    />
  );
}
