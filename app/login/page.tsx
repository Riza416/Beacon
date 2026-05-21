"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signUpAndConfirm } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BeaconLogo } from "@/components/logo";

type Mode = "signin-password" | "signin-magic" | "signup";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const errorParam = search.get("error");
  const errorDescParam = search.get("error_description");
  const errorCodeParam = search.get("error_code");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin-password");
  const [magicSent, setMagicSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Defensive: if Supabase ever sends a magic-link code to /login instead
  // of /auth/callback, forward it so the session can still be established.
  useEffect(() => {
    const code = search.get("code");
    if (code) {
      const target = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
      window.location.replace(target);
    }
  }, [search, next]);

  useEffect(() => {
    const msg = errorDescParam ?? errorParam ?? errorCodeParam ?? null;
    if (msg) {
      toast.error(`Sign-in failed: ${decodeURIComponent(msg)}`);
    }
  }, [errorParam, errorDescParam, errorCodeParam]);

  async function onMagicLink(e: React.FormEvent) {
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
    setMagicSent(true);
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.replace(next);
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);

    // Server-side: create the user pre-confirmed (skips the verification email).
    const result = await signUpAndConfirm(email, password);
    if (!result.ok) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    // Now sign in immediately so the session cookies land in this browser.
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInErr) {
      toast.error(
        `Account created, but sign-in failed: ${signInErr.message}. Try signing in manually.`
      );
      return;
    }
    toast.success("Account created — you're in.");
    window.location.replace(next);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <BeaconLogo size={28} />
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "Create an account to start tracking requests."
            : "Sign in to Beacon."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(errorParam || errorDescParam || errorCodeParam) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {decodeURIComponent(
              errorDescParam ?? errorParam ?? errorCodeParam ?? ""
            )}
          </div>
        )}

        {/* Sign-in / Sign-up switcher — only shows in sign-in modes */}
        {mode !== "signup" && (
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("signin-password")}
              className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                mode === "signin-password"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email + password
            </button>
            <button
              type="button"
              onClick={() => setMode("signin-magic")}
              className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                mode === "signin-magic"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic link
            </button>
          </div>
        )}

        {mode === "signin-magic" ? (
          magicSent ? (
            <p className="text-sm text-muted-foreground">
              Check <span className="font-medium">{email}</span> for the sign-in link.
            </p>
          ) : (
            <form onSubmit={onMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-magic">Email</Label>
                <Input
                  id="email-magic"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send magic link"}
              </Button>
            </form>
          )
        ) : mode === "signin-password" ? (
          <form onSubmit={onPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-pw">Email</Label>
              <Input
                id="email-pw"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-su">Email</Label>
              <Input
                id="email-su"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-su">Password</Label>
              <Input
                id="password-su"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>
        )}

        {/* Footer toggle: sign-in <-> sign-up */}
        <div className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin-password")}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMagicSent(false);
                }}
                className="font-medium text-primary hover:underline"
              >
                Sign up
              </button>
            </>
          )}
        </div>
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
