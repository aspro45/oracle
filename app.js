import { makeReader, write, connectWallet, activeAccount, balanceOf, short, toGen, GEN, fmtErr }
  from "../shared/genlayer-lite.js";

const CONTRACT = "0x215585A266e5a9249057dd5E1096692957D4F319";
const EXPLORER_URL = "https://explorer-studio.genlayer.com/address/" + CONTRACT;
const { read } = makeReader(CONTRACT);
const POSTED = 0, VERIFIED = 1, DISPUTED = 2, SETTLED = 3;
const STLABEL = ["Posted", "Verified", "Disputed", "Settled"];
const STCLS = ["s-posted", "s-verified", "s-disputed", "s-settled"];
let account = null, feeds = [];
const $ = (id) => document.getElementById(id);
const esc = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const safeUrl = (s) => {
  try {
    const u = new URL(s || "");
    return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "about:blank";
  } catch (_) { return "about:blank"; }
};

$("contractLink").textContent = "Contract " + short(CONTRACT);
$("contractLink").href = EXPLORER_URL;

function toast(msg, kind = "", title = "oracle") {
  const el = document.createElement("div"); el.className = "toast " + kind;
  el.innerHTML = `<span class="tt">${title}</span>`; el.appendChild(document.createTextNode(msg));
  $("log").appendChild(el); setTimeout(() => el.remove(), kind === "err" ? 15000 : 5000);
}

// scroll reveals
const _io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("in"); _io.unobserve(e.target); }
}), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => _io.observe(el));

function countUp(el, to) {
  if (!window.gsap || !el) { if (el) el.textContent = to; return; }
  const target = parseFloat(to) || 0;
  const obj = { v: 0 };
  gsap.to(obj, { v: target, duration: 1.3, ease: "power2.out",
    onUpdate: () => { el.textContent = target % 1 ? obj.v.toFixed(1) : Math.round(obj.v); },
    onComplete: () => { el.textContent = target % 1 ? target.toFixed(1) : Math.round(target); } });
}

// ---------- DATA ----------
async function refreshWallet() {
  account = await activeAccount();
  const slot = $("walletslot");
  if (account) { let bal = 0n; try { bal = await balanceOf(account); } catch (_) {} slot.innerHTML = `<span class="mono" style="font-size:12px;color:var(--txt2)">${short(account)} · ${toGen(bal)} GEN</span>`; }
  else { slot.innerHTML = `<button class="btn ghost sm" id="connectBtn">Connect</button>`; $("connectBtn").onclick = doConnect; }
}
async function doConnect() { try { account = await connectWallet(); toast("Connected on studionet.", "ok"); await refreshWallet(); } catch (e) { toast(fmtErr(e), "err"); } }
async function ensureWallet() { if (!account) account = await connectWallet(); await refreshWallet(); }

async function load() {
  try {
    const count = Number(await read("get_feed_count"));
    const out = [];
    for (let i = 0; i < count; i++) out.push({ id: i, ...(await read("get_feed", [i])) });
    feeds = out;
    renderTicker(); renderList(); drawChart();
    $("feedMeta").textContent = count + (count === 1 ? " feed" : " feeds");
    countUp($("stFeeds"), count);
    countUp($("stBonded"), (Number(out.reduce((a, f) => a + BigInt(f.bond), 0n)) / 1e18).toFixed(1));
    countUp($("stVerified"), out.filter((f) => Number(f.status) === VERIFIED).length);
  } catch (e) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Could not reach the chain. " + fmtErr(e);
    $("feedList").replaceChildren(empty);
  }
}

function renderTicker() {
  const el = $("ticker"); if (!el) return;
  if (!feeds.length) { el.innerHTML = `<span class="tk dim">No feeds yet · post the first price claim to begin</span>`; return; }
  const items = feeds.map((f) => {
    const v = Number(f.status) === VERIFIED;
    return `<span class="tk">${esc(f.asset)} <b>$${esc(f.claimed_price)}</b>${v ? '<i class="ph-bold ph-seal-check"></i>' : ''}</span>`;
  }).join("");
  el.innerHTML = items + items; // duplicate for seamless marquee
}

