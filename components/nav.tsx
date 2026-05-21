import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Nav() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isAdmin = profile.role === "admin";

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            Beacon
          </Link>
          <nav className="hidden gap-4 text-sm sm:flex">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/requests/mine" className="text-muted-foreground hover:text-foreground">
              My requests
            </Link>
            <Link href="/requests/new" className="text-muted-foreground hover:text-foreground">
              New request
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/teams" className="text-muted-foreground hover:text-foreground">
                  Teams
                </Link>
                <Link href="/admin/requirements" className="text-muted-foreground hover:text-foreground">
                  Fields
                </Link>
                <Link href="/admin/statuses" className="text-muted-foreground hover:text-foreground">
                  Statuses
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.email ?? profile.full_name}
          </span>
          <Badge variant={isAdmin ? "default" : "secondary"}>{profile.role}</Badge>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
