"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIcon, BarChartIcon, CalendarCheckIcon, CheckSquareIcon, DollarIcon, GlobeIcon, GridIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/useToast";
import type { DashboardPayload, RangeData, SortKey } from "@/lib/dashboard/types";
import { RANGE_KEYS, type RangeKey } from "@/lib/time";
import { fmt, money } from "@/lib/util";
import { Actions } from "./sections/Actions";
import { Channels, type Booking } from "./sections/Channels";
import { Live } from "./sections/Live";
import { Overview } from "./sections/Overview";
import { Reservations } from "./sections/Reservations";
import { Revenue } from "./sections/Revenue";
import { Website } from "./sections/Website";
import { TAB_LABEL, TABS, type Tab } from "./tabs";
import { useLive } from "./useLive";
import "./dashboard.css";

const ICON: Record<Tab, React.ReactNode> = {
  overview: <GridIcon />, revenue: <DollarIcon />, reservations: <CalendarCheckIcon />, channels: <BarChartIcon />,
  live: <ActivityIcon />, actions: <CheckSquareIcon />, website: <GlobeIcon />,
};
const RANGE_LABEL: Record<RangeKey, string> = { week: "This week", last: "Last week", month: "30 days" };

async function send(url: string, body: unknown, method = "POST"): Promise<boolean> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Like `send`, but hands back the server's field error so a form can show it. */
async function sendForm(url: string, body: unknown, method = "PATCH"): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const fields = data.fields as Record<string, string> | undefined;
    return (fields && Object.values(fields)[0]) || data.error || "That didn’t save — please try again";
  } catch {
    return "You appear to be offline. Check your connection and try again.";
  }
}

/** GET /api/metrics, /channels, /content and /reservations for one range, in parallel. */
async function loadRange(range: RangeKey): Promise<RangeData> {
  const get = async (path: string) => {
    const res = await fetch(`/api/${path}?range=${range}`);
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  };
  const [metrics, channels, content, reservations] = await Promise.all([get("metrics"), get("channels"), get("content"), get("reservations")]);
  return { metrics, channels: channels.channels, sortNotes: channels.sortNotes, content: content.content, reservations };
}

