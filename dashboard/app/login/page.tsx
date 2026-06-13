"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wordmark } from "@/components/wordmark";
import { sendMagicLink, signInWithProvider, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

const oauthBtn =
  "neu-sm pressable flex w-full items-center justify-center gap-2.5 px-4 py-3 text-sm font-medium text-[var(--text)]";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm animate-in">
        <Link href="/"><Wordmark /></Link>
        <CardTitle className="mt-6 mb-6">Sign in</CardTitle>

        {/* OAuth */}
        <div className="space-y-2.5">
          <form action={signInWithProvider}>
            <input type="hidden" name="provider" value="github" />
            <button type="submit" className={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
              </svg>
              Continue with GitHub
            </button>
          </form>
          <form action={signInWithProvider}>
            <input type="hidden" name="provider" value="google" />
            <button type="submit" className={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3 text-xs text-[var(--text-faint)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          or
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        {/* Magic link */}
        {state.status === "sent" ? (
          <p className="text-sm text-accent">{state.message}</p>
        ) : (
          <form action={action} className="space-y-3">
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            {state.status === "error" && (
              <p className="text-sm text-red-400">{state.message}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Sending…" : "Email me a magic link"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
