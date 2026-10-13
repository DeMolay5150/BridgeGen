import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — BridgeGen",
  description: "Sign in to save client companies and run confidential Decision Rooms.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      {/* The form reads ?error= from the URL, which is only known at request time. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
