import type { WebsiteData } from "@/lib/dashboard/types";
import { Kpi } from "../parts";

type Props = { data: WebsiteData; approved: (id: string) => boolean; approve: (id: string) => void };

export function Website({ data, approved, approve }: Props) {
  const anyApproved = data.recs.some((r) => approved(r.id));
  return (
    <div className="db-screen gap-32">
      <section>
        <div className="kicker">YOUR WEBSITE, OPTIMIZED FOR FREE · {data.site}</div>
        <h1 className="db-h1">Three AI agents watch your site, search and bookings around the clock.</h1>
        <div className="db-kpis">
          {data.kpis.map((k) => (
            <Kpi key={k.label} mint={k.highlight} label={k.label} value={k.value} note={k.note} />
          ))}
        </div>
      </section>

      <section aria-labelledby="agents-h">
        <h2 id="agents-h" className="db-h2" style={{ marginBottom: 14 }}>Agents</h2>
        <div className="agents">
          {data.agents.map((a) => (
            <div key={a.name} className="agent">
              <div className="agent-head">
                <b>{a.name}</b>
                {/* An empty status is the website agent's review queue. */}
                <span className={`agent-status${a.tone === "lavender" ? " lavender" : ""}`}>{a.status || (anyApproved ? "Working" : `${data.recs.length} to review`)}</span>
              </div>
              <div className="agent-body">{a.body}</div>
              <div className="agent-foot">{a.foot}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="recs-h">
        <div className="db-head wrap">
          <h2 id="recs-h" className="db-h2">Recommendations waiting for you</h2>
          <span className="db-aside">Nothing changes on your site without your approval</span>
        </div>
        <div className="recs">
          {data.recs.length ? (
            data.recs.map((r) => {
              const on = approved(r.id);
              return (
                <div key={r.id} className={`rec${on ? " is-approved" : ""}`}>
                  <div>
                    <div className="rec-title">{r.title}</div>
                    <div className="rec-desc">{r.description}</div>
                  </div>
                  {on ? (
                    <span className="btn btn-xs btn-text">Approved · agent working</span>
                  ) : (
                    <button type="button" className="btn btn-xs" onClick={() => approve(r.id)}>Approve</button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="table"><div className="db-empty">Nothing is waiting for you. When an agent wants to change something on your site, it asks here first.</div></div>
          )}
        </div>
      </section>
    </div>
  );
}
