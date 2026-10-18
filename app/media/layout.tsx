import type { Metadata } from "next";

// Applies to /media/login and everything in the portal: keep it out of search.
export const metadata: Metadata = {
  title: "Media Portal",
  robots: { index: false, follow: false },
};

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
