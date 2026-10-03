"use client";

import { useEffect, useRef, useState } from "react";
import { Piece } from "./film/Piece";
import { FILM, warp } from "./film/timeline";

const W = 1080;
const H = 1920;
/** Authored time of the frame shown when motion is reduced: "Thousands of likes. Zero sales." */
const POSTER_T = FILM.cues.Close - 0.2;

/**
 * "Likes Not Sales" — the 21-second loop inside the hero phone. Muted, no
 * controls. The clock only runs while the film is on screen and the tab is
 * visible; with prefers-reduced-motion it holds a single still frame.
 */
export function HeroFilm() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [T, setT] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.05, Math.min(el.clientWidth / W, el.clientHeight / H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last: number | null = null;
    let time = 0;
    let onScreen = true;

    const step = (ts: number) => {
      if (last != null) time = (time + (ts - last) / 1000) % FILM.total;
      last = ts;
      setT(warp(FILM, time));
      raf = requestAnimationFrame(step);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      last = null;
      if (still.matches) return setT(POSTER_T);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    still.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      still.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div ref={box} className="ld-film" role="img" aria-label="Animation: a venue owner posts every day and the likes pour in — thousands of likes, zero revenue, zero bookings. Likes don't measure sales. Profit Monitr does.">
      <div aria-hidden="true" style={{ width: W * scale, height: H * scale, visibility: scale ? "visible" : "hidden", position: "relative", flex: "none" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <Piece T={T} />
        </div>
      </div>
    </div>
  );
}
