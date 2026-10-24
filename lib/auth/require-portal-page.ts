// ============================================================
// Permission check for portal PAGES (server components)
// ============================================================
//
// Why pages must check, not only the layout: in the Next.js App Router a
// layout is NOT re-rendered when you navigate between pages inside it. A
// member who was deactivated after the portal loaded would keep reaching
// pages that read data with the service-role key. So every portal page calls
// this first. (Route handlers already do the same with requireRole.)
//
// React's cache() makes the layout and the page share ONE lookup per request.
// ============================================================

import { cache } from "react";
import { redirect } from "next/navigation";
import { getPortalSession, type PortalSession } from "./require-role";
import { isRoleAllowed, MEDIA_PORTAL_ROLES } from "./roles";

const lookup = cache(getPortalSession);

export async function requirePortalPage(
  options: { allowPasswordChangePending?: boolean } = {}
): Promise<PortalSession> {
  const result = await lookup();
  if (!result.ok || !isRoleAllowed(result.session.role, MEDIA_PORTAL_ROLES)) {
    redirect("/media/login");
  }
  // Still on the temporary password: the only page they may see is the change form.
  if (result.session.mustChangePassword && !options.allowPasswordChangePending) {
    redirect("/media/change-password");
  }
  return result.session;
}
