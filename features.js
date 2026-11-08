/* Old Blade Society — interactive layer: picks + your path, legend card, hidden runes, ambient sound.
   Loaded after the main script; wraps its render functions so every page gets decorated. */
(() => {
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const curEp = () => { const m = /^#ep-(\d+)$/.exec(location.hash); return m ? +m[1] : 0; };
const choiceTales = () => POSTED.filter(n => BY[n] && !BY[n].lore);

/* ======================= PICKS + YOUR PATH ======================= */
const P = { mine: LS.get("obs_picks", {}), counts: {}, loaded: false };
function pickName(n, i){ const e = BY[n]; return e.o[i]; }

async function loadCounts(){
  try{
    const rows = await rpc("vote_counts");
    const c = {};
    for (const r of rows || []) { const m = /^o(\d+)$/.exec(r.choice); if (!m) continue; (c[r.ep] ||= {})[+m[1]] = Number(r.n); }
    P.counts = c; P.loaded = true;
  }catch{ P.loaded = false; }
}
async function makePick(n, i){
  const prev = P.mine[n];
  if (prev === i) return;
  P.mine = { ...P.mine, [n]: i }; LS.set("obs_picks", P.mine);
  /* optimistic count */
  const c = (P.counts[n] ||= {});
  if (prev !== undefined && c[prev]) c[prev]--;
  c[i] = (c[i] || 0) + 1;
  paintPicks(); sfx("pick");
  toast(prev === undefined ? `Your path is chosen: ${pickName(n,i)}` : `Changed to ${pickName(n,i)}`);
  try{ if (S.uid) await rpc("cast_vote", { p_voter: S.uid, p_ep: n, p_choice: "o"+i }); await loadCounts(); paintPicks(); }catch{}
}

function decorateEp(n){
  const e = BY[n]; if (!e || e.lore || !isOpen(n)) return;
  const sec = $(".strip")?.closest(".sec"); if (!sec) return;
  const h2 = sec.querySelector("h2");
  if (h2 && !sec.querySelector(".pick-hint")){
    const p = document.createElement("p"); p.className = "pick-hint";
    p.textContent = "Tap a portrait to look closer, then choose yours to see how others chose.";
    h2.after(p);
  }
  $$(".strip .opt").forEach((fig, i) => {
    if (fig.querySelector(".pickbtn")) return;
    const pic = fig.querySelector(".pic");
    const badge = document.createElement("span"); badge.className = "pct"; pic.appendChild(badge);
    const b = document.createElement("button");
    b.type = "button"; b.className = "pickbtn"; b.dataset.pick = i;
    fig.appendChild(b);
  });
  paintPicks();
}
function paintPicks(){
  const n = curEp(); if (!n) { paintTreePath(); return; }
  const mine = P.mine[n], picked = mine !== undefined;
  const c = P.counts[n] || {}; const total = Object.values(c).reduce((a,b)=>a+b, 0);
  $$(".strip .opt").forEach((fig, i) => {
    const b = fig.querySelector(".pickbtn"); if (!b) return;
    const isMine = mine === i;
    fig.classList.toggle("mine", isMine);
    fig.classList.toggle("revealed", picked);
    b.textContent = isMine ? "Your choice ✦" : picked ? "Choose instead" : "Choose";
    const pct = total ? Math.round((c[i]||0) * 100 / total) : 0;
    const badge = fig.querySelector(".pct");
    if (badge) { badge.textContent = picked && P.loaded ? pct + "%" : ""; badge.style.setProperty("--w", picked ? pct : 0); }
  });
  const sum = $(".pick-sum");
  const sec = $(".strip")?.closest(".sec");
  if (sec && picked && P.loaded) {
    const s = sum || Object.assign(document.createElement("p"), { className: "pick-sum" });
    const same = c[mine] || 0;
    s.textContent = total > 1 ? `${same} of ${total} travellers chose ${pickName(n, mine)}.` : `You're the first to choose here.`;
    if (!sum) $(".strip").after(s);
  }
  lbPaint();
}
function paintTreePath(){
  const tales = choiceTales();
  const done = tales.filter(n => P.mine[n] !== undefined).length;
  const crest = $(".crest");
  if (crest) {
    let pr = crest.querySelector(".path-prog");
    if (!pr) { pr = document.createElement("div"); pr.className = "path-prog"; crest.appendChild(pr); }
    pr.innerHTML = done
      ? `<div class="pp-k">Your Path</div><div class="pp-bar"><i style="width:${Math.round(done*100/tales.length)}%"></i></div>
         <div class="pp-t">${done} of ${tales.length} tales chosen${done >= 3 ? ` · <button type="button" class="pp-legend" data-legend>Forge your Legend card</button>` : ""}</div>`
      : `<div class="pp-t">Open a tale and choose your path. Your choices will light up the tree.</div>`;
  }
  $$(".tree .node").forEach(node => {
    const a = node.querySelector("a.med"); if (!a) return;
    const n = +(/#ep-(\d+)/.exec(a.getAttribute("href")) || [])[1];
    const i = P.mine[n];
    node.classList.toggle("walked", i !== undefined);
    let tag = node.querySelector(".your-pick");
    if (i !== undefined) {
      if (!tag) { tag = document.createElement("div"); tag.className = "your-pick"; node.querySelector(".plaque")?.after(tag); }
      tag.textContent = "✦ " + pickName(n, i);
    } else tag?.remove();
  });
}

/* ======================= LIGHTBOX: choose from the enlarged view ======================= */
function lbPaint(){
  const lb = $("#lb"); if (!lb || lb.hidden) return;
  const n = curEp(); const e = BY[n]; if (!e || e.lore) { $("#lbpick")?.remove(); return; }
  let b = $("#lbpick");
  if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "lbpick"; b.className = "lbpick"; $(".lb-fig").appendChild(b); }
  const isMine = P.mine[n] === LB.i;
  b.textContent = isMine ? "Your choice ✦" : "Make this my choice";
  b.classList.toggle("on", isMine);
}
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-pick]");
  if (b) { const n = curEp(); if (n) makePick(n, +b.dataset.pick); return; }
  if (ev.target.closest("#lbpick")) { const n = curEp(); if (n) makePick(n, LB.i); return; }
  if (ev.target.closest("[data-legend]")) { forgeLegend(); return; }
  const r = ev.target.closest("[data-rune]"); if (r) { findRune(r.dataset.rune, r); return; }
  if (ev.target.closest("#sound")) { toggleSound(); return; }
});

