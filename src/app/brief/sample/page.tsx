import type { Metadata } from "next";
import { SampleBrief } from "@/components/brief/SampleBrief";

export const metadata: Metadata = {
  title: "Sample Monday brief",
  description: "A complete Monday brief for a fictional sample venue: what happened, why, what made money, and the three moves worth making this week.",
  alternates: { canonical: "/brief/sample" },
};

export default function SampleBriefPage() {
  return <SampleBrief />;
}
