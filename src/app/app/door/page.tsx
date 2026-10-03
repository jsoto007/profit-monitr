import type { Metadata } from "next";
import { Door } from "@/components/app/Door";
import { requirePageUser } from "@/lib/auth";
import "@/components/app/dashboard.css";

export const metadata: Metadata = { title: "Door check-in", robots: { index: false, follow: false } };

export default async function DoorPage() {
  const user = await requirePageUser();
  return <Door venue={user.venue.name} tz={user.venue.timezone} />;
}