function renderList() {
  const el = $("feedList");
  if (!feeds.length) { el.innerHTML = `<div class="empty">No feeds posted yet.</div>`; return; }
  el.innerHTML = "";
  [...feeds].reverse().forEach((f) => {
    const st = Number(f.status);
    const row = document.createElement("div"); row.className = "frow";
    let host = ""; try { host = new URL(f.source_url).hostname.replace("www.", ""); } catch (_) { host = "source"; }
    row.innerHTML = `<div class="fr-l"><span class="fr-asset">${esc(f.asset)}</span><span class="fr-src">${esc(host)}</span></div>
      <div class="fr-r"><span class="fr-price">$${esc(f.claimed_price)}</span><span class="fr-badge ${STCLS[st]}">${STLABEL[st]}</span></div>`;
    row.onclick = () => openDetail(f.id);
    el.appendChild(row);
  });
}

function drawChart() {
  const node = $("priceChart"); if (!node || !window.d3) return;
  const svg = d3.select(node); svg.selectAll("*").remove();
  const W = node.clientWidth || node.parentNode.clientWidth || 600, H = 240;
  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
  const m = { t: 14, r: 12, b: 30, l: 48 };
  const data = feeds.slice(-9).map((f, i) => ({ i, claimed: parseFloat(f.claimed_price) || 0, verified: parseFloat(f.verified_price) || 0, asset: f.asset }));
  if (!data.length) { svg.append("text").attr("x", W / 2).attr("y", H / 2).attr("text-anchor", "middle").attr("fill", "#3d6450").attr("font-family", "JetBrains Mono").attr("font-size", 12).text("No feeds posted yet"); return; }
  const x = d3.scaleBand().domain(data.map((d) => d.i)).range([m.l, W - m.r]).padding(0.34);
  const maxP = d3.max(data, (d) => Math.max(d.claimed, d.verified)) || 100;
  const y = d3.scaleLinear().domain([0, maxP * 1.15]).range([H - m.b, m.t]);
  // gridlines
  y.ticks(4).forEach((t) => {
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "rgba(80,255,160,.07)");
    svg.append("text").attr("x", m.l - 8).attr("y", y(t) + 3).attr("text-anchor", "end").attr("fill", "#3d6450").attr("font-size", 9).attr("font-family", "JetBrains Mono").text(t >= 1000 ? (t / 1000) + "k" : t);
  });
  svg.selectAll(".bc").data(data).enter().append("rect").attr("x", (d) => x(d.i)).attr("width", x.bandwidth() / 2 - 1).attr("rx", 3).attr("y", H - m.b).attr("height", 0).attr("fill", "#ffc857")
    .transition().duration(800).delay((d, i) => i * 60).ease(d3.easeCubicOut).attr("y", (d) => y(d.claimed)).attr("height", (d) => H - m.b - y(d.claimed));
  svg.selectAll(".bv").data(data).enter().append("rect").attr("x", (d) => x(d.i) + x.bandwidth() / 2 + 1).attr("width", x.bandwidth() / 2 - 1).attr("rx", 3).attr("y", H - m.b).attr("height", 0).attr("fill", "#45ffab").attr("opacity", (d) => d.verified ? 1 : 0.22)
    .transition().duration(800).delay((d, i) => 160 + i * 60).ease(d3.easeCubicOut).attr("y", (d) => y(d.verified || d.claimed)).attr("height", (d) => H - m.b - y(d.verified || d.claimed));
  svg.selectAll(".lbl").data(data).enter().append("text").attr("x", (d) => x(d.i) + x.bandwidth() / 2).attr("y", H - 9).attr("text-anchor", "middle").attr("fill", "#84b89c").attr("font-size", 11).attr("font-family", "JetBrains Mono").text((d) => d.asset);
}

// ---------- DRAWER ----------
function openDrawer() { $("scrim").classList.add("on"); $("drawer").classList.add("on"); }
function closeDrawer() { $("scrim").classList.remove("on"); $("drawer").classList.remove("on"); }

function openPost() {
  $("drawerTitle").textContent = "Post a price feed";
  $("drawerBody").innerHTML = `
    <p style="color:var(--txt2);font-size:14.5px">Claim a price and stake GEN. Validators read your source and verify against reality. Accurate claims keep the bond.</p>
    <label>Asset</label><input id="fAsset" placeholder="BTC" maxlength="20" />
    <label>Source URL</label><input id="fUrl" placeholder="https://api.coinbase.com/v2/prices/BTC-USD/spot" />
    <div class="hint">A public page the contract can read to find the price.</div>
    <label>Claimed price</label><input id="fPrice" placeholder="67500" />
    <label>Tolerance %</label><input id="fTol" type="number" min="1" max="50" value="5" />
    <label>Bond (GEN)</label><input id="fBond" type="number" min="0" step="0.1" value="1" />
    <button class="btn primary block" id="submitPost"><i class="ph-bold ph-paper-plane-tilt"></i> Submit feed</button>`;
  $("submitPost").onclick = doPost; openDrawer();
}

