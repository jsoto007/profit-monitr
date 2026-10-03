// likes-piece.jsx — the composition: dashboard, reckoning, close, camera, page shell.
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function Card({ bg, top, left = 90, width = 900, radius = 44, pad = 48, style, children }) {
  return <div style={Object.assign({ position: 'absolute', left, width, top, background: bg, borderRadius: radius, padding: pad, boxSizing: 'border-box' }, style)}>{children}</div>;
}
const CardHead = ({ title, pill, size = 40 }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ font: `700 ${size}px ${K.font}`, color: K.ink, letterSpacing: '-0.02em' }}>{title}</div>{pill}
  </div>
);
const Big = ({ children, size, style }) => (
  <div style={Object.assign({ font: `800 ${size}px ${K.font}`, lineHeight: 0.95, color: K.ink, letterSpacing: '-0.045em', fontVariantNumeric: 'tabular-nums' }, style)}>{children}</div>
);

function Dashboard({ T, at, out, likes }) {
  const outP = MOTION.enter(T, out, 0.4);
  const slide = (s) => lerp(lerp(1920, 0, MOTION.enter(T, s, 0.8)), -1900, outP);
  const pillIn = MOTION.pop(T, at + 0.75, 0.45), zero = MOTION.pop(T, at + 0.9, 0.5), res = MOTION.pop(T, at + 1.5, 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card bg={K.lavender} top={610} style={{ transform: `translateY(${slide(at + 0.05)}px)`, height: 630 }}>
        <CardHead title="Revenue" pill={<Pill bg={K.ink} color={K.paper} size={24} pad="14px 22px" style={{ opacity: clamp(pillIn, 0, 1), transform: `scale(${lerp(0.6, 1, pillIn)})` }}>+ $0</Pill>} />
        <Big size={250} style={{ marginTop: 28, opacity: clamp(zero, 0, 1), transform: `scale(${lerp(1.5, 1, zero)})`, transformOrigin: 'left center' }}>$0</Big>
        <div style={{ font: `500 27px ${K.font}`, color: K.ink, opacity: 0.72 * clamp(zero, 0, 1), marginTop: 14 }}>from {fmt(likes)} likes this week · 0× return</div>
        <div style={{ position: 'absolute', left: 48, right: 48, bottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {DAYS.map((d, i) => {
            const p = MOTION.pop(T, at + 1.0 + i * 0.09, 0.4);
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 72, opacity: clamp(p, 0, 1) }}>
                <div style={{ width: 56, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.75)', transform: `scaleY(${p})`, transformOrigin: 'bottom' }} />
                <div style={{ font: `${i === 5 ? 700 : 500} 20px ${K.font}`, color: K.ink, opacity: i === 5 ? 1 : 0.6 }}>{d}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card bg={K.mint} top={1264} style={{ transform: `translateY(${slide(at + 0.3)}px)`, height: 300 }}>
        <CardHead title="Reservations" pill={<div style={{ font: `600 24px ${K.font}`, color: K.ink, opacity: 0.7 }}>+0%</div>} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, marginTop: 20 }}>
          <Big size={150} style={{ opacity: clamp(res, 0, 1), transform: `scale(${lerp(1.5, 1, res)})`, transformOrigin: 'left center' }}>0</Big>
          <div style={{ font: `500 27px ${K.font}`, color: K.ink, opacity: 0.72 * clamp(res, 0, 1) }}>+ 0 tickets · 0 guests at the door</div>
        </div>
      </Card>
    </div>
  );
}

function Reckoning({ T, at, likes }) {
  const a = MOTION.enter(T, at + 0.3, 0.6), c = MOTION.pop(T, at + 0.75, 0.6), z = MOTION.pop(T, at + 1.0, 0.55);
  return (
    <Shot from={at + 0.25}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>
        <Pill bg={K.pink} size={30} pad="18px 30px"><HeartIcon size={30} fill={K.ink} />Likes this week</Pill>
        <Big size={320}>{fmt(likes)}</Big>
      </div>
      <Card bg={K.lavender} top={960} radius={56} pad={60} style={{ height: 660, opacity: clamp(c, 0, 1), transform: `scale(${lerp(0.85, 1, c)})` }}>
        <CardHead title="Revenue" pill={<Pill bg={K.ink} color={K.paper} size={26} pad="16px 26px">0× return</Pill>} size={46} />
        <Big size={380} style={{ marginTop: 40, opacity: clamp(z, 0, 1), transform: `scale(${lerp(1.6, 1, z)})`, transformOrigin: 'left center' }}>$0</Big>
        <div style={{ font: `500 32px ${K.font}`, color: K.ink, opacity: 0.72 * clamp(z, 0, 1), marginTop: 28 }}>0 reservations · 0 tickets · 0 guests</div>
      </Card>
    </Shot>
  );
}

function Close({ T, at, question }) {
  const wipe = MOTION.draw(T, at - 0.05, 0.6), b = MOTION.enter(T, at + 0.45, 0.6), h = MOTION.enter(T, at + 0.7, 0.7), q = MOTION.enter(T, at + 1.1, 0.7), tag = MOTION.pop(T, at + 1.5, 0.6);
  const grow = MOTION.draw(T, at + 0.4, 1.6), gl = MOTION.enter(T, at + 0.3, 0.6);
  const line = 'M -40 1540 C 180 1520, 300 1480, 420 1400 S 620 1240, 740 1120 S 960 860, 1120 720';
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 45%, #0f1a15 0%, #090c0a 100%)`, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`, overflow: 'hidden' }}>
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: gl }}>
        <defs>
          <linearGradient id="closeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={K.mint} stopOpacity="0.14" /><stop offset="1" stopColor={K.mint} stopOpacity="0" /></linearGradient>
          <clipPath id="closeReveal"><rect x="-40" y="0" width={grow * 1180} height="1920" /></clipPath>
        </defs>
        {[1000, 1180, 1360, 1540].map(y => <line key={y} x1="0" x2="1080" y1={y} y2={y} stroke={K.mint} strokeOpacity="0.06" strokeWidth="1.5" />)}
        <path d={`${line} L 1120 1920 L -40 1920 Z`} fill="url(#closeArea)" clipPath="url(#closeReveal)" />
        <path d={line} fill="none" stroke={K.mint} strokeOpacity="0.32" strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - grow} />
      </svg>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Lockup size={72} color={K.paper} gold="#e1ad66" style={{ opacity: b, transform: `translateY(${(1 - b) * 30}px)` }} />
        <div style={{ font: `800 124px ${K.font}`, lineHeight: 1, letterSpacing: '-0.04em', color: K.paper, marginTop: 110, opacity: h, transform: `translateY(${(1 - h) * 40}px)`, textWrap: 'balance' }}>Likes don't measure sales.<br /><span style={{ color: K.mint }}>We do.</span></div>
        <div style={{ font: `500 46px ${K.font}`, lineHeight: 1.3, color: '#c4c4c4', marginTop: 44, opacity: q, transform: `translateY(${(1 - q) * 30}px)` }}>{question}</div>
        <Pill bg={K.mint} size={34} pad="26px 48px" style={{ marginTop: 110, opacity: clamp(tag, 0, 1), transform: `scale(${lerp(0.7, 1, tag)})` }}>Track what drives sales <span style={{ marginLeft: 14 }}>→</span></Pill>
      </div>
    </div>
  );
}

