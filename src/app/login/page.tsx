import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "Log in — Profit Monitr" },
  description: "Log in to see what happened, why, and what to do next.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthScreen initialMode="login" />;
}
