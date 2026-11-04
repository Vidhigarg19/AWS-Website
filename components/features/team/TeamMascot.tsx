"use client";

import Image from "next/image";

type TeamMascotProps = {
  alt: string;
  className?: string;
  src?: string;
};

export function TeamMascot({
  alt,
  className = "",
  src = "/chatbotmascot.webp",
}: TeamMascotProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 80vw, 420px"
      className={className}
      unoptimized
    />
  );
}