/* ======================= LEGEND CARD ======================= */
function loadImg(src){ return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function cover(ctx, im, x, y, w, h){
  const r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r;
  ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) * 0.45, sw, sh, x, y, w, h);
}
async function forgeLegend(){
  const tales = choiceTales().filter(n => P.mine[n] !== undefined);
  if (tales.length < 3) { toast("Choose in at least three tales first"); return; }
  toast("Forging your Legend…");
  await document.fonts?.ready;
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  /* ground */
  const bg = g.createRadialGradient(W/2, 700, 100, W/2, 900, 1300);
  bg.addColorStop(0, "#2a1a0e"); bg.addColorStop(.6, "#140d08"); bg.addColorStop(1, "#070403");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const gold = g.createLinearGradient(0, 0, 0, 200); gold.addColorStop(0, "#f6e2a4"); gold.addColorStop(.6, "#c9a14a"); gold.addColorStop(1, "#8a6526");
  g.strokeStyle = "#c9a14a"; g.lineWidth = 3; g.strokeRect(36, 36, W-72, H-72);
  g.strokeStyle = "rgba(201,161,74,.35)"; g.lineWidth = 1; g.strokeRect(50, 50, W-100, H-100);
  g.textAlign = "center"; g.fillStyle = "#c9a14a";
  g.font = "600 30px Cinzel, Georgia, serif"; g.fillText("O L D   B L A D E   S O C I E T Y", W/2, 140);
  g.font = "900 104px 'Cinzel Decorative', Cinzel, Georgia, serif";
  const tg = g.createLinearGradient(0, 170, 0, 290); tg.addColorStop(0, "#fff1c4"); tg.addColorStop(.55, "#e2bd62"); tg.addColorStop(1, "#9c7430");
  g.fillStyle = tg; g.fillText("My Legend", W/2, 270);
  g.fillStyle = "#c9a14a"; g.fillRect(W/2 - 160, 312, 120, 2); g.fillRect(W/2 + 40, 312, 120, 2);
  g.save(); g.translate(W/2, 313); g.rotate(Math.PI/4); g.fillRect(-7, -7, 14, 14); g.restore();
  g.font = "28px 'IM Fell English', Georgia, serif"; g.fillStyle = "#e8dcc2";
  g.fillText(`${tales.length} tale${tales.length>1?"s":""} walked on the Tree of Tales`, W/2, 372);
  /* portraits: sized to fill the card for however many tales were walked */
  const list = tales.slice(-12), N = list.length;
  const cols = N <= 4 ? Math.min(N, 2) : 3, rows = Math.ceil(N / cols);
  const areaTop = 420, areaH = H - 220 - areaTop, gx = 34, gy = 30;
  const capH = 92;
  let cw = Math.min((W - 140 - (cols - 1) * gx) / cols, 420);
  let ch = Math.min((areaH - (rows - 1) * gy) / rows, cw * 1.6 + capH);
  cw = Math.min(cw, (ch - capH) / 1.25);
  const top = areaTop + (areaH - (rows * ch + (rows - 1) * gy)) / 2;
  for (let k = 0; k < N; k++) {
    const n = list[k], i = P.mine[n];
    const r = Math.floor(k / cols), c = k % cols;
    const inRow = Math.min(cols, N - r * cols);
    const x0 = (W - (inRow * cw + (inRow - 1) * gx)) / 2 + c * (cw + gx), y0 = top + r * (ch + gy);
    const ph = ch - capH;
    try { const im = await loadImg(img(n, i + 1)); g.save(); g.beginPath(); g.rect(x0, y0, cw, ph); g.clip(); cover(g, im, x0, y0, cw, ph); g.restore(); } catch {}
    g.strokeStyle = ACC[n]; g.lineWidth = 3; g.strokeRect(x0, y0, cw, ph);
    const fs = Math.max(18, Math.min(24, cw / 13));
    g.fillStyle = ACC[n]; g.font = `700 ${fs}px Cinzel, Georgia, serif`; g.fillText(BY[n].t.toUpperCase(), x0 + cw/2, y0 + ph + 36, cw - 6);
    g.fillStyle = "#f3e8cf"; g.font = `${fs + 8}px 'IM Fell English', Georgia, serif`; g.fillText(pickName(n, i), x0 + cw/2, y0 + ph + 74, cw - 6);
  }
  g.fillStyle = "#c9a14a"; g.font = "600 30px Cinzel, Georgia, serif"; g.fillText("Walk your own path", W/2, H - 150);
  g.fillStyle = "#e8dcc2"; g.font = "30px 'IM Fell English', Georgia, serif";
  g.fillText(location.host + "   ·   @oldbladesociety", W/2, H - 104);
  const blob = await new Promise(r => cv.toBlob(r, "image/png"));
  const file = new File([blob], "my-legend-oldbladesociety.png", { type: "image/png" });
  showLegend(URL.createObjectURL(blob), file);
}
function showLegend(url, file){
  let m = $("#legend");
  if (!m) { m = document.createElement("div"); m.id = "legend"; m.className = "legend-modal"; document.body.appendChild(m); }
  m.innerHTML = `<div class="lg-in"><button type="button" class="lb-x" data-lgclose aria-label="Close">✕</button>
    <img src="${url}" alt="Your Legend card">
    <div class="lg-act"><button type="button" class="share" data-lgshare>Share to your story</button><a class="share" href="${url}" download="my-legend-oldbladesociety.png">Save image</a></div></div>`;
  m.hidden = false; document.body.style.overflow = "hidden";
  m.onclick = async ev => {
    if (ev.target === m || ev.target.closest("[data-lgclose]")) { m.hidden = true; document.body.style.overflow = ""; return; }
    if (ev.target.closest("[data-lgshare]")) {
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Legend · Old Blade Society" }); return; } } catch (e) { if (e?.name === "AbortError") return; }
      const a = m.querySelector("a[download]"); a.click(); toast("Saved. Post it to your story and tag @oldbladesociety");
    }
  };
}