export function Dashboard({ initial, initialTab }: { initial: DashboardPayload; initialTab: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [range, setRange] = useState<RangeKey>("week");
  const [shown, setShown] = useState<RangeKey>("week");
  const [ranges, setRanges] = useState(initial.ranges);
  const [sort, setSort] = useState<SortKey>("door");
  // Decisions made in this session, layered over what the server sent.
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [noteSent, setNoteSent] = useState(!!initial.live.note?.sent);
  const [expert, setExpert] = useState(initial.actions.expertRequested);
  const [switching, setSwitching] = useState(false);
  const [booking, setBooking] = useState<Booking>({ provider: initial.venue.bookingProvider, url: initial.venue.bookingUrl });
  const loading = useRef(new Set<RangeKey>());
  const { show, node: toast } = useToast();
  const live = useLive(initial.live, initial.now, initial.sample);

  // Fetch the other ranges once the first paint is done, so switching is instant.
  const ensure = useCallback(
    (key: RangeKey) => {
      if (loading.current.has(key)) return;
      loading.current.add(key);
      loadRange(key)
        .then((data) => setRanges((r) => ({ ...r, [key]: data })))
        .catch(() => {
          loading.current.delete(key);
          show("Couldn’t load that range — check your connection");
        });
    },
    [show],
  );
  useEffect(() => {
    for (const k of RANGE_KEYS) if (!initial.ranges[k]) ensure(k);
  }, [ensure, initial.ranges]);

  const go = useCallback((t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "overview" ? "/app" : `/app?tab=${t}`);
    window.scrollTo(0, 0);
  }, []);
  const pickRange = (k: RangeKey) => {
    if (ranges[range]) setShown(range);
    setRange(k);
    if (!ranges[k]) ensure(k);
  };

  // Until a requested range arrives, keep showing the one on screen so bars animate between values.
  const data = (ranges[range] ?? ranges[shown]) as RangeData;

  const isApproved = (id: string, server: boolean) => approved[id] ?? server;
  const decide = async (id: string, url: string, ok: string) => {
    if (approved[id]) return;
    setApproved((s) => ({ ...s, [id]: true }));
    show(ok);
    if (!(await send(url, { id }))) {
      setApproved((s) => ({ ...s, [id]: false }));
      show("That didn’t save — please try again");
    }
  };
  const approveAction = (id: string) => decide(id, "/api/actions", "Approved — scheduled for this week");
  const approveRec = (id: string) => decide(id, "/api/website/recommendations", "Approved — the website agent is on it");
  const actionOn = (id: string) => isApproved(id, initial.actions.current.find((a) => a.id === id)?.approved ?? false);
  const recOn = (id: string) => isApproved(id, initial.website.recs.find((r) => r.id === id)?.approved ?? false);

  const open = initial.actions.current.filter((a) => !actionOn(a.id));
  const next = open[0] ?? null;

  const askAgent = () =>
    show(next ? `Agent: "Your best move today is ${next.tip || "the first open action"} — see Next actions."` : `Agent: "You’re all caught up — your next brief lands ${initial.nextBrief}."`);

  const sendNote = async () => {
    const note = initial.live.note;
    if (!note || noteSent) return;
    setNoteSent(true);
    show("Sent to 1,200 subscribers — results in Live within the hour");
    if (!(await send("/api/live/note", { id: note.id }))) {
      setNoteSent(false);
      show("That didn’t save — please try again");
    }
  };
  const bookExpert = async () => {
    if (expert) return;
    setExpert(true);
    show("Strategist session requested — invite on its way");
    if (!(await send("/api/expert", {}))) {
      setExpert(false);
      show("That didn’t save — please try again");
    }
  };
  const switchData = async (sampleData: boolean) => {
    if (switching) return;
    setSwitching(true);
    // The page re-keys the dashboard on the data mode, so a refresh remounts it with the new payload.
    if (await send("/api/venue", { sampleData }, "PATCH")) router.refresh();
    else {
      setSwitching(false);
      show("That didn’t save — please try again");
    }
  };
  const logout = async () => {
    await send("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  };

  // A destination changes what every channel row can prove, so the server recomputes the ranges.
  const refetchRanges = () => {
    for (const k of RANGE_KEYS) {
      loading.current.delete(k);
      ensure(k);
    }
  };
  const saveBooking = async (b: Booking) => {
    const problem = await sendForm("/api/venue", { bookingProvider: b.provider, bookingUrl: b.url });
    if (problem) return problem;
    setBooking(b);
    show(b.provider === "native" ? "Links now go to your Monitr booking page" : "Saved — your links now send people there");
    refetchRanges();
    return null;
  };
  const saveDestination = async (id: string, destination: string) => {
    const problem = await sendForm(`/api/channels/${id}`, { destination });
    if (problem) return problem;
    show(destination ? "Saved — this link has its own destination" : "This link now uses your booking page");
    refetchRanges();
    return null;
  };

  const m = data.metrics;
  const nav = (short: 0 | 1) =>
    TABS.map((t) => (
      <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
        {short ? null : ICON[t]}
        {TAB_LABEL[t][short]}
        {!short && t === "live" ? <span className="dot" /> : null}
        {!short && t === "actions" ? <span className="db-badge">{open.length}</span> : null}
      </button>
    ));

  return (
    <div className="frame db-frame">
      <aside className="db-side on-dark">
        <div className="db-side-logo"><Logo reverse /></div>
        <div className="db-who">{initial.venue.name}<br /><b>{initial.user.name}</b></div>
        <nav className="db-nav" aria-label="Sections">{nav(0)}</nav>
        <div className="db-side-card">
          <b>Weekly report</b><br />Next one lands {initial.nextBrief}.
          <button type="button" className="btn btn-light" onClick={() => go("actions")}>Read last week&apos;s</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); logout(); }}>
          <button type="submit" className="db-logout">Log out</button>
        </form>
      </aside>

      <main className="db-main">
        <div className="db-top">
          <div className="db-top-logo"><Logo size={28} /></div>
          <div className="db-liveline" role="status"><span className="dot" />Live · {fmt(live.door)} guests in tonight · {money(live.revCents)} so far</div>
          <div className="db-top-right">
            <div className="seg" role="group" aria-label="Date range">
              {RANGE_KEYS.map((k) => (
                <button key={k} type="button" aria-pressed={range === k} onClick={() => pickRange(k)}>{RANGE_LABEL[k]}</button>
              ))}
            </div>
            <button type="button" className="btn btn-sm" onClick={askAgent}>Ask the agent</button>
          </div>
        </div>
        <nav className="db-tabs" aria-label="Sections">
          {nav(1)}
          <button type="button" onClick={logout}>Log out</button>
        </nav>

        {!initial.user.isDemo && (
          <div className={`db-notice${initial.sample ? " is-checklist" : ""}`}>
            {initial.sample ? (
              <>
                <div>
                  <span><b>You&apos;re looking at a sample venue.</b> Your first week, in four steps:</span>
                  <ol className="db-checklist">
                    <li>Put your tracked link in your Instagram bio: <b>{initial.firstLink}</b></li>
                    <li>Tell us where guests book — Posh, Eventbrite, Resy, OpenTable or your site — under <button type="button" className="text-link" onClick={() => go("channels")}>Channels</button></li>
                    <li>Upload last month&apos;s orders, or <a href="/app/door">check in Friday&apos;s guests</a> at the door</li>
                    <li>Switch to your own numbers →</li>
                  </ol>
                </div>
                <button type="button" className="btn btn-xs" onClick={() => switchData(false)} disabled={switching}>Show my data</button>
              </>
            ) : (
              <>
                <span><b>These are your own numbers</b>, measured from {initial.firstLink} and your other links and codes.</span>
                <button type="button" className="btn btn-xs btn-secondary" onClick={() => switchData(true)} disabled={switching}>View the sample venue</button>
              </>
            )}
          </div>
        )}

        {tab === "overview" && <Overview m={m} next={next} openCount={open.length} nextBrief={initial.nextBrief} go={go} approve={approveAction} />}
        {tab === "revenue" && <Revenue m={m} channels={data.channels} content={data.content} />}
        {tab === "reservations" && <Reservations m={m} r={data.reservations} />}
        {tab === "channels" && (
          <Channels rangeLabel={m.rangeLabel} channels={data.channels} notes={data.sortNotes} sort={sort} onSort={setSort} booking={booking} editable={!initial.sample && !initial.user.isDemo} onBooking={saveBooking} onDestination={saveDestination} />
        )}
        {tab === "live" && <Live live={live} base={initial.live} tz={initial.venue.timezone} noteSent={noteSent} onSend={sendNote} />}
        {tab === "actions" && <Actions data={initial.actions} approved={actionOn} approve={approveAction} expert={expert} onExpert={bookExpert} nextBrief={initial.nextBrief} />}
        {tab === "website" && <Website data={initial.website} approved={recOn} approve={approveRec} />}
      </main>

      {toast}
    </div>
  );
}