function openDetail(id) {
  const f = feeds.find((x) => x.id === id); if (!f) return;
  const st = Number(f.status), disputed = f.challenger && !/^0x0+$/.test(f.challenger);
  $("drawerTitle").textContent = f.asset + " · feed #" + id;
  const sourceHref = safeUrl(f.source_url);
  let verdict = "";
  if (st === VERIFIED) verdict = `<div class="verdict-box vb-ok"><b style="color:var(--green)">Verified.</b> The source confirmed this price within tolerance.</div>`;
  if (st === DISPUTED) verdict = `<div class="verdict-box vb-no"><b style="color:var(--red)">Disputed.</b> A re-read disagreed with the claim.</div>`;
  let actions = "";
  if (st === POSTED) actions = `<button class="btn ghost block" id="challengeBtn">Challenge · bond ${toGen(f.bond)} GEN</button><button class="btn primary block" id="verifyBtn"><i class="ph-bold ph-seal-check"></i> Verify from source</button>`;
  else if (st === DISPUTED) actions = `<button class="btn primary block" id="verifyBtn"><i class="ph-bold ph-seal-check"></i> Settle from source</button>`;
  $("drawerBody").innerHTML = `
    <div style="font-family:var(--fd);font-weight:700;font-size:24px">${esc(f.asset)}</div>
    <div class="d-price">$${esc(f.claimed_price)}</div>
    ${f.verified_price ? `<label>Verified</label><div style="color:var(--amber);font-family:var(--fm);font-size:16px;margin-bottom:8px">$${esc(f.verified_price)}</div>` : ""}
    ${verdict}
    <div class="kv"><span class="k">Source</span><span class="v"><a href="${esc(sourceHref)}" target="_blank" rel="noopener noreferrer">${esc(f.source_url)}</a></span></div>
    <div class="kv"><span class="k">Tolerance</span><span class="v">±${f.tolerance_pct}%</span></div>
    <div class="kv"><span class="k">Bond</span><span class="v">${toGen(f.bond)} GEN</span></div>
    <div class="kv"><span class="k">Poster</span><span class="v mono">${short(f.poster)}</span></div>
    ${disputed ? `<div class="kv"><span class="k">Challenger</span><span class="v mono">${short(f.challenger)}</span></div>` : ""}
    <div class="kv"><span class="k">Status</span><span class="v">${STLABEL[st]}</span></div>
    <div style="margin-top:16px">${actions}</div>`;
  openDrawer();
  if (st === POSTED) { $("challengeBtn").onclick = () => doChallenge(id, f.bond); $("verifyBtn").onclick = () => doVerify(id); }
  else if (st === DISPUTED) $("verifyBtn").onclick = () => doVerify(id);
}

