"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BeaconLogo } from "@/components/logo";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const errorParam = search.get("error");
  const errorDescParam = search.get("error_description");
  const errorCodeParam = search.get("error_code");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Defensive: if Supabase's misconfigured Site URL ever sends a magic-link
  // code to /login instead of /auth/callback, forward it to the proper
  // callback so the session can still be established.
  useEffect(() => {
    const code = search.get("code");
    if (code) {
      const target = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
      window.location.replace(target);
    }
  }, [search, next]);

  // Surface auth errors (from the callback redirect or Supabase hash-style
  // errors) so we stop silently bouncing the user.
  useEffect(() => {
    const msg =
      errorDescParam ?? errorParam ?? errorCodeParam ?? null;
    if (msg) {
      toast.error(`Sign-in failed: ${decodeURIComponent(msg)}`);
    }
  }, [errorParam, errorDescParam, errorCodeParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <BeaconLogo size={28} />
        </CardTitle>
        <CardDescription>
          Sign in with a magic link to your work email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(errorParam || errorDescParam || errorCodeParam) && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {decodeURIComponent(
              errorDescParam ?? errorParam ?? errorCodeParam ?? ""
            )}
          </div>
        )}
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Check <span className="font-medium">{email}</span> for the sign-in
            link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
