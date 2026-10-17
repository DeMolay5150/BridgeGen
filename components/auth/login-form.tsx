"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getBrowserClient } from "@/lib/supabase/client";

type Mode = "signIn" | "signUp";

const MIN_PASSWORD = 8;

export function LoginForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  // Where to go after signing in, e.g. back to a firm invitation.
  const next = safeNext(searchParams.get("next"));
  // Set by /auth/confirm when an email link is expired or already used.
  const linkFailed = searchParams.get("error") === "confirmation";
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(
    linkFailed
      ? {
          tone: "error",
          text: "That confirmation link has expired or was already used. If you've confirmed before, sign in; otherwise create the account again to get a fresh link.",
        }
      : null,
  );

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounts aren&apos;t set up yet</CardTitle>
          <CardDescription>
            This deployment runs as the public demo. Add the Supabase keys to .env.local to enable
            sign-in and saved companies.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const supabase = getBrowserClient();
    if (!supabase) return;
    if (mode === "signUp" && password.length < MIN_PASSWORD) {
      setMessage({ tone: "error", text: `Use at least ${MIN_PASSWORD} characters for your password.` });
      return;
    }
    setBusy(true);
    const result =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
          });
    setBusy(false);

    if (result.error) {
      setMessage({ tone: "error", text: result.error.message });
    } else if (result.data.session) {
      router.push(next);
      router.refresh();
    } else {
      setMessage({ tone: "info", text: "Check your email to confirm your account, then sign in." });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signIn" ? "Sign in" : "Create your advisor account"}</CardTitle>
        <CardDescription>Save client companies and run confidential Decision Rooms.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Create account</TabsTrigger>
          </TabsList>
        </Tabs>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={passwordId}>Password</Label>
            <Input
              id={passwordId}
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {message && (
            <p role="status" className={message.tone === "error" ? "text-sm text-critical" : "text-sm text-positive"}>
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signIn" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
