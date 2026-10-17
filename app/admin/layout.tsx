import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "Admin Portal — AWS Student Builder Group",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already guarantees a signed-in user. Here we also require
  // that the user is actually an admin (row in public.admin_users).
  const result = await getAdminSession();

  if (!result.ok && result.reason !== "misconfigured") {
    redirect("/login");
  }

  if (!result.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Admin access is not configured</h1>
          <p className="mt-2 text-sm opacity-70">
            The admin_users table is missing or unreachable. Apply the latest
            database migration, then reload.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
