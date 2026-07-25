import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { DEMO_COOKIE } from "@/lib/demo";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  const isAdmin = profile.role === "admin";
  const isTeamAdmin = profile.role === "team_admin";
  // Regular members granted any product permission get a Workstreams link.
  const canManageTeamProducts =
    profile.team_id !== null &&
    (isTeamAdmin ||
      profile.can_create_products ||
      profile.can_edit_products ||
      profile.can_delete_products);

  const cookieStore = await cookies();
  const demoOn = isAdmin && cookieStore.get(DEMO_COOKIE)?.value === "1";
  const initialCollapsed =
    cookieStore.get("beacon_sidebar")?.value === "collapsed";

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        isAdmin={isAdmin}
        isTeamAdmin={isTeamAdmin}
        canManageTeamProducts={canManageTeamProducts}
        email={profile.email ?? profile.full_name ?? null}
        role={profile.role}
        demoOn={demoOn}
        initialCollapsed={initialCollapsed}
      />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
