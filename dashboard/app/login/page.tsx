"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-white">Allowance</h1>
        <CardTitle className="mt-1 mb-6">
          Sign in with a magic link — no password.
        </CardTitle>

        {state.status === "sent" ? (
          <p className="text-sm text-green-400">{state.message}</p>
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
              {pending ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