/* ======================= HIDDEN RUNES ======================= */
const RUNES = [
  { id: "r1", ep: 2,  glyph: "ᚱ", where: "hero" },
  { id: "r2", ep: 5,  glyph: "ᚦ", where: "chronicle" },
  { id: "r3", ep: 10, glyph: "ᛟ", where: "foot" },
  { id: "r4", ep: 13, glyph: "ᚹ", where: "choices" },
  { id: "r5", ep: 20, glyph: "ᛉ", where: "next" },
];
const found = () => LS.get("obs_runes", []);
function placeRune(n){
  const r = RUNES.find(x => x.ep === n); if (!r || found().includes(r.id)) return;
  const host = { hero: ".hero .frame", chronicle: ".chronicle", foot: ".foot", choices: ".strip", next: "#next" }[r.where];
  const el = r.where === "choices" ? $(".strip")?.closest(".sec") : $(host); if (!el) return;
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const b = document.createElement("button");
  b.type = "button"; b.className = `rune rune-${r.where}`; b.dataset.rune = r.id; b.textContent = r.glyph; b.setAttribute("aria-label", "A strange rune");
  el.appendChild(b);
}
function findRune(id, el){
  const f = found(); if (f.includes(id)) return;
  f.push(id); LS.set("obs_runes", f); sfx("rune");
  el.classList.add("got"); setTimeout(() => el.remove(), 900);
  if (f.length >= RUNES.length) { toast("All five runes found. The hidden vault is open."); setTimeout(() => location.hash = "#vault", 1400); }
  else toast(`Rune ${f.length} of ${RUNES.length} found`);
  paintRuneCount();
}
function paintRuneCount(){
  const f = found().length; const crest = $(".crest"); if (!crest || !f) return;
  let r = crest.querySelector(".rune-count");
  if (!r) { r = document.createElement(f >= RUNES.length ? "a" : "div"); r.className = "rune-count"; crest.appendChild(r); }
  r.innerHTML = RUNES.map((x, i) => `<span class="${i < f ? "on" : ""}">${i < f ? x.glyph : "·"}</span>`).join("") + (f >= RUNES.length ? ` <a href="#vault">Enter the vault →</a>` : "");
}
function renderVault(){
  if (found().length < RUNES.length) { location.hash = ""; return; }
  document.title = "The Vault · The Tree of Tales";
  bd.hidden = true;
  app.innerHTML = `<div class="ep vault" style="--acc:#c9a14a">
    <nav class="topnav"><a href="#tree">← The Tree</a></nav>
    <div class="vault-in">
      <div class="runes-row">${RUNES.map(r => `<span>${r.glyph}</span>`).join("")}</div>
      <div class="eyebrow">The hidden vault</div>
      <h1>Why the Society keeps the Tree</h1>
      <div class="chronicle"><div class="leaf">
        <p>${illum("B")}<span class="sr">B</span>efore there were kingdoms there was a single sword, and the sword had a voice. It did not speak of battles. It spoke of choices: the road taken at the fork, the oath sworn at the fire, the door left shut.</p>
        <p>The first keepers broke the blade into pieces so no single king could hear it. Each shard went to a different keeper, and each keeper learned to listen. They called themselves the Old Blade Society.</p>
        <p>Every tale on the Tree is a shard still talking. Every choice a traveller makes is written into the bark. When enough travellers walk the same branch, the branch grows, and the next chapter is carved.</p>
        <p>You found the five runes, so the keepers count you among them now. Walk carefully. The Tree remembers every path.</p>
        <p class="q">Show this page to no one. Or show it to your bro.</p>
      </div></div>
    </div></div>`;
}

