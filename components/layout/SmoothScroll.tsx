"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      // Smooth scroll settings
      autoRaf: false, // We'll handle requestAnimationFrame via GSAP ticker
    });

    if (typeof window !== "undefined") {
      (window as any).__lenis = lenis;
    }

    lenis.on("scroll", ScrollTrigger.update);

    // Sync GSAP ticker with Lenis
    const update = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // Keep Lenis and ScrollTrigger in sync whenever dynamic content modifies document height
    let resizeTimer: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lenis.resize();
        ScrollTrigger.refresh();
      }, 100);
    });

    if (typeof document !== "undefined" && document.body) {
      resizeObserver.observe(document.body);
    }

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      lenis.destroy();
      gsap.ticker.remove(update);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Recalculate all ScrollTrigger positions after route change
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname]);


  return <>{children}</>;
}