function camera(T, C) {
  const L = C.Likes, G = C.Ledger, R = C.Reckoning, X = C.Close;
  if (T < L) return { s: lerp(1.22, 1, MOTION.draw(T, 0, L)), ox: 540, oy: 820 };
  if (T < G) return { s: lerp(1, 1.1, MOTION.draw(T, L, G - L)), ox: 540, oy: 760 };
  if (T < R) return { s: lerp(1, 1.03, MOTION.draw(T, G + 0.8, R - G - 0.8)), ox: 540, oy: 960 };
  if (T < X) return { s: 1, ox: 540, oy: 960 };
  return { s: lerp(1, 1.03, MOTION.draw(T, X, 2.5)), ox: 540, oy: 960 };
}

function Piece({ tweaks }) {
  const { T, CUES } = useComposition();
  const P = CUES.Post, L = CUES.Likes, G = CUES.Ledger, R = CUES.Reckoning, X = CUES.Close;
  const likes = interpolate([L + 0.1, G - 0.2, R + 0.6], [0, 6200, 8452], [Easing.easeInQuad, Easing.easeOutSine])(T);
  const cam = camera(T, CUES);
  const mv = MOTION.draw(T, G - 0.2, 0.7), gone = MOTION.enter(T, R - 0.05, 0.5);
  const phone = { x: lerp(540, 830, mv), y: lerp(lerp(880, 320, mv), -500, gone), s: lerp(1, 0.36, mv) };
  const caps = [
    { at: P + 0.4, text: 'You post. Every. Single. Day.' },
    { at: L + 0.2, text: 'And the likes pour in.' },
    { at: L + 2.0, text: 'Hundreds. Then thousands.' },
    { at: G + 0.7, text: 'Then you open the numbers.' },
    { at: G + 2.2, text: 'Zero revenue. Not one booking.' },
    { at: R + 0.3, until: X - 0.1, text: 'Thousands of likes. Zero sales.' },
  ];
  return (
    <div data-screen-label={'t=' + Math.floor(T) + 's'} style={{ position: 'absolute', inset: 0, background: K.paper, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${cam.ox}px,${cam.oy}px) scale(${cam.s}) translate(${-cam.ox}px,${-cam.oy}px)` }}>
        <Dashboard T={T} at={G + 0.05} out={R - 0.3} likes={likes} />
        <Phone x={phone.x} y={phone.y} s={phone.s}>
          <Shot from={P} to={P + 1.6}>
            <ScreenPost T={T} platform="Instagram" title="New post" action="Share" plateH={640} plateBg={K.pink} text="Doors open at 7. First coffee's on us." typeAt={P + 0.5} typeDur={0.55} tapAt={P + 1.1} postedAt={P + 1.17} outAt={P + 1.6} />
          </Shot>
          <Shot from={P + 1.6} to={L}>
            <ScreenPost T={T} platform="TikTok" title="New video" action="Post" plateH={700} plateBg={K.lavender} video text="Behind the counter, 6 a.m." typeAt={P + 2.05} typeDur={0.45} tapAt={L - 0.44} postedAt={L - 0.37} outAt={L} />
          </Shot>
          <Shot from={L}>
            <ScreenActivity T={T} start={L} likes={likes} />
            <Hearts T={T} start={L + 0.3} />
          </Shot>
        </Phone>
        <Reckoning T={T} at={R} likes={likes} />
      </div>
      {tweaks.captions && <Captions items={caps} style={{ font: `600 40px ${K.font}`, lineHeight: 1.3, color: K.ink, textShadow: 'none', bottom: '5.5%', left: '10%', right: '10%' }} />}
      <Close T={T} at={X} question={tweaks.question} />
    </div>
  );
}

const QUESTIONS = ['Track what actually drives sales and reservations.', "So who's actually buying?", 'So what are your posts earning?'];
function LikesNoSales() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1080} height={1920} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={K.paper}>
        <Piece tweaks={t} />
      </CompositionStage>
      <TweaksPanel title="Tweaks">
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
        <TweakToggle label="Voiceover captions" value={t.captions} onChange={(v) => setTweak('captions', v)} />
        <TweakSelect label="Closing question" value={t.question} options={QUESTIONS} onChange={(v) => setTweak('question', v)} />
      </TweaksPanel>
    </div>
  );
}
window.LikesNoSales = LikesNoSales;

// Embed without the tweaks panel (for landing pages).
function LikesEmbed(props) {
  const tweaks = { captions: props.captions !== false && props.captions !== 'false', question: props.question || QUESTIONS[0] };
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CompositionStage width={1080} height={1920} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={K.paper}>
        <Piece tweaks={tweaks} />
      </CompositionStage>
    </div>
  );
}
window.LikesEmbed = LikesEmbed;
