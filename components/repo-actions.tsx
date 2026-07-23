import { ExternalLink, GitBranch, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

// Smart links for a workstream's repo — no API integration. "Request access"
// opens the repo (private repos show a request-access prompt); "Branch off"
// opens the host's branches page. GitHub / GitLab paths are auto-detected from
// the URL; anything else falls back to the repo URL for both.
function repoLinks(rawUrl: string): {
  host: string | null;
  accessUrl: string;
  branchUrl: string;
} {
  try {
    const u = new URL(rawUrl);
    // Normalize: drop a trailing slash and a ".git" clone suffix so the
    // derived pages resolve (e.g. github.com/org/repo.git/branches → 404).
    const path = u.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
    if (u.hostname.includes("github")) {
      // Reduce to owner/repo so extra path (/tree/main, …) doesn't break it.
      const segs = path.split("/").filter(Boolean).slice(0, 2);
      const repo = `${u.origin}/${segs.join("/")}`;
      return { host: "GitHub", accessUrl: repo, branchUrl: `${repo}/branches` };
    }
    if (u.hostname.includes("gitlab")) {
      // GitLab groups can nest, so keep the full (de-suffixed) path.
      const repo = `${u.origin}${path}`;
      return { host: "GitLab", accessUrl: repo, branchUrl: `${repo}/-/branches` };
    }
    const repo = `${u.origin}${path}`;
    return { host: null, accessUrl: repo, branchUrl: repo };
  } catch {
    // Not a parseable URL — fall through to the raw value.
    return { host: null, accessUrl: rawUrl, branchUrl: rawUrl };
  }
}

/**
 * Displays a repository with "Request access" and "Branch off" actions.
 * `preview` renders the buttons as disabled (for the template editor's mock).
 */
export function RepoActions({
  url,
  preview = false,
}: {
  url: string;
  preview?: boolean;
}) {
  const { host, accessUrl, branchUrl } = repoLinks(url);
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <a
        href={accessUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 break-all text-sm font-medium hover:underline"
      >
        {url}
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      <div className="flex flex-wrap gap-2">
        {preview ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled>
              <KeyRound className="mr-1 h-4 w-4" />
              Request access
            </Button>
            <Button type="button" size="sm" variant="outline" disabled>
              <GitBranch className="mr-1 h-4 w-4" />
              Branch off
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="sm" variant="outline">
              <a href={accessUrl} target="_blank" rel="noopener noreferrer">
                <KeyRound className="mr-1 h-4 w-4" />
                Request access
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={branchUrl} target="_blank" rel="noopener noreferrer">
                <GitBranch className="mr-1 h-4 w-4" />
                Branch off
              </a>
            </Button>
          </>
        )}
      </div>
      {host && (
        <p className="text-xs text-muted-foreground">
          {host} detected — access request and branch pages open on {host}.
        </p>
      )}
    </div>
  );
}
