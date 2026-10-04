import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "Create your account — Profit Monitr" },
  description: "Three quick steps and your tracked links are ready — pointing at the booking page you already use. Free during the pilot; $39.99 a month after.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthScreen initialMode="signup" />;
}
