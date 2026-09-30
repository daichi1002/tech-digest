const $ = (s) => document.querySelector(s);
const SRC_LABEL = { x: "X", hn: "HN", rss: "RSS", lobsters: "Lobsters", github: "GitHub", reddit: "Reddit", zenn: "Zenn", web: "Web" };
const MAX_READ = 3000;
const state = { data: null, cat: "all", q: "", min: 1, view: "all" };

// --- per-device storage (localStorage; failures are ignored so the page still works) ---
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let readList = load("read", []);            // urls, oldest first
let readSet = new Set(readList);
let saved = load("saved", {});              // url -> item (+ date, savedAt)

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

// --- rendering ---
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
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

function categories() {
  return state.data?.categories || { ai: "AI / LLM", web: "Web / Frontend", backend: "Backend", infra: "Infra / Cloud", mobile: "Mobile / iOS" };
}

function renderViews() {
  document.querySelectorAll("#views [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.view)));
  const unread = state.data ? state.data.items.filter((it) => !readSet.has(it.url)).length : 0;
  $('#views [data-view="unread"]').textContent = `未読 ${unread}`;
  $('#views [data-view="saved"]').textContent = `保存済み ${Object.keys(saved).length}`;
  $("#date").disabled = state.view === "saved";
  $("#headline").hidden = state.view === "saved";
}

function renderChips() {
  const items = sourceItems();
  const count = (c) => items.filter((it) => c === "all" || it.category === c).length;
  const entries = [["all", "すべて"], ...Object.entries(categories())];
  $("#cats").innerHTML = entries
    .map(([k, label]) => `<button class="chip" data-cat="${k}" aria-pressed="${state.cat === k}">${esc(label)}<span class="n">${count(k)}</span></button>`)
    .join("");
}

function card(it) {
  const level = it.score >= 8 ? "hi" : it.score >= 5 ? "mid" : "lo";
  const cat = categories()[it.category] || it.category;
  const isSaved = Boolean(saved[it.url]);
  const links = [];
  if (it.post_url && it.post_url !== it.url) links.push(`<a href="${esc(it.post_url)}" target="_blank" rel="noopener">${it.source === "hn" ? "comments" : "post"}</a>`);
  (it.related || []).forEach((r) => links.push(`<a href="${esc(r.url)}" target="_blank" rel="noopener">+${esc(SRC_LABEL[r.source] || r.source)}</a>`));
  return `<li class="card${readSet.has(it.url) ? " read" : ""}" data-url="${esc(it.url)}">
    <div class="badge ${level}" title="重要度">${it.score}</div>
    <div class="body">
      <h2><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h2>
      <p class="orig">${esc(it.original_title)} — ${esc(host(it.url))}</p>
      <p class="sum">${esc(it.summary)}</p>
      <div class="foot">
        <span class="src ${esc(it.source)}">${esc(SRC_LABEL[it.source] || it.source)}</span>
        ${state.view === "saved" && it.date ? `<span>${esc(it.date)}</span>` : ""}
        ${it.author ? `<span>${esc(it.author)}</span>` : ""}
        <span>${esc(cat)}</span>
        ${(it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        ${links.join("")}
      </div>
    </div>
    <button class="star" type="button" data-save aria-pressed="${isSaved}" aria-label="${isSaved ? "保存を解除" : "保存"}" title="${isSaved ? "保存を解除" : "後で読む"}">${isSaved ? "★" : "☆"}</button>
  </li>`;
}

function renderList() {
  const all = sourceItems();
  const shown = all.filter(matches);
  $("#list").innerHTML = shown.map(card).join("");
  $("#empty").hidden = shown.length > 0;
  $("#empty").textContent = state.view === "saved" ? "保存した記事はまだない" : state.view === "unread" ? "未読なし" : "該当なし";
  $("#markAll").hidden = state.view === "saved" || !shown.some((it) => !readSet.has(it.url));
  const gen = state.view !== "saved" && state.data ? ` · 生成 ${state.data.generated_at.replace("T", " ")}` : "";
  $("#meta").textContent = `${shown.length} / ${all.length} 件${gen}`;
}

function render() {
  renderViews();
  renderChips();
  renderList();
}

// --- data loading ---
async function loadDate(date) {
  const res = await fetch(`data/${date}.json`);
  state.data = await res.json();
  $("#headline").textContent = state.data.headline || "";
  if (state.cat !== "all" && !(state.cat in state.data.categories)) state.cat = "all";
  render();
}

async function init() {
  state.cat = load("cat", "all");
  state.min = Number(load("min", 1));
  state.view = load("view", "all");
  $("#min").value = state.min;
  $("#minOut").textContent = state.min;

  let dates = [];
  try {
    dates = (await (await fetch("data/index.json")).json()).dates;
  } catch {}
  if (!dates.length) {
    renderViews();
    $("#empty").hidden = false;
    $("#empty").textContent = "データを取得できない（オフラインで未取得、またはまだ生成されていない）";
    return;
  }
  $("#date").innerHTML = dates.map((d) => `<option>${d}</option>`).join("");
  const initial = new URLSearchParams(location.search).get("d");
  if (initial && dates.includes(initial)) $("#date").value = initial;
  await loadDate($("#date").value);
}

// --- events ---
$("#date").addEventListener("change", (e) => {
  history.replaceState(null, "", `?d=${e.target.value}`);
  loadDate(e.target.value);
});
$("#views").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  state.view = b.dataset.view;
  save("view", state.view);
  render();
});
$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  state.cat = b.dataset.cat;
  save("cat", state.cat);
  renderChips();
  renderList();
});
$("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderList(); });
$("#min").addEventListener("input", (e) => {
  state.min = Number(e.target.value);
  $("#minOut").textContent = state.min;
  save("min", state.min);
  renderList();
});
$("#list").addEventListener("click", (e) => {
  const li = e.target.closest(".card");
  if (!li) return;
  const url = li.dataset.url;
  if (e.target.closest("[data-save]")) {
    const item = sourceItems().find((it) => it.url === url) || saved[url];
    if (item) toggleSaved(item);
    render();
    return;
  }
  if (e.target.closest("a")) {
    markRead([url]);
    li.classList.add("read");
    renderViews();
  }
});
$("#markAll").addEventListener("click", () => {
  markRead(sourceItems().filter(matches).map((it) => it.url));
  render();
});

// --- PWA: service worker + push notifications ---
function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
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
      ? "<p>iPhone では、共有メニューの「ホーム画面に追加」でアプリとして追加し、そのアプリから開いて設定する（iOS 16.4 以降）。</p>"
      : "<p>このブラウザはプッシュ通知に対応していない。</p>");
  }
  const config = await pushConfig;
  if (!config?.vapidPublicKey) {
    return showPush("<p>通知の送信側がまだ設定されていない。README の「通知の設定」を実行する。</p>");
  }
  // Safari requires the permission prompt to start within the tap handler, so nothing slow may run before it.
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return showPush("<p>通知が許可されなかった。端末の設定から許可できる。</p>");

  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) });
  const json = JSON.stringify(sub);
  showPush(`
    <p>この端末の通知登録情報。GitHub の Secret <code>PUSH_SUBSCRIPTIONS</code> に JSON 配列として登録すると、毎朝の更新時に通知が届く。</p>
    <p class="note">複数端末で受け取る場合は <code>[{...}, {...}]</code> のように並べる。登録情報は他人に渡さない。</p>
    <textarea id="subJson" readonly rows="6">${esc(`[${json}]`)}</textarea>
    <button id="copySub" class="chip" type="button">コピー</button>`);
  $("#copySub").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#subJson").value); $("#copySub").textContent = "コピーした"; }
    catch { $("#subJson").select(); }
  });
}
$("#pushBtn").addEventListener("click", () => enablePush().catch((e) => showPush(`<p>通知の設定に失敗: ${esc(e.message)}</p>`)));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
