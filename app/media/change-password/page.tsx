import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPortalSession } from "@/lib/auth/require-role";
import { isRoleAllowed, MEDIA_PORTAL_ROLES } from "@/lib/auth/roles";
import { ChangePasswordForm } from "@/components/features/media/ChangePasswordForm";

// Signed-in only. Lives OUTSIDE the (portal) group on purpose: the portal layout
// sends members who still have a temporary password HERE, so this page must not
// use that layout (it would redirect to itself forever).
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const result = await getPortalSession();
  if (!result.ok || !isRoleAllowed(result.session.role, MEDIA_PORTAL_ROLES)) {
    redirect("/media/login");
  }
  const { user, mustChangePassword } = result.session;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 text-[#F4F4F6]"
      style={{ background: "radial-gradient(1000px 500px at 15% 0%, rgba(108,99,255,0.14), transparent 70%), #08080B" }}
    >
      <main className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <header>
          <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">AWS SBG · Media Portal</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {mustChangePassword ? "Choose your own password" : "Change password"}
          </h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">
            {mustChangePassword
              ? "Your account was set up with a temporary password. Choose your own to continue. Only you should know it."
              : `Signed in as ${user.email}. Other devices will be signed out when you change it.`}
          </p>
        </header>

        <ChangePasswordForm email={user.email ?? null} forced={mustChangePassword} />

        {!mustChangePassword && (
          <Link href="/media" className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to the portal
          </Link>
        )}
      </main>
    </div>
  );
}
