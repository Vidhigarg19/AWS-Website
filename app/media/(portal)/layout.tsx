import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/require-role";
import { isRoleAllowed, MEDIA_PORTAL_ROLES, type PortalRole } from "@/lib/auth/roles";
import { SignOutButton } from "@/components/features/media/SignOutButton";

const ROLE_LABEL: Record<PortalRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  media_manager: "Media team",
};

// Everything inside this route group requires a signed-in user who holds a
// media-portal role. /media/login lives OUTSIDE this group on purpose, so it
// stays public and cannot cause a redirect loop.
export default async function MediaPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getPortalSession();

  if (!result.ok && result.reason === "misconfigured") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Media portal is not configured</h1>
          <p className="mt-2 text-sm opacity-70">
            The media_members table is missing or unreachable. Apply the latest
            database migration, then reload.
          </p>
        </div>
      </main>
    );
  }

  if (!result.ok || !isRoleAllowed(result.session.role, MEDIA_PORTAL_ROLES)) {
    redirect("/media/login");
  }

  const { user, role, displayName } = result.session;

  return (
    <div
      className="min-h-screen text-[#F4F4F6] selection:bg-[#6C63FF]/30 pb-24"
      style={{
        background: `
          radial-gradient(1000px 500px at 15% 0%, rgba(108,99,255,0.14), transparent 70%),
          radial-gradient(800px 400px at 85% 10%, rgba(255,153,0,0.06), transparent 70%),
          #08080B
        `,
      }}
    >
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">
              AWS SBG · Media Portal
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              {displayName ?? user.email}
            </h1>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              {user.email} · <span className="text-[#8B83FF]">{ROLE_LABEL[role]}</span>
            </p>
          </div>
          <SignOutButton />
        </header>
        {children}
      </main>
    </div>
  );
}
