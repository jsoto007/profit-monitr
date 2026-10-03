import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "Create your account — Profit Monitr" },
  description: "Three quick steps. We set up your reservations and ticketing as soon as you're in. $39.99 a month, everything included.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthScreen initialMode="signup" />;
}
