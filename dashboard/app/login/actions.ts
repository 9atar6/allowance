"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

/** Start an OAuth sign-in (GitHub / Google). Redirects to the provider. */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = formData.get("provider");
  if (provider !== "github" && provider !== "google") {
    redirect("/login?error=oauth");
  }

  const supabase = await createClient();
  const origin = appOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/confirm` },
  });

  if (error || !data?.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url); // off to GitHub/Google; they return to /auth/confirm?code=...
}

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
}

/** Send a magic link to the supplied email. */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const origin = appOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    // Generic message — never leak whether the email exists.
    return { status: "error", message: "Could not send link. Try again." };
  }
  return { status: "sent", message: "Check your inbox for the sign-in link." };
}
