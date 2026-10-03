/**
 * Hero film — the composition: dashboard, reckoning, close and camera.
 * Ported 1:1 from docs/design-handoff/likes-piece.jsx. `T` is authored time.
 */
import type { CSSProperties, ReactNode } from "react";
import { fmt, ft, HeartIcon, Hearts, K, Lockup, Phone, Pill, ScreenActivity, ScreenPost } from "./parts";
import { clamp, Easing, FILM, interpolate, lerp, MOTION } from "./timeline";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const QUESTION = "Track what actually drives sales and reservations.";
const CAPTION_FADE = 0.18;

type CardProps = { bg: string; top: number; left?: number; width?: number; radius?: number; pad?: number; style?: CSSProperties; children?: ReactNode };
function Card({ bg, top, left = 90, width = 900, radius = 44, pad = 48, style, children }: CardProps) {
  return <div style={{ position: "absolute", left, width, top, background: bg, borderRadius: radius, padding: pad, boxSizing: "border-box", ...style }}>{children}</div>;
}
const CardHead = ({ title, pill, size = 40 }: { title: string; pill: ReactNode; size?: number }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ ...ft(700, size), color: K.ink, letterSpacing: "-0.02em" }}>{title}</div>
    {pill}
  </div>
);
const Big = ({ children, size, style }: { children: ReactNode; size: number; style?: CSSProperties }) => (
  <div style={{ ...ft(800, size), lineHeight: 0.95, color: K.ink, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums", ...style }}>{children}</div>
);

/** Shows its children only while from ≤ T < to. */
function Shot({ T, from, to = Infinity, children }: { T: number; from: number; to?: number; children: ReactNode }) {
  return <div style={{ position: "absolute", inset: 0, visibility: T >= from && T < to ? "visible" : "hidden" }}>{children}</div>;
}

function Dashboard({ T, at, out, likes }: { T: number; at: number; out: number; likes: number }) {
  const outP = MOTION.enter(T, out, 0.4);
  const slide = (s: number) => lerp(lerp(1920, 0, MOTION.enter(T, s, 0.8)), -1900, outP);
  const pillIn = MOTION.pop(T, at + 0.75, 0.45);
  const zero = MOTION.pop(T, at + 0.9, 0.5);
  const res = MOTION.pop(T, at + 1.5, 0.5);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Card bg={K.lavender} top={610} style={{ transform: `translateY(${slide(at + 0.05)}px)`, height: 630 }}>
        <CardHead title="Revenue" pill={<Pill bg={K.ink} color={K.paper} size={24} pad="14px 22px" style={{ opacity: clamp(pillIn, 0, 1), transform: `scale(${lerp(0.6, 1, pillIn)})` }}>+ $0</Pill>} />
        <Big size={250} style={{ marginTop: 28, opacity: clamp(zero, 0, 1), transform: `scale(${lerp(1.5, 1, zero)})`, transformOrigin: "left center" }}>$0</Big>
        <div style={{ ...ft(500, 27), color: K.ink, opacity: 0.72 * clamp(zero, 0, 1), marginTop: 14 }}>from {fmt(likes)} likes this week · 0× return</div>
        <div style={{ position: "absolute", left: 48, right: 48, bottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {DAYS.map((d, i) => {
            const p = MOTION.pop(T, at + 1.0 + i * 0.09, 0.4);
            return (
              <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 72, opacity: clamp(p, 0, 1) }}>
                <div style={{ width: 56, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.75)", transform: `scaleY(${p})`, transformOrigin: "bottom" }} />
                <div style={{ ...ft(i === 5 ? 700 : 500, 20), color: K.ink, opacity: i === 5 ? 1 : 0.6 }}>{d}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card bg={K.mint} top={1264} style={{ transform: `translateY(${slide(at + 0.3)}px)`, height: 300 }}>
        <CardHead title="Reservations" pill={<div style={{ ...ft(600, 24), color: K.ink, opacity: 0.7 }}>+0%</div>} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 20 }}>
          <Big size={150} style={{ opacity: clamp(res, 0, 1), transform: `scale(${lerp(1.5, 1, res)})`, transformOrigin: "left center" }}>0</Big>
          <div style={{ ...ft(500, 27), color: K.ink, opacity: 0.72 * clamp(res, 0, 1) }}>+ 0 tickets · 0 guests at the door</div>
        </div>
      </Card>
    </div>
  );
}

function Reckoning({ T, at, likes }: { T: number; at: number; likes: number }) {
  const a = MOTION.enter(T, at + 0.3, 0.6);
  const c = MOTION.pop(T, at + 0.75, 0.6);
  const z = MOTION.pop(T, at + 1.0, 0.55);
  return (
    <Shot T={T} from={at + 0.25}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 36, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
        <Pill bg={K.pink} size={30} pad="18px 30px"><HeartIcon size={30} fill={K.ink} />Likes this week</Pill>
        <Big size={320}>{fmt(likes)}</Big>
      </div>
      <Card bg={K.lavender} top={960} radius={56} pad={60} style={{ height: 660, opacity: clamp(c, 0, 1), transform: `scale(${lerp(0.85, 1, c)})` }}>
        <CardHead title="Revenue" pill={<Pill bg={K.ink} color={K.paper} size={26} pad="16px 26px">0× return</Pill>} size={46} />
        <Big size={380} style={{ marginTop: 40, opacity: clamp(z, 0, 1), transform: `scale(${lerp(1.6, 1, z)})`, transformOrigin: "left center" }}>$0</Big>
        <div style={{ ...ft(500, 32), color: K.ink, opacity: 0.72 * clamp(z, 0, 1), marginTop: 28 }}>0 reservations · 0 tickets · 0 guests</div>
      </Card>
    </Shot>
  );
}

function Close({ T, at }: { T: number; at: number }) {
  const wipe = MOTION.draw(T, at - 0.05, 0.6);
  const b = MOTION.enter(T, at + 0.45, 0.6);
  const h = MOTION.enter(T, at + 0.7, 0.7);
  const q = MOTION.enter(T, at + 1.1, 0.7);
  const tag = MOTION.pop(T, at + 1.5, 0.6);
  const grow = MOTION.draw(T, at + 0.4, 1.6);
  const gl = MOTION.enter(T, at + 0.3, 0.6);
  const line = "M -40 1540 C 180 1520, 300 1480, 420 1400 S 620 1240, 740 1120 S 960 860, 1120 720";
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 70% at 50% 45%, var(--film-close-from) 0%, var(--film-close-to) 100%)", clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`, overflow: "hidden" }}>
      <svg viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: gl }}>
        <defs>
          <linearGradient id="pmCloseArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopOpacity="0.14" style={{ stopColor: K.mint }} />
            <stop offset="1" stopOpacity="0" style={{ stopColor: K.mint }} />
          </linearGradient>
          <clipPath id="pmCloseReveal">
            <rect x="-40" y="0" width={grow * 1180} height="1920" />
          </clipPath>
        </defs>
        {[1000, 1180, 1360, 1540].map((y) => (
          <line key={y} x1="0" x2="1080" y1={y} y2={y} strokeOpacity="0.06" strokeWidth="1.5" style={{ stroke: K.mint }} />
        ))}
        <path d={`${line} L 1120 1920 L -40 1920 Z`} fill="url(#pmCloseArea)" clipPath="url(#pmCloseReveal)" />
        <path d={line} fill="none" strokeOpacity="0.32" strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - grow} style={{ stroke: K.mint }} />
      </svg>
      <div style={{ position: "absolute", left: 90, right: 90, top: 520, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Lockup size={72} color={K.paper} gold="var(--brand-gold-reverse)" style={{ opacity: b, transform: `translateY(${(1 - b) * 30}px)` }} />
        <div style={{ ...ft(800, 124), lineHeight: 1, letterSpacing: "-0.04em", color: K.paper, marginTop: 110, opacity: h, transform: `translateY(${(1 - h) * 40}px)`, textWrap: "balance" }}>
          Likes don&apos;t measure sales.
          <br />
          <span style={{ color: K.mint }}>We do.</span>
        </div>
        <div style={{ ...ft(500, 46), lineHeight: 1.3, color: "var(--film-question)", marginTop: 44, opacity: q, transform: `translateY(${(1 - q) * 30}px)` }}>{QUESTION}</div>
        <Pill bg={K.mint} size={34} pad="26px 48px" style={{ marginTop: 110, opacity: clamp(tag, 0, 1), transform: `scale(${lerp(0.7, 1, tag)})` }}>
          Track what drives sales <span style={{ marginLeft: 14 }}>→</span>
        </Pill>
      </div>
    </div>
  );
}

function camera(T: number, C: Record<string, number>) {
  const L = C.Likes, G = C.Ledger, R = C.Reckoning, X = C.Close;
  if (T < L) return { s: lerp(1.22, 1, MOTION.draw(T, 0, L)), ox: 540, oy: 820 };
  if (T < G) return { s: lerp(1, 1.1, MOTION.draw(T, L, G - L)), ox: 540, oy: 760 };
  if (T < R) return { s: lerp(1, 1.03, MOTION.draw(T, G + 0.8, R - G - 0.8)), ox: 540, oy: 960 };
  if (T < X) return { s: 1, ox: 540, oy: 960 };
  return { s: lerp(1, 1.03, MOTION.draw(T, X, 2.5)), ox: 540, oy: 960 };
}

type Caption = { at: number; until?: number; text: string };

function Captions({ T, items }: { T: number; items: Caption[] }) {
  let active: Caption | null = null;
  let end = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (T < items[i].at) break;
    active = items[i];
    end = active.until ?? (i + 1 < items.length ? items[i + 1].at : Infinity);
  }
  if (!active || T >= end) return null;
  let o = Math.min(1, (T - active.at) / CAPTION_FADE);
  if (isFinite(end)) o = Math.min(o, (end - T) / CAPTION_FADE);
  return (
    <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "5.5%", textAlign: "center", opacity: clamp(o, 0, 1), pointerEvents: "none", ...ft(600, 40), lineHeight: 1.3, color: K.ink }}>{active.text}</div>
  );
}

