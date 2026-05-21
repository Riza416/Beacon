"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function siteOrigin() {
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
    // On success the browser is redirected to Google; no further state needed.
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Beacon</CardTitle>
        <CardDescription>
          Sign in with Google or a magic link to your work email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Check <span className="font-medium">{email}</span> for the sign-in
            link.
          </p>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signInWithGoogle}
              disabled={googleLoading || loading}
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

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
              <Button
                type="submit"
                className="w-full"
                disabled={loading || googleLoading}
              >
                {loading ? "Sending..." : "Send magic link"}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="shrink-0"
    >
      <path
        fill="#EA4335"
        d="M12 11v3.2h4.5c-.2 1.2-1.4 3.5-4.5 3.5-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2l2.2-2.1C16 5.5 14.2 4.6 12 4.6 7.8 4.6 4.4 8 4.4 12.2S7.8 19.8 12 19.8c6.9 0 7.8-6.4 7.1-9.5H12z"
      />
    </svg>
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
