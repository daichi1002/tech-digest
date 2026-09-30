const $ = (s) => document.querySelector(s);
const SRC_LABEL = { x: "X", hn: "HN", rss: "RSS", lobsters: "Lobsters", github: "GitHub", reddit: "Reddit", zenn: "Zenn", web: "Web" };
const state = { data: null, cat: "all", q: "", min: 1 };

function load(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function matches(it) {
  if (state.cat !== "all" && it.category !== state.cat) return false;
  if (it.score < state.min) return false;
  if (state.q) {
    const hay = [it.title, it.original_title, it.summary, ...(it.tags || [])].join(" ").toLowerCase();
    if (!hay.includes(state.q.toLowerCase())) return false;
  }
  return true;
}

function renderChips() {
  const { categories, items } = state.data;
  const count = (c) => items.filter((it) => c === "all" || it.category === c).length;
  const entries = [["all", "すべて"], ...Object.entries(categories)];
  $("#cats").innerHTML = entries
    .map(([k, label]) => `<button class="chip" data-cat="${k}" aria-pressed="${state.cat === k}">${esc(label)}<span class="n">${count(k)}</span></button>`)
    .join("");
}

function card(it) {
  const level = it.score >= 8 ? "hi" : it.score >= 5 ? "mid" : "lo";
  const cat = state.data.categories[it.category] || it.category;
  const links = [];
  if (it.post_url && it.post_url !== it.url) links.push(`<a href="${esc(it.post_url)}" target="_blank" rel="noopener">${it.source === "hn" ? "comments" : "post"}</a>`);
  (it.related || []).forEach((r) => links.push(`<a href="${esc(r.url)}" target="_blank" rel="noopener">+${esc(SRC_LABEL[r.source] || r.source)}</a>`));
  return `<li class="card">
    <div class="badge ${level}" title="重要度">${it.score}</div>
    <div>
      <h2><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a></h2>
      <p class="orig">${esc(it.original_title)} — ${esc(host(it.url))}</p>
      <p class="sum">${esc(it.summary)}</p>
      <div class="foot">
        <span class="src ${esc(it.source)}">${esc(SRC_LABEL[it.source] || it.source)}</span>
        ${it.author ? `<span>${esc(it.author)}</span>` : ""}
        <span>${esc(cat)}</span>
        ${(it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        ${links.join("")}
      </div>
    </div>
  </li>`;
}

function renderList() {
  const shown = state.data.items.filter(matches);
  $("#list").innerHTML = shown.map(card).join("");
  $("#empty").hidden = shown.length > 0;
  $("#meta").textContent = `${shown.length} / ${state.data.items.length} 件 · 生成 ${state.data.generated_at.replace("T", " ")}`;
}

async function loadDate(date) {
  const res = await fetch(`data/${date}.json`, { cache: "no-cache" });
  state.data = await res.json();
  $("#headline").textContent = state.data.headline || "";
  if (state.cat !== "all" && !(state.cat in state.data.categories)) state.cat = "all";
  renderChips();
  renderList();
}

async function init() {
  state.cat = load("cat", "all");
  state.min = Number(load("min", 1));
  $("#min").value = state.min;
  $("#minOut").textContent = state.min;

  let dates = [];
  try {
    dates = (await (await fetch("data/index.json", { cache: "no-cache" })).json()).dates;
  } catch {}
  if (!dates.length) {
    $("#empty").hidden = false;
    $("#empty").textContent = "まだデータなし。collector を実行してください。";
    return;
  }
  $("#date").innerHTML = dates.map((d) => `<option>${d}</option>`).join("");
  const initial = new URLSearchParams(location.search).get("d");
  if (initial && dates.includes(initial)) $("#date").value = initial;
  await loadDate($("#date").value);
}

$("#date").addEventListener("change", (e) => {
  history.replaceState(null, "", `?d=${e.target.value}`);
  loadDate(e.target.value);
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

init();
