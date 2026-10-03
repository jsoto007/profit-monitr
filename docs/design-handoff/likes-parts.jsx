// likes-parts.jsx — Monitr palette, motion helpers and the phone screens.
const K = { paper:'#ffffff', ink:'#111111', muted:'#6b6b6b', gray:'#f0f0f0', line:'rgba(17,17,17,0.12)', dark:'#141414',
  lavender:'#cdb9f6', mint:'#a9ecc9', pink:'#fbd4ec', yellow:'#fbe3a4', font:'Figtree, system-ui, sans-serif' };
const PASTELS = [K.pink, K.lavender, K.mint, K.yellow];
const lerp = (a, b, p) => a + (b - a) * p;
const MOTION = {
  enter: (T, s, d = 0.6) => Easing.easeOutCubic(clamp((T - s) / d, 0, 1)),
  pop:   (T, s, d = 0.5) => Easing.easeOutBack(clamp((T - s) / d, 0, 1)),
  draw:  (T, s, d = 0.8) => Easing.easeInOutCubic(clamp((T - s) / d, 0, 1)),
};
const PH = { w: 700, h: 1400, r: 70, pad: 14 };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const Icon = ({ size = 24, stroke = K.ink, fill = 'none', sw = 2, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>{children}</svg>
);
const IgIcon = (p) => <Icon {...p}><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></Icon>;
const TtIcon = (p) => <Icon {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></Icon>;
const HeartIcon = ({ size = 44, fill = K.pink, stroke = 'none', sw = 1.6 }) => <Icon size={size} fill={fill} stroke={stroke} sw={sw}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></Icon>;
const CheckIcon = ({ size = 26, stroke = K.mint }) => <Icon size={size} stroke={stroke} sw={2.6}><path d="M20 6 9 17l-5-5" /></Icon>;
const ImageIcon = (p) => <Icon {...p}><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></Icon>;
const PlayIcon = (p) => <Icon {...p}><polygon points="6 3 20 12 6 21 6 3" /></Icon>;
const Mark = ({ size = 64, color = K.ink, gold = '#b68235' }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block', flex: 'none' }}>
    <rect x="7" y="7" width="22" height="22" fill="none" stroke={color} strokeWidth="2.5" />
    <rect x="35" y="7" width="22" height="22" fill="none" stroke={color} strokeWidth="2.5" />
    <rect x="7" y="35" width="22" height="22" fill="none" stroke={color} strokeWidth="2.5" />
    <rect x="33.75" y="33.75" width="24.5" height="24.5" fill={gold} />
  </svg>
);
const Lockup = ({ size = 58, color = K.ink, gold = '#b68235', style }) => (
  <div style={Object.assign({ display: 'flex', alignItems: 'center', gap: size * 0.38 }, style)}>
    <Mark size={size * 1.24} color={color} gold={gold} />
    <span style={{ font: `600 ${size}px "Cormorant Garamond", Georgia, serif`, lineHeight: 1, letterSpacing: '-0.015em', color, whiteSpace: 'nowrap' }}>Profit Monitr</span>
  </div>
);
const Pill = ({ children, bg = K.gray, color = K.ink, size = 22, pad = '12px 22px', style }) => (
  <div style={Object.assign({ display: 'inline-flex', alignItems: 'center', gap: 10, background: bg, color, borderRadius: 999, padding: pad, font: `600 ${size}px ${K.font}`, lineHeight: 1, whiteSpace: 'nowrap' }, style)}>{children}</div>
);
const PlatformPill = ({ platform, bg = K.gray }) => (
  <Pill bg={bg} size={38} pad="18px 34px 18px 22px">{platform === 'Instagram' ? <IgIcon size={64} sw={2} /> : <TtIcon size={64} sw={2} />}{platform}</Pill>
);

function Phone({ x, y, s, opacity = 1, children }) {
  return (
    <div style={{ position: 'absolute', left: x - PH.w / 2, top: y - PH.h / 2, width: PH.w, height: PH.h, transform: `scale(${s})`, transformOrigin: 'center', opacity,
      background: K.ink, borderRadius: PH.r, padding: PH.pad, boxShadow: '0 24px 60px rgba(17,17,17,0.18)' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: K.paper, borderRadius: PH.r - PH.pad, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 34, marginLeft: -75, borderRadius: 17, background: K.ink, zIndex: 5 }} />
        {children}
      </div>
    </div>
  );
}

function TapRing({ T, at }) {
  const p = clamp((T - at + 0.05) / 0.5, 0, 1);
  if (p <= 0 || p >= 1) return null;
  const e = Easing.easeOutCubic(p);
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, marginLeft: -60, marginTop: -60, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${K.ink}`, transform: `scale(${lerp(0.35, 1.5, e)})`, opacity: 1 - e }} />
      <div style={{ position: 'absolute', left: 42, top: 42, width: 36, height: 36, borderRadius: '50%', background: K.ink, opacity: 0.35 * (1 - p) }} />
    </div>
  );
}

// A "compose" screen: platform pill, pastel media card, caption typing, black pill action, posted toast.
function ScreenPost({ T, platform, title, action, text, plateH, plateBg, typeAt, typeDur = 0.55, tapAt, postedAt, video, outAt }) {
  const typed = text.slice(0, Math.floor(text.length * MOTION.draw(T, typeAt, typeDur)));
  const caret = T < tapAt && Math.floor(T * 3) % 2 === 0;
  const pressed = T >= tapAt && T < tapAt + 0.18;
  const toast = MOTION.pop(T, postedAt, 0.4);
  const sheetIn = MOTION.enter(T, typeAt - 0.45, 0.7), sheetOut = outAt == null ? 0 : MOTION.draw(T, outAt - 0.25, 0.25);
  const stagger = (i) => { const p = MOTION.enter(T, typeAt - 0.35 + i * 0.07, 0.5); return { opacity: p * (1 - sheetOut), transform: `translateY(${(1 - p) * 36}px)` }; };
  const logoIn = MOTION.pop(T, typeAt - 0.45, 0.7);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '84px 40px 40px', display: 'flex', flexDirection: 'column', gap: 24, opacity: 1 - sheetOut, transform: `translateX(${-sheetOut * 80}px) scale(${1 - sheetOut * 0.04})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: clamp(logoIn, 0, 1), transform: `scale(${lerp(0.6, 1, logoIn)}) translateY(${(1 - clamp(logoIn, 0, 1)) * 24}px)`, transformOrigin: 'left center' }}>
        <PlatformPill platform={platform} bg={plateBg} />
        <div style={{ font: `600 20px ${K.font}`, color: K.muted, fontVariantNumeric: 'tabular-nums' }}>9:12</div>
      </div>
      <div style={Object.assign({ font: `800 54px ${K.font}`, lineHeight: 1, letterSpacing: '-0.03em', color: K.ink }, stagger(1))}>{title}</div>
      <div style={Object.assign({ position: 'relative', height: plateH, background: plateBg, borderRadius: 32, display: 'grid', placeItems: 'center' }, stagger(2))}>
        {video ? <PlayIcon size={72} fill={K.ink} stroke={K.ink} /> : <ImageIcon size={72} sw={1.6} />}
        {video && (
          <div style={{ position: 'absolute', left: 28, right: 28, bottom: 26, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(17,17,17,0.18)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${MOTION.draw(T, typeAt - 0.2, 1.6) * 100}%`, borderRadius: 3, background: K.ink }} />
            </div>
            <div style={{ font: `600 18px ${K.font}`, color: K.ink, fontVariantNumeric: 'tabular-nums' }}>0:15</div>
          </div>
        )}
      </div>
      <div style={Object.assign({ background: K.gray, borderRadius: 24, padding: '20px 24px', minHeight: 104, font: `500 24px ${K.font}`, lineHeight: 1.45, color: K.ink }, stagger(3))}>
        {typed}<span style={{ display: 'inline-block', width: 2, height: 26, background: K.ink, verticalAlign: '-4px', marginLeft: 2, opacity: caret ? 1 : 0 }} />
      </div>
      <div style={Object.assign({ display: 'flex', justifyContent: 'flex-end' }, stagger(4))}>
        <div style={{ position: 'relative', transform: `scale(${pressed ? 0.95 : 1})`, opacity: pressed ? 0.75 : 1 }}>
          <Pill bg={K.ink} color={K.paper} size={26} pad="18px 44px">{action}</Pill>
          <TapRing T={T} at={tapAt} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, bottom: 60, display: 'flex', justifyContent: 'center', opacity: clamp(toast, 0, 1), transform: `translateY(${(1 - toast) * 40}px)` }}>
        <Pill bg={K.ink} color={K.paper} size={26} pad="16px 28px"><CheckIcon />Posted</Pill>
      </div>
    </div>
  );
}

const ROWS = [['mia.k', 'liked your post', 0], ['theo_b', 'liked your video', 1], ['sana.r', 'liked your post', 0], ['jules', 'shared your video', 1], ['omar.d', 'liked your video', 1], ['lena', 'liked your post', 0], ['kit.o', 'liked your video', 1], ['rae', 'liked your post', 0], ['dani_m', 'liked your video', 1], ['noor', 'liked your post', 0], ['ivo', 'liked your video', 1], ['pia.s', 'liked your post', 0], ['max_t', 'liked your video', 1], ['ana', 'liked your post', 0]];
const rowAt = (i, start) => start + 2.6 * Math.pow(i / ROWS.length, 0.75);

function ScreenActivity({ T, start, likes }) {
  const ROW_H = 92;
  const hdr = MOTION.enter(T, start, 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '84px 40px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: hdr, transform: `translateY(${(1 - hdr) * 20}px)` }}>
        <div style={{ font: `800 54px ${K.font}`, lineHeight: 1, letterSpacing: '-0.03em', color: K.ink }}>Activity</div>
        <div style={{ display: 'flex', gap: 10 }}><Pill bg={K.pink} pad="12px 16px"><IgIcon size={40} sw={2.2} /></Pill><Pill bg={K.lavender} pad="12px 16px"><TtIcon size={40} sw={2.2} /></Pill></div>
      </div>
      <div style={{ background: K.pink, borderRadius: 32, padding: '30px 32px 28px', opacity: hdr }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ font: `700 28px ${K.font}`, color: K.ink }}>Likes</div>
          <Pill bg={K.ink} color={K.paper} size={20} pad="10px 18px"><HeartIcon size={20} fill={K.pink} />this week</Pill>
        </div>
        <div style={{ font: `800 140px ${K.font}`, lineHeight: 1, color: K.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', marginTop: 14 }}>{fmt(likes)}</div>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {ROWS.map((r, i) => {
          const a = rowAt(i, start + 0.2);
          const inP = MOTION.enter(T, a, 0.35);
          if (inP <= 0) return null;
          let shift = 0;
          for (let j = i + 1; j < ROWS.length; j++) shift += MOTION.enter(T, rowAt(j, start + 0.2), 0.35);
          return (
            <div key={r[0]} style={{ position: 'absolute', left: 0, right: 0, top: 26 + shift * ROW_H, height: ROW_H, display: 'flex', alignItems: 'center', gap: 18, borderBottom: `1px solid ${K.line}`, opacity: inP, transform: `translateY(${(1 - inP) * -24}px)` }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: PASTELS[i % 4], display: 'grid', placeItems: 'center', font: `700 20px ${K.font}`, color: K.ink }}>{r[0].slice(0, 2).toUpperCase()}</div>
              <div style={{ font: `500 23px ${K.font}`, color: K.ink, flex: 1 }}><span style={{ fontWeight: 700 }}>{r[0]}</span> {r[1]}</div>
              {r[2] ? <TtIcon size={34} stroke={K.ink} /> : <IgIcon size={34} stroke={K.ink} />}
              <HeartIcon size={30} fill={K.pink} stroke={K.ink} sw={1.4} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hearts({ T, start, count = 52, w = 672, h = 1372 }) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const t0 = start + k * 0.115, life = 1.7, p = (T - t0) / life;
    if (p <= 0 || p >= 1) continue;
    const seed = ((k * 7919) % 97) / 97;
    const x = w - 130 - seed * 230 + Math.sin(p * 6 + k) * 42;
    const y = h - 170 - Easing.easeOutSine(p) * h * 0.72;
    const o = p < 0.1 ? p / 0.1 : p > 0.65 ? (1 - p) / 0.35 : 1;
    const sz = 40 + (k % 3) * 18;
    out.push(<div key={k} style={{ position: 'absolute', left: x, top: y, opacity: o, transform: `rotate(${(seed - 0.5) * 30}deg) scale(${lerp(0.5, 1, MOTION.pop(T, t0, 0.3))})` }}>
      <HeartIcon size={sz} fill={PASTELS[k % 4]} stroke={k % 3 === 0 ? K.ink : 'none'} sw={1.2} /></div>);
  }
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>{out}</div>;
}

Object.assign(window, { K, PASTELS, lerp, MOTION, PH, fmt, Icon, IgIcon, TtIcon, HeartIcon, CheckIcon, Mark, Lockup, Pill, PlatformPill, Phone, TapRing, ScreenPost, ScreenActivity, Hearts });