/** One frame of the film at authored time `T`, drawn in a 1080 × 1920 box. */
export function Piece({ T }: { T: number }) {
  const C = FILM.cues;
  const P = C.Post, L = C.Likes, G = C.Ledger, R = C.Reckoning, X = C.Close;
  const likes = interpolate([L + 0.1, G - 0.2, R + 0.6], [0, 6200, 8452], [Easing.easeInQuad, Easing.easeOutSine])(T);
  const cam = camera(T, C);
  const mv = MOTION.draw(T, G - 0.2, 0.7);
  const gone = MOTION.enter(T, R - 0.05, 0.5);
  const phone = { x: lerp(540, 830, mv), y: lerp(lerp(880, 320, mv), -500, gone), s: lerp(1, 0.36, mv) };
  const caps: Caption[] = [
    { at: P + 0.4, text: "You post. Every. Single. Day." },
    { at: L + 0.2, text: "And the likes pour in." },
    { at: L + 2.0, text: "Hundreds. Then thousands." },
    { at: G + 0.7, text: "Then you open the numbers." },
    { at: G + 2.2, text: "Zero revenue. Not one booking." },
    { at: R + 0.3, until: X - 0.1, text: "Thousands of likes. Zero sales." },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: K.paper, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: `translate(${cam.ox}px,${cam.oy}px) scale(${cam.s}) translate(${-cam.ox}px,${-cam.oy}px)` }}>
        <Dashboard T={T} at={G + 0.05} out={R - 0.3} likes={likes} />
        <Phone x={phone.x} y={phone.y} s={phone.s}>
          <Shot T={T} from={P} to={P + 1.6}>
            <ScreenPost T={T} platform="Instagram" title="New post" action="Share" plateH={640} plateBg={K.pink} text="Doors open at 7. First coffee's on us." typeAt={P + 0.5} typeDur={0.55} tapAt={P + 1.1} postedAt={P + 1.17} outAt={P + 1.6} />
          </Shot>
          <Shot T={T} from={P + 1.6} to={L}>
            <ScreenPost T={T} platform="TikTok" title="New video" action="Post" plateH={700} plateBg={K.lavender} video text="Behind the counter, 6 a.m." typeAt={P + 2.05} typeDur={0.45} tapAt={L - 0.44} postedAt={L - 0.37} outAt={L} />
          </Shot>
          <Shot T={T} from={L}>
            <ScreenActivity T={T} start={L} likes={likes} />
            <Hearts T={T} start={L + 0.3} />
          </Shot>
        </Phone>
        <Reckoning T={T} at={R} likes={likes} />
      </div>
      <Captions T={T} items={caps} />
      <Close T={T} at={X} />
    </div>
  );
}
