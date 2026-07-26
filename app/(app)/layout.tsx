import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { DEMO_COOKIE } from "@/lib/demo";
import { AppSidebar } from "@/components/app-sidebar";
import { BeaconLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  // New accounts sit behind global-admin approval. RLS already blanks the data
  // for unapproved accounts; this screen explains why instead of rendering an
  // app full of empty lists.
  if (!profile.approved_at && profile.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
          <BeaconLogo size={24} />
          <h1 className="text-xl font-semibold tracking-tight">
            Almost there — awaiting approval
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account (<span className="font-medium">{profile.email}</span>)
            was created, but a Beacon admin needs to approve it before you can
            see anything. They&apos;ve been notified — you&apos;ll be able to
            sign in normally once approved.
          </p>
          <form action="/auth/signout" method="post">
            <Button variant="outline" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    );
  }

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