/* ======================= AMBIENT SOUND (synthesised, no files) ======================= */
const SND = { on: LS.get("obs_sound", false), ctx: null, master: null, cur: null, noise: null };
const AMB = { 1:"wind",2:"wind",3:"water",4:"wind",5:"drone",6:"fire",7:"fire",8:"wind",9:"drone",10:"fire",11:"wind",12:"rain",13:"drone",14:"drone",15:"fire",16:"fire",18:"wind",19:"fire",20:"drone",21:"water",22:"fire",23:"forest" };
function audio(){
  if (SND.ctx) return SND.ctx;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  const ctx = SND.ctx = new C();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .3;
  SND.master = ctx.createGain(); SND.master.gain.value = 1.6; SND.master.connect(comp).connect(ctx.destination);
  SND.analyser = ctx.createAnalyser(); comp.connect(SND.analyser);
  /* three noise colours, 4 s loops */
  const len = ctx.sampleRate * 4, mk = () => ctx.createBuffer(1, len, ctx.sampleRate);
  const white = mk(), pink = mk(), brown = mk(), w = white.getChannelData(0), p = pink.getChannelData(0), br = brown.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
  for (let i = 0; i < len; i++) {
    const x = Math.random()*2-1; w[i] = x;
    b0=.99886*b0+x*.0555179; b1=.99332*b1+x*.0750759; b2=.969*b2+x*.153852; b3=.8665*b3+x*.3104856; b4=.55*b4+x*.5329522; b5=-.7616*b5-x*.016898;
    p[i] = (b0+b1+b2+b3+b4+b5+b6+x*.5362)*.11; b6 = x*.115926;
    last = (last + .02*x)/1.02; br[i] = last*3.5;
  }
  SND.buf = { white, pink, brown }; SND.noise = white;
  return ctx;
}
function noiseSrc(kind="pink"){ const s = SND.ctx.createBufferSource(); s.buffer = SND.buf[kind]; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random()*3); return s; }
function lfo(freq, depth, target){ const o = SND.ctx.createOscillator(), g = SND.ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start(); return o; }
function filt(type, f, q=.7){ const x = SND.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
const rand = (a,b) => a + Math.random()*(b-a);
/* each ambience is a few quiet, recognisable layers */
function makeAmb(kind){
  const ctx = SND.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(SND.master);
  const nodes = [], timers = [];
  const layer = (src, chain, vol) => { const g = ctx.createGain(); g.gain.value = vol; let n = src; for (const c of chain) n = n.connect(c); n.connect(g).connect(out); nodes.push(src); return g; };
  const every = (fn, a, b) => { let t; const tick = () => { fn(); t = setTimeout(tick, rand(a, b)); timers.push(t); }; t = setTimeout(tick, rand(a, b)); timers.push(t); };
  const gusts = (g, base, peak) => every(() => { const t = ctx.currentTime, up = rand(1.2, 3), hold = rand(.5, 2), down = rand(2, 4);
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(rand(base, peak), t, up/3); g.gain.setTargetAtTime(base, t + up + hold, down/3); }, 4000, 9000);

  if (kind === "fire" || kind === "hearth") {
    /* low roar of the flames + soft hiss + crackles and the odd pop */
    layer(noiseSrc("brown"), [filt("lowpass", 260)], .32);
    const hiss = layer(noiseSrc("white"), [filt("highpass", 5200)], .006); nodes.push(lfo(.2, .003, hiss.gain));
    every(() => { const n = 1 + (Math.random()*4|0); for (let k = 0; k < n; k++) crackle(out, k * rand(.015, .06), rand(.05, .22)); }, 90, 420);
    every(() => crackle(out, 0, rand(.35, .55), 600), 2500, 7000);
  } else if (kind === "wind" || kind === "forest") {
    /* two moving bands of wind with slow gusts, a faint whistle on top */
    const g1 = layer(noiseSrc("pink"), [Object.assign(filt("bandpass", 380, .6), {})], .22);
    const bp = filt("bandpass", 900, 6); const g2 = layer(noiseSrc("white"), [bp], .012);
    nodes.push(lfo(.05, 160, bp.frequency));
    gusts(g1, .12, .34); gusts(g2, .004, .02);
    if (kind === "forest") { layer(noiseSrc("pink"), [filt("highpass", 2500), filt("lowpass", 7000)], .015); every(() => birdSong(out), 3000, 9000); }
  } else if (kind === "rain") {
    /* steady patter, close drops, distant roll */
    layer(noiseSrc("pink"), [filt("highpass", 900), filt("lowpass", 9000)], .09);
    layer(noiseSrc("brown"), [filt("lowpass", 180)], .12);
    every(() => { for (let k = 0; k < 3; k++) drop(out, k * rand(.02, .12)); }, 60, 220);
    every(() => thunder(out), 15000, 30000);
  } else if (kind === "water") {
    /* waves washing in and out */
    const lp = filt("lowpass", 700); const g = layer(noiseSrc("pink"), [lp], .05);
    every(() => { const t = ctx.currentTime, rise = rand(1.6, 2.6), fall = rand(2.4, 3.6), peak = rand(.22, .34);
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(peak, t, rise/3); g.gain.setTargetAtTime(.04, t + rise, fall/3);
      lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(1600, t, rise/3); lp.frequency.setTargetAtTime(600, t + rise, fall/3); }, 5000, 8000);
    layer(noiseSrc("white"), [filt("bandpass", 3200, 1.5)], .008);
  } else { /* drone: cavern air, a deep slow hum and far-off rumble */
    layer(noiseSrc("brown"), [filt("lowpass", 140)], .22);
    const hum = filt("lowpass", 220); const hg = ctx.createGain(); hg.gain.value = .045; hum.connect(hg).connect(out);
    [55, 55.6, 82.4].forEach((f, k) => { const o = ctx.createOscillator(); o.type = k === 2 ? "triangle" : "sine"; o.frequency.value = f; o.connect(hum); o.start(); nodes.push(o); });
    nodes.push(lfo(.03, .02, hg.gain));
    const air = layer(noiseSrc("pink"), [filt("bandpass", 500, .8)], .05); gusts(air, .03, .08);
  }
  out.gain.setTargetAtTime(1, ctx.currentTime, .8);
  return { stop(){ const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .4);
    timers.forEach(clearTimeout); timers.length = 0; setTimeout(() => { nodes.forEach(x => { try{ x.stop(); }catch{} }); out.disconnect(); }, 2000); } };
}
function crackle(dest, delay, vol, lowest=1500){
  const ctx = SND.ctx, s = ctx.createBufferSource(); s.buffer = SND.buf.white;
  const bp = filt("bandpass", rand(lowest, lowest*3), rand(1, 4));
  const g = ctx.createGain(), t = ctx.currentTime + delay, d = rand(.006, .025);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .0015); g.gain.exponentialRampToValueAtTime(.0005, t + d);
  s.connect(bp).connect(g).connect(dest); s.start(t, Math.random()*3, d + .02);
}
function drop(dest, delay){
  const ctx = SND.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay, f = rand(2500, 5500);
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f*.6, t + .03);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rand(.008, .03), t + .002); g.gain.exponentialRampToValueAtTime(.0003, t + .04);
  o.connect(g).connect(dest); o.start(t); o.stop(t + .06);
}
function thunder(dest){
  const ctx = SND.ctx, s = ctx.createBufferSource(); s.buffer = SND.buf.brown;
  const lp = filt("lowpass", 120), g = ctx.createGain(), t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .8); g.gain.setTargetAtTime(0, t + 1.5, 1.5);
  s.connect(lp).connect(g).connect(dest); s.start(t, Math.random()*2, 7);
}
function birdSong(dest){
  const ctx = SND.ctx, n = 2 + (Math.random()*4|0), base = rand(2400, 3800), t0 = ctx.currentTime;
  for (let k = 0; k < n; k++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + k * rand(.09, .16), f = base * rand(.9, 1.15);
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rand(1.2, 1.5), t + .05); o.frequency.exponentialRampToValueAtTime(f * .85, t + .1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.012, t + .015); g.gain.exponentialRampToValueAtTime(.0003, t + .12);
    o.connect(g).connect(dest); o.start(t); o.stop(t + .14);
  }
}
function setAmbience(){
  if (!SND.on || !audio()) return;
  const n = curEp(); const kind = location.hash === "#vault" ? "drone" : n ? (AMB[n] || "drone") : "wind";
  if (SND.cur && SND.cur.kind === kind) return;
  SND.cur?.stop(); SND.cur = makeAmb(kind); SND.cur.kind = kind;
}
function sfx(type){
  if (!SND.on || !audio()) return;
  const ctx = SND.ctx, t = ctx.currentTime, out = ctx.createGain(); out.gain.value = .5; out.connect(SND.master);
  const bell = (f, at, dur, vol) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t+at); g.gain.linearRampToValueAtTime(vol, t+at+.01); g.gain.exponentialRampToValueAtTime(.0005, t+at+dur); o.connect(g).connect(out); o.start(t+at); o.stop(t+at+dur+.05); };
  if (type === "open" || type === "close") {
    const s = ctx.createBufferSource(); s.buffer = SND.noise; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    const g = ctx.createGain(); bp.frequency.setValueAtTime(type === "open" ? 300 : 2400, t); bp.frequency.exponentialRampToValueAtTime(type === "open" ? 2400 : 300, t + 1.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .3); g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
    s.connect(bp).connect(g).connect(out); s.start(t); s.stop(t + 1.5);
    const notes = type === "open" ? [392, 523.3, 659.3, 784, 1046.5] : [1046.5, 784, 659.3, 523.3, 392];
    notes.forEach((f, k) => { bell(f, .35 + k*.09, 1.6, .07); bell(f*2.01, .35 + k*.09, .8, .02); });
  } else if (type === "pick") { bell(659.3, 0, .9, .1); bell(987.8, .07, 1.1, .08); }
  else if (type === "rune") { [196, 293.7, 392, 587.3].forEach((f, k) => bell(f, k*.12, 2.2, .09)); }
}
function silentWav(){
  const sr = 8000, n = sr / 2, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}
