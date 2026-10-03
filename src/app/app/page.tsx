import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";
import { isTab } from "@/components/app/tabs";
import { requirePageUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const metadata: Metadata = { title: { absolute: "Monitr — growth command center" }, robots: { index: false, follow: false } };

/** The app. First paint carries this week's data; the other ranges load from the API right after. */
export default async function AppPage(props: PageProps<"/app">) {
  const user = await requirePageUser();
  const { tab } = await props.searchParams;
  const initial = await getDashboard(user, ["week"]);
  // Keyed on the data mode: switching between the sample venue and real data remounts with fresh state.
  return <Dashboard key={initial.sample ? "sample" : "real"} initial={initial} initialTab={isTab(tab) ? tab : "overview"} />;
}
