import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — BridgeGen",
  description: "Sign in to save client companies and run confidential Decision Rooms.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <LoginForm />
    </main>
  );
}
