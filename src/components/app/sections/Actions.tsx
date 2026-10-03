import { CheckIcon } from "@/components/ui/icons";
import type { ActionsData } from "@/lib/dashboard/types";

type Props = { data: ActionsData; approved: (id: string) => boolean; approve: (id: string) => void; expert: boolean; onExpert: () => void; nextBrief: string };

export function Actions({ data, approved, approve, expert, onExpert, nextBrief }: Props) {
  return (
    <div className="db-screen gap-32">
      <section>
        <div className="kicker">WHAT SHOULD YOU DO NEXT · {data.weekLabel}</div>
        <h1 className="db-h1" style={{ maxWidth: "22ch" }}>{data.current.length ? "Three moves, ranked by what they're worth." : `Your first brief lands ${nextBrief}.`}</h1>
        <p className="act-intro">Built from your own bookings, tickets and sales. Approve one and Monitr schedules it, then shows you the result in next Monday&apos;s report.</p>
      </section>

      {data.current.length > 0 && (
        <section className="act-list" aria-label="This week's moves">
          {data.current.map((a, i) => {
            const on = approved(a.id);
            return (
              <div key={a.id} className={`act-row${on ? " is-approved" : ""}`}>
                <span className="act-n">{on ? "✓" : i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="act-title">{a.title}</div>
                  <div className="act-desc">{a.description}</div>
                  <div className="act-est">{on ? "Approved · scheduled · result in Monday’s report" : a.estimate}</div>
                </div>
                {on ? (
                  <span className="btn btn-sm btn-text">Approved</span>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => approve(a.id)}>Approve</button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="db-two">
        <div className="pod alt">
          <h2 className="db-h2">Last week&apos;s actions · results</h2>
          <div className="past">
            {data.past.length ? (
              data.past.map((p) => (
                <div key={p.id} className={`past-row${p.done ? "" : " is-skipped"}`}>
                  <span className={`past-check${p.done ? "" : " is-skipped"}`}>{p.done ? <CheckIcon size={12} stroke={3} /> : null}</span>
                  <span><b>{p.title}</b><span>{p.result}</span></span>
                </div>
              ))
            ) : (
              <div className="db-empty" style={{ paddingInline: 0 }}>Results show up here the Monday after you approve a move.</div>
            )}
          </div>
        </div>
        <div className="pod dark on-dark expert">
          <h2 className="db-h2">Want a second opinion?</h2>
          <p>Expert guidance is included. A strategist walks through this list with you in 30 minutes and helps you follow through.</p>
          <span className="btn-gap" />
          <button type="button" className="btn btn-sm btn-light" onClick={onExpert} aria-disabled={expert}>{expert ? "Requested · we’ll email you" : "Book a 30-minute session"}</button>
        </div>
      </section>
    </div>
  );
}