async function doPost() {
  const asset = $("fAsset").value.trim(), url = $("fUrl").value.trim(), price = $("fPrice").value.trim();
  const tol = parseInt($("fTol").value), bond = parseFloat($("fBond").value);
  if (!asset) return toast("Asset required.", "err");
  if (!url) return toast("Source URL required.", "err");
  if (!price) return toast("Price required.", "err");
  if (!(bond > 0)) return toast("Bond must be above zero.", "err");
  const btn = $("submitPost"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> posting';
  try { await ensureWallet(); await write(CONTRACT, "post_price", [asset, url, price, tol], GEN(bond)); toast("Feed posted on-chain.", "ok"); closeDrawer(); await load(); }
  catch (e) { toast(fmtErr(e), "err"); btn.disabled = false; btn.innerHTML = "Submit feed"; }
}
async function doChallenge(id, bondWei) {
  try { await ensureWallet(); await write(CONTRACT, "challenge", [id], BigInt(bondWei)); toast("Challenge posted.", "ok"); closeDrawer(); await load(); }
  catch (e) { toast(fmtErr(e), "err"); }
}
async function doVerify(id) {
  if (!confirm("Verify now? Validators read the source URL and extract the real price. Calls a real LLM.")) return;
  const btn = $("verifyBtn"); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> verifying'; }
  try { await ensureWallet(); toast("Validators reading the source…", "", "verify"); await write(CONTRACT, "verify", [id]); toast("Verified on-chain.", "ok"); closeDrawer(); await load(); }
  catch (e) { toast(fmtErr(e), "err"); if (btn) { btn.disabled = false; btn.textContent = "Verify from source"; } }
}

// ---------- bindings ----------
$("heroPostBtn").onclick = openPost;
$("ctaPostBtn").onclick = openPost;
$("refreshBtn").onclick = load;
$("closeDrawer").onclick = closeDrawer;
$("scrim").onclick = closeDrawer;
const _cb = $("connectBtn"); if (_cb) _cb.onclick = doConnect;
if (window.ethereum) window.ethereum.on?.("accountsChanged", refreshWallet);
window.addEventListener("resize", () => { clearTimeout(window._rs); window._rs = setTimeout(drawChart, 200); });

refreshWallet();
load();

// ============ THREE.JS HERO: a living network of price nodes ============
(function heroScene() {
  const canvas = $("heroCanvas"); if (!canvas || !window.THREE) return;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04100a, 0.035);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 16);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight || 600; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  const GREEN = 0x45ffab, DEEP = 0x0e7a4e, CYAN = 0x54e6ff;

  // central faceted core — the "consensus" point
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0a3a24, emissive: DEEP, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.25, flatShading: true })
  );
  scene.add(core);
  const coreWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.45, 1)),
    new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.25 })
  );
  scene.add(coreWire);

  // orbiting price nodes connected to the core (a network)
  const group = new THREE.Group(); scene.add(group);
  const nodes = [];
  const N = 11;
  const nodeGeo = new THREE.SphereGeometry(0.22, 16, 16);
  const nodeMat = new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.3 });
  const lineMat = new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.14 });
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(nodeGeo, i % 4 === 0 ? nodeMat.clone() : nodeMat);
    const theta = Math.acos(1 - 2 * (i + 0.5) / N), phi = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 6.2 + Math.random() * 1.6;
    const base = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)).multiplyScalar(r);
    m.position.copy(base);
    group.add(m);
    // connecting line to core
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), base]);
    const line = new THREE.Line(g, lineMat); group.add(line);
    nodes.push({ m, base, line, sp: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28 });
  }

  // particle dust
  const PN = 420, pp = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { pp[i*3]=(Math.random()-.5)*44; pp[i*3+1]=(Math.random()-.5)*30; pp[i*3+2]=(Math.random()-.5)*30; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: GREEN, size: 0.07, transparent: true, opacity: 0.5 }));
  scene.add(dust);

  // lighting
  scene.add(new THREE.AmbientLight(0x2a5a40, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(5, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(CYAN, 1.4, 40); rim.position.set(-8, -4, 6); scene.add(rim);
  const warm = new THREE.PointLight(GREEN, 1.6, 35); warm.position.set(6, 3, 4); scene.add(warm);

  const mouse = { x: 0, y: 0 };
  addEventListener("mousemove", (e) => { mouse.x = (e.clientX / innerWidth - .5) * 2; mouse.y = (e.clientY / innerHeight - .5) * 2; });

  let t = 0, running = true;
  const vis = new IntersectionObserver((es) => { running = es[0].isIntersecting; if (running) loop(); }, { threshold: 0 });
  vis.observe(canvas);
  resize(); addEventListener("resize", resize);

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    t += 0.006;
    core.rotation.y += 0.003; core.rotation.x = Math.sin(t * 0.4) * 0.15;
    coreWire.rotation.copy(core.rotation); coreWire.rotation.y -= 0.001;
    group.rotation.y = t * 0.12;
    nodes.forEach((n) => {
      const s = 1 + Math.sin(t * n.sp * 3 + n.ph) * 0.08;
      n.m.position.copy(n.base).multiplyScalar(1 + Math.sin(t * n.sp + n.ph) * 0.05);
      n.m.scale.setScalar(s);
      n.line.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), n.m.position]);
    });
    dust.rotation.y += 0.0004;
    camera.position.x += (mouse.x * 2.4 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.y * 1.6 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  loop();
})();
