"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

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
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
