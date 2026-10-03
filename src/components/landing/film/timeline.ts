/**
 * The hero film's clock. Ported from the handoff's timeline engine
 * (docs/design-handoff/animations-v3.jsx): scenes are authored at a "natural"
 * length and played back stretched or squeezed, so playback time is warped
 * into authored time `T` before any choreography reads it.
 */

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Keyframe interpolation with an easing per segment. */
export function interpolate(input: number[], output: number[], ease: ((t: number) => number) | ((t: number) => number)[] = Easing.linear) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const fn = Array.isArray(ease) ? ease[i] || Easing.linear : ease;
        return output[i] + (output[i + 1] - output[i]) * fn(local);
      }
    }
    return output[output.length - 1];
  };
}

export const MOTION = {
  enter: (T: number, s: number, d = 0.6) => Easing.easeOutCubic(clamp((T - s) / d, 0, 1)),
  pop: (T: number, s: number, d = 0.5) => Easing.easeOutBack(clamp((T - s) / d, 0, 1)),
  draw: (T: number, s: number, d = 0.8) => Easing.easeInOutCubic(clamp((T - s) / d, 0, 1)),
};

export type Scene = { name: string; dur: number; nat?: number };

/** Five scenes, 21.25 s of playback over 15 s of authored motion. */
export const SCENES: Scene[] = [
  { name: "Post", dur: 6, nat: 3 },
  { name: "Likes", dur: 1.75, nat: 3.5 },
  { name: "Ledger", dur: 3.5 },
  { name: "Reckoning", dur: 5, nat: 2.5 },
  { name: "Close", dur: 5, nat: 2.5 },
];

export type Derived = {
  sections: { name: string; playStart: number; dur: number; authStart: number; nat: number }[];
  cues: Record<string, number>;
  total: number;
  authoredTotal: number;
};

export function derive(scenes: Scene[]): Derived {
  let playStart = 0;
  let authStart = 0;
  const sections: Derived["sections"] = [];
  const cues: Record<string, number> = {};
  for (const s of scenes) {
    const nat = s.nat && s.nat > 0 ? s.nat : s.dur;
    sections.push({ name: s.name, playStart, dur: s.dur, authStart, nat });
    if (!(s.name in cues)) cues[s.name] = Math.round(authStart * 1000) / 1000;
    playStart += s.dur;
    authStart += nat;
  }
  return { sections, cues, total: Math.round(playStart * 1000) / 1000, authoredTotal: Math.round(authStart * 1000) / 1000 };
}

/** Playback seconds → authored seconds. */
export function warp(d: Derived, t: number): number {
  const ss = d.sections;
  if (!ss.length) return 0;
  let idx = ss.length - 1;
  for (let i = 0; i < ss.length; i++) {
    if (t < ss[i].playStart + ss[i].dur) {
      idx = i;
      break;
    }
  }
  const s = ss[idx];
  const local = Math.min(Math.max(t - s.playStart, 0), s.dur);
  return Math.min(s.authStart + (s.dur > 0 ? local * (s.nat / s.dur) : 0), d.authoredTotal);
}

export const FILM = derive(SCENES);
