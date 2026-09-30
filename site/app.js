const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const SRC_LABEL = { x: "X", hn: "Hacker News", rss: "RSS", lobsters: "Lobsters", github: "GitHub", reddit: "Reddit", zenn: "Zenn", web: "Web" };
const DEFAULT_CATS = { ai: "AI / LLM", web: "Web / Frontend", backend: "Backend", infra: "Infra / Cloud", mobile: "Mobile / iOS" };
const CAT_SHORT = { ai: "AI", web: "Web", backend: "Backend", infra: "Infra", mobile: "Mobile" };
const CAT_JA = { ai: "人工知能", web: "ウェブ", backend: "バックエンド", infra: "インフラ", mobile: "モバイル" };
const MAX_READ = 3000;
const state = { data: null, dates: [], cat: "all", q: "", min: 1, view: "all" };

// ---------------------------------------------------------------------------
// Per-device storage (failures are ignored so the page still renders)
// ---------------------------------------------------------------------------
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let readList = load("read", []);
let readSet = new Set(readList);
let saved = load("saved", {});

function markRead(urls) {
  let changed = false;
  for (const u of urls) {
    if (!readSet.has(u)) { readSet.add(u); readList.push(u); changed = true; }
  }
  if (!changed) return;
  if (readList.length > MAX_READ) {
    readList = readList.slice(-MAX_READ);
    readSet = new Set(readList);
  }
  save("read", readList);
}

function toggleSaved(item) {
  if (saved[item.url]) delete saved[item.url];
  else saved[item.url] = { ...item, date: item.date || state.data?.date, savedAt: Date.now() };
  save("saved", saved);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Only http(s) links reach href; anything else (javascript:, data:, …) becomes an inert "#".
function safeUrl(url) {
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#"; } catch { return "#"; }
}
function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
const pad = (n) => String(n).padStart(2, "0");
const categories = () => state.data?.categories || DEFAULT_CATS;

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00+09:00`);
  const opt = (o) => d.toLocaleDateString("en-US", { timeZone: "Asia/Tokyo", ...o });
  const wd = "日月火水木金土"[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(opt({ weekday: "short" }))];
  const [y, m, day] = iso.split("-").map(Number);
  return { ja: `${y}年${m}月${day}日（${wd}）`, en: opt({ weekday: "long", month: "long", day: "numeric", year: "numeric" }) };
}

function meter(score) {
  return `<span class="meter" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < score ? "on" : ""}"></i>`).join("")}</span>`;
}

const STAR = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5h8v13l-4-3-4 3z"/></svg>`;

function isFiltered() {
  return state.view !== "all" || state.cat !== "all" || state.q || state.min > 1;
}

function sourceItems() {
  if (state.view === "saved") return Object.values(saved).sort((a, b) => b.savedAt - a.savedAt);
  return state.data ? state.data.items : [];
}