function unlockIOS(){
  if (!SND.tag) { SND.tag = new Audio(silentWav()); SND.tag.loop = true; SND.tag.setAttribute("playsinline", ""); }
  SND.tag.play().catch(() => {});
}
function toggleSound(){
  SND.on = !SND.on; LS.set("obs_sound", SND.on);
  if (SND.on) { unlockIOS(); audio(); SND.ctx?.resume(); setAmbience(); toast("Sound on"); }
  else { SND.cur?.stop(); SND.cur = null; SND.tag?.pause(); toast("Sound off"); }
  paintSound();
}
function paintSound(){
  let b = $("#sound");
  if (!b) { b = document.createElement("button"); b.id = "sound"; b.type = "button"; b.className = "sound-btn"; document.body.appendChild(b); }
  b.setAttribute("aria-label", SND.on ? "Turn sound off" : "Turn sound on");
  b.classList.toggle("on", SND.on);
  b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/>${SND.on ? '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>'}</svg>`;
}
/* browsers need a tap before audio may play: resume quietly on the first gesture if sound was left on */
document.addEventListener("pointerdown", ev => { if (SND.on && !ev.target.closest("#sound")) { unlockIOS(); audio(); SND.ctx?.resume(); setAmbience(); } }, { once: true });
window.__obsSound = SND;

/* ======================= wire into the page ======================= */
const _renderEp = renderEp, _renderTree = renderTree, _route = route, _lbShow = lbShow, _playT = playTransition, _playR = playReturn;
window.renderEp = renderEp = function(n){ _renderEp(n); decorateEp(n); placeRune(n); setAmbience(); };
window.renderTree = renderTree = function(){ _renderTree(); paintTreePath(); paintRuneCount(); setAmbience(); };
window.route = route = function(){ if (location.hash === "#vault") { renderVault(); window.scrollTo(0,0); setAmbience(); return; } _route(); };
window.lbShow = lbShow = function(i){ _lbShow(i); lbPaint(); };
window.playTransition = playTransition = function(n, el){ sfx("open"); return _playT(n, el); };
window.playReturn = playReturn = function(n){ sfx("close"); return _playR(n); };
window.removeEventListener("hashchange", _route);
window.addEventListener("hashchange", route);
if (!S.uid) { try { S.uid = voterId(); } catch {} }
paintSound();
route();
(async () => { await loadCounts(); paintPicks(); })();
})();
