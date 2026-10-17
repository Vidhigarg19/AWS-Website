import { notFound } from "next/navigation";

/**
 * /demo/* is a component playground, not part of the product. It must not be
 * reachable (or indexed) on the live site, so it only exists in development.
 * To remove it entirely, delete the app/demo folder.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