function matches(it) {
  if (state.view === "unread" && readSet.has(it.url)) return false;
  if (state.cat !== "all" && it.category !== state.cat) return false;
  if (it.score < state.min) return false;
  if (state.q) {
    const hay = [it.title, it.original_title, it.summary, ...(it.tags || [])].join(" ").toLowerCase();
    if (!hay.includes(state.q.toLowerCase())) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Story templates
// ---------------------------------------------------------------------------
function foot(it, { showCat = true } = {}) {
  const links = [];
  if (it.post_url && it.post_url !== it.url) links.push(`<a href="${esc(safeUrl(it.post_url))}" target="_blank" rel="noopener">${it.source === "hn" || it.source === "lobsters" ? "Discussion" : "Post"} ↗</a>`);
  (it.related || []).forEach((r) => links.push(`<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">+${esc(SRC_LABEL[r.source] || r.source)}</a>`));
  const cat = categories()[it.category] || it.category;
  return `<div class="foot">
    <span class="src">${esc(SRC_LABEL[it.source] || it.source)}</span>
    ${state.view === "saved" && it.date ? `<span>${esc(it.date)}</span>` : ""}
    ${it.author ? `<span>${esc(it.author)}</span>` : ""}
    ${showCat ? `<span>${esc(cat)}</span>` : ""}
    ${it.tags?.length ? `<span class="tags">${it.tags.slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join("")}</span>` : ""}
    ${links.join("")}
    <span class="read-mark">✓ Read</span>
  </div>`;
}

function saveBtn(it) {
  const on = Boolean(saved[it.url]);
  return `<button class="save" type="button" data-save aria-pressed="${on}" aria-label="${on ? "保存を解除" : "後で読むに保存"}" title="${on ? "保存を解除" : "後で読む"}">${STAR}</button>`;
}

const num = (n) => Number(n) || 0;
const cls = (it, base) => `story ${base}${readSet.has(it.url) ? " read" : ""}${it.score >= 8 ? " hot" : ""}`;
const titleLink = (it) => `<a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.title)}</a>`;
const orig = (it) => `<p class="orig">${esc(it.original_title)} — ${esc(host(it.url))}</p>`;

function leadTpl(it) {
  return `<article class="${cls(it, "lead")} reveal" data-url="${esc(it.url)}">
    <div class="score-col">
      <div class="big-score" aria-label="重要度 ${num(it.score)}">${num(it.score)}</div>
      <div class="score-cap mono"><span>Signal ${num(it.score)}/10</span>${meter(num(it.score))}</div>
    </div>
    <div class="lead-body">
      <p class="kicker label"><span class="dot"></span>Top story · ${esc(categories()[it.category] || it.category)}</p>
      <h3>${titleLink(it)}</h3>
      ${orig(it)}
      <p class="sum">${esc(it.summary)}</p>
      ${foot(it, { showCat: false })}
    </div>
    ${saveBtn(it)}
  </article>`;
}

function topTpl(it, i) {
  return `<article class="${cls(it, "top")} reveal" style="--d:${i * 70}ms" data-url="${esc(it.url)}">
    <div class="num"><b>${num(it.score)}</b>${meter(num(it.score))}</div>
    <h3>${titleLink(it)}</h3>
    ${orig(it)}
    <p class="sum">${esc(it.summary)}</p>
    ${foot(it)}
    ${saveBtn(it)}
  </article>`;
}

function rowTpl(it, i, { showCat = false } = {}) {
  return `<article class="${cls(it, "row")} reveal" style="--d:${(i % 6) * 50}ms" data-url="${esc(it.url)}">
    <div class="idx"><b>${num(it.score)}</b></div>
    <div class="row-body">
      <h3>${titleLink(it)}</h3>
      ${orig(it)}
      <p class="sum">${esc(it.summary)}</p>
      ${foot(it, { showCat })}
    </div>
    ${saveBtn(it)}
  </article>`;
}

function sectionTpl(no, key, title, items, { showCat = false } = {}) {
  return `<section class="section" aria-labelledby="sec-${esc(key)}">
    <header class="sec-head reveal">
      <span class="sec-no">${no}</span>
      <h2 class="sec-title" id="sec-${esc(key)}">${esc(title)}${CAT_JA[key] ? `<small>${CAT_JA[key]}</small>` : ""}</h2>
      <span class="mono sec-count">${items.length} ${items.length === 1 ? "story" : "stories"}</span>
    </header>
    <div class="rows">${items.map((it, i) => rowTpl(it, i, { showCat })).join("")}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderFront(items) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const [lead, ...rest] = sorted;
  const tops = rest.filter((it) => it.score >= 7).slice(0, 3);
  const used = new Set([lead, ...tops].map((it) => it.url));
  let html = `<div class="front">${leadTpl(lead)}`;
  if (tops.length) html += `<div class="tops">${tops.map(topTpl).join("")}</div>`;
  let n = 0;
  for (const [key, title] of Object.entries(categories())) {
    const group = sorted.filter((it) => it.category === key && !used.has(it.url));
    if (group.length) html += sectionTpl(pad(++n), key, title, group);
  }
  return html + "</div>";
}

function renderList(items) {
  const title = state.view === "saved" ? "Saved" : state.view === "unread" ? "Unread" : state.q ? `“${state.q}”` : state.cat !== "all" ? categories()[state.cat] : "Filtered";
  const key = state.view === "all" && state.cat !== "all" ? state.cat : "list";
  const list = state.view === "saved" ? items : [...items].sort((a, b) => b.score - a.score);
  return `<div class="front">${sectionTpl("§", key, title, list, { showCat: state.cat === "all" })}</div>`;
}

function renderControls() {
  const all = sourceItems();
  const unread = state.data ? state.data.items.filter((it) => !readSet.has(it.url)).length : 0;
  const savedCount = Object.keys(saved).length;
  $$("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.view)));
  $$('#views [data-view="unread"]').forEach((b) => (b.innerHTML = `未読<span class="n">${unread}</span>`));
  $$('#views [data-view="saved"]').forEach((b) => (b.innerHTML = `保存済み<span class="n">${savedCount}</span>`));
  $("#unreadBadge").textContent = unread ? String(unread) : "";

  const count = (c) => all.filter((it) => c === "all" || it.category === c).length;
  const entries = [["all", "All"], ...Object.entries(categories())];
  $("#cats").innerHTML = entries
    .map(([k, label], i) => `<button class="cat" data-cat="${esc(k)}" aria-pressed="${state.cat === k}" title="${esc(label)}">${i ? `<span class="no">${pad(i)}</span>` : ""}${esc(CAT_SHORT[k] || label)}<span class="n">${count(k)}</span></button>`)
    .join("");
  $$("#signal [data-min]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.min) === state.min)));

  const saving = state.view === "saved";
  $("#date").disabled = saving;
  const idx = state.dates.indexOf(state.data?.date);
  $("#prevIssue").disabled = saving || idx < 0 || idx >= state.dates.length - 1;
  $("#nextIssue").disabled = saving || idx <= 0;
}

function renderMasthead() {
  const d = state.data;
  if (!d) return;
  const f = formatDate(d.date);
  const no = state.dates.length - state.dates.indexOf(d.date);
  $("#issue").textContent = `Vol. 1 — No. ${no}`;
  $("#dateline").textContent = f.en;
  const sources = new Set(d.items.map((it) => it.source)).size;
  $("#stats").textContent = `${d.items.length} stories · ${sources} sources`;
  $("#headline").textContent = d.headline || "";
  $("#ledeWrap").hidden = !d.headline;
  document.title = `Tech Digest — ${f.ja}`;

  const tags = [...new Set(d.items.flatMap((it) => it.tags || []))].slice(0, 24);
  $("#ticker").hidden = tags.length < 4;
  const run = tags.map((t) => `<span>${esc(t)}</span>`).join("");
  $("#tickerTrack").innerHTML = run + run;
}

function renderPaper() {
  const all = sourceItems();
  const shown = all.filter(matches);
  const content = $("#content");
  content.innerHTML = !shown.length ? "" : isFiltered() ? renderList(shown) : renderFront(shown);

  $("#empty").hidden = shown.length > 0;
  $("#emptyText").textContent = state.view === "saved" ? "保存した記事はまだありません。しおりのアイコンで、あとで読む記事を残せます。"
    : state.view === "unread" && all.length ? "すべて読みました。また明日の朝に。" : "条件に合う記事がありません。";
  $("#markAll").hidden = !isFiltered() || state.view === "saved" || !shown.some((it) => !readSet.has(it.url));
  const gen = state.view !== "saved" && state.data ? ` · Published ${state.data.generated_at.slice(11, 16)} JST` : "";
  $("#meta").textContent = `${shown.length} / ${all.length} stories${gen}`;
}

function render({ transition = false } = {}) {
  const run = () => { renderControls(); renderPaper(); };
  if (transition && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(run);
  } else run();
}

// sticky toolbar state
const toolbar = $("#toolbar");
new IntersectionObserver(([e]) => toolbar.classList.toggle("stuck", !e.isIntersecting), { rootMargin: "-1px 0px 0px 0px" })
  .observe($("#ticker"));

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function loadDate(date) {
  const res = await fetch(`data/${date}.json`);
  state.data = await res.json();
  if (state.cat !== "all" && !(state.cat in state.data.categories)) state.cat = "all";
  renderMasthead();
  render();
}

function goTo(date) {
  $("#date").value = date;
  history.replaceState(null, "", `?d=${date}`);
  loadDate(date).then(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

async function init() {
  state.cat = load("cat", "all");
  state.min = Number(load("min", 1));
  if (![1, 5, 7, 9].includes(state.min)) state.min = 1;
  state.view = load("view", "all");

  try {
    state.dates = (await (await fetch("data/index.json")).json()).dates;
  } catch {}
  if (!state.dates.length) {
    renderControls();
    $("#ledeWrap").hidden = true;
    $("#empty").hidden = false;
    $("#emptyText").textContent = "データを取得できませんでした。オフラインか、まだ最初の号が発行されていません。";
    return;
  }
  $("#date").innerHTML = state.dates.map((d) => `<option value="${esc(d)}">${esc(d.replaceAll("-", "."))}</option>`).join("");
  const initial = new URLSearchParams(location.search).get("d");
  if (initial && state.dates.includes(initial)) $("#date").value = initial;
  await loadDate($("#date").value);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
$("#date").addEventListener("change", (e) => goTo(e.target.value));
$("#prevIssue").addEventListener("click", () => goTo(state.dates[state.dates.indexOf(state.data.date) + 1]));
$("#nextIssue").addEventListener("click", () => goTo(state.dates[state.dates.indexOf(state.data.date) - 1]));

document.addEventListener("click", (e) => {
  const v = e.target.closest("[data-view]");
  if (!v) return;
  state.view = v.dataset.view;
  save("view", state.view);
  render({ transition: true });
  if (window.scrollY > $("#paper").offsetTop) $("#paper").scrollIntoView({ behavior: "smooth" });
});
$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  state.cat = b.dataset.cat;
  save("cat", state.cat);
  render({ transition: true });
});
$("#signal").addEventListener("click", (e) => {
  const b = e.target.closest("[data-min]");
  if (!b) return;
  state.min = Number(b.dataset.min);
  save("min", state.min);
  render({ transition: true });
});
let qTimer;
$("#q").addEventListener("input", (e) => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120);
});
$("#content").addEventListener("click", (e) => {
  const story = e.target.closest(".story");
  if (!story) return;
  const url = story.dataset.url;
  if (e.target.closest("[data-save]")) {
    const item = sourceItems().find((it) => it.url === url) || saved[url];
    if (item) toggleSaved(item);
    const btn = e.target.closest("[data-save]");
    const on = Boolean(saved[url]);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "保存を解除" : "後で読むに保存");
    if (state.view === "saved") render({ transition: true }); else renderControls();
    return;
  }
  if (e.target.closest("a")) {
    markRead([url]);
    story.classList.add("read");
    renderControls();
  }
});
$("#markAll").addEventListener("click", () => {
  markRead(sourceItems().filter(matches).map((it) => it.url));
  render({ transition: true });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); }
});

// ---------------------------------------------------------------------------
// PWA: service worker + push notifications
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(b64) {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Prefetched at startup so the tap handler reaches requestPermission() without a network wait.
const pushConfig = fetch("push-config.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);

function showPush(html) {
  $("#pushBody").innerHTML = html;
  $("#pushDlg").showModal();
}

async function enablePush() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return showPush(isIOS && !standalone
      ? "<p>iPhone では、共有メニューの「ホーム画面に追加」でアプリとして追加し、そのアプリから開いて設定します（iOS 16.4 以降）。</p>"
      : "<p>このブラウザはプッシュ通知に対応していません。</p>");
  }
  const config = await pushConfig;
  if (!config?.vapidPublicKey) {
    return showPush("<p>通知の送信側がまだ設定されていません。README の「通知の設定」を実行してください。</p>");
  }
  // Safari requires the permission prompt to start within the tap handler, so nothing slow may run before it.
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return showPush("<p>通知が許可されませんでした。端末の設定から許可できます。</p>");

  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) });
  showPush(`
    <p>この端末の通知登録情報です。GitHub の Secret <code>PUSH_SUBSCRIPTIONS</code> に JSON 配列として登録すると、毎朝の発行時に通知が届きます。</p>
    <p class="note">複数端末で受け取る場合は <code>[{...}, {...}]</code> のように並べます。登録情報は他人に渡さないでください。</p>
    <textarea id="subJson" readonly rows="6">${esc(`[${JSON.stringify(sub)}]`)}</textarea>
    <div><button id="copySub" class="btn ghost" type="button">コピー</button></div>`);
  $("#copySub").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#subJson").value); $("#copySub").textContent = "コピーしました"; }
    catch { $("#subJson").select(); }
  });
}
for (const id of ["#pushBtn", "#pushBtnTab"]) {
  $(id).addEventListener("click", () => enablePush().catch((e) => showPush(`<p>通知の設定に失敗しました: ${esc(e.message)}</p>`)));
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
