export const TABS = ["overview", "revenue", "reservations", "channels", "live", "actions", "website"] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (v: unknown): v is Tab => (TABS as readonly string[]).includes(v as string);

/** Sidebar label / short label for the pill row under 980px. */
export const TAB_LABEL: Record<Tab, [string, string]> = {
  overview: ["Overview", "Overview"],
  revenue: ["Revenue", "Revenue"],
  reservations: ["Reservations & tickets", "Reservations"],
  channels: ["Channels & content", "Channels"],
  live: ["Live", "Live"],
  actions: ["Next actions", "Actions"],
  website: ["Website & SEO", "Website"],
};
