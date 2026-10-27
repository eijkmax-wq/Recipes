// Mijn Recepten — geen build-stap, gewoon statische bestanden.
// Recepten staan in data/recipes.json. Persoonlijke dingen (voorraad, duimpjes,
// wanneer gekookt) worden lokaal op je telefoon bewaard (localStorage).

const $ = (s) => document.querySelector(s);
const OPSLAG = "recepten-v1";

let recepten = [];
let staat = laad();
let actieveTags = new Set();
let suggestieRonde = 0;

// ---------- opslag ----------
function laad() {
  try {
    const s = JSON.parse(localStorage.getItem(OPSLAG));
    if (s) return { thuis: [], extra: [], oordeel: {}, gekookt: {}, ...s };
  } catch (e) {}
  return { thuis: [], extra: [], oordeel: {}, gekookt: {} };
}
function bewaar() {
  try { localStorage.setItem(OPSLAG, JSON.stringify(staat)); } catch (e) {}
}

// ---------- helpers ----------
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vandaag = () => new Date().toISOString().slice(0, 10);
const dagenGeleden = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

function heb(naam) {
  const n = norm(naam);
  return staat.thuis.some((t) => {
    const h = norm(t);
    return h === n || n.includes(h) || h.includes(n);
  });
}
// Ingrediënten die tellen voor "wat heb ik thuis" (geen basis/optioneel)
const nodig = (r) => r.ingredienten.filter((i) => !i.basis && !i.optioneel);
const mist = (r) => nodig(r).filter((i) => !heb(i.naam));

// Kleine deterministische 'random' per dag, zodat suggesties niet bij elke klik verspringen
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; }

// ---------- filters ----------
function gefilterd() {
  const q = norm($("#zoek").value);
  const maxTijd = +$("#maxTijd").value || Infinity;
  const thuisMax = $("#thuisFilter").value;
  return recepten.filter((r) => {
    if (r.tijd && r.tijd > maxTijd) return false;
    if (actieveTags.size && ![...actieveTags].every((t) => (r.tags || []).includes(t))) return false;
    if (thuisMax !== "" && mist(r).length > +thuisMax) return false;
    if (q) {
      const tekst = norm([r.titel, ...(r.tags || []), ...r.ingredienten.map((i) => i.naam)].join(" "));
      if (!q.split(/\s+/).every((w) => tekst.includes(w))) return false;
    }
    return true;
  });
}

// ---------- slimme suggesties ----------
function suggesties(lijst) {
  const metThuis = staat.thuis.length > 0;
  return lijst
    .filter((r) => staat.oordeel[r.id] !== "neer")
    .map((r) => {
      const laatst = staat.gekookt[r.id]?.at(-1);
      const dagen = laatst ? dagenGeleden(laatst) : null;
      const m = mist(r).length;
      let score = 0;
      const redenen = [];
      if (staat.oordeel[r.id] === "op") { score += 3; redenen.push("👍 favoriet"); }
      if (dagen === null) { score += 2.5; redenen.push("nog nooit gemaakt"); }
      else if (dagen < 4) score -= 6;
      else { score += Math.min(dagen, 60) / 10; if (dagen >= 14) redenen.push(`${Math.floor(dagen / 7)} weken niet gegeten`); }
      if (metThuis) {
        score -= m * 1.5;
        if (m === 0) redenen.push("alles in huis");
      }
      score += hash(vandaag() + suggestieRonde + r.id) * 2.5;
      return { r, score, redenen };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ---------- weergave ----------
function kaart(r, extra = "") {
  const m = mist(r);
  const ruimte = staat.thuis.length
    ? m.length === 0 ? `<span class="ok">✓ alles in huis</span>` : `<span class="mist">mist ${m.length}: ${esc(m.slice(0, 3).map((i) => i.naam).join(", "))}${m.length > 3 ? "…" : ""}</span>`
    : "";
  const oordeel = staat.oordeel[r.id] === "op" ? " 👍" : staat.oordeel[r.id] === "neer" ? " 👎" : "";
  return `<li><button class="kaart" data-id="${esc(r.id)}">
    <strong>${esc(r.titel)}${oordeel}</strong>
    <span class="meta">${r.tijd ? `⏱ ${r.tijd} min` : ""}${(r.tags || []).map((t) => ` · ${esc(t)}`).join("")}</span>
    ${extra}${ruimte}
  </button></li>`;
}

function toonRecepten() {
  const lijst = gefilterd();
  if (staat.thuis.length) lijst.sort((a, b) => mist(a).length - mist(b).length || a.titel.localeCompare(b.titel));
  else lijst.sort((a, b) => a.titel.localeCompare(b.titel));

  const sug = suggesties(lijst);
  $("#suggesties").innerHTML = sug.length
    ? `<div class="sugkop"><h2>Vandaag voorgesteld</h2><button id="anders" class="linkknop">↻ andere</button></div>
       <ul class="kaarten sug">${sug.map((s) => kaart(s.r, s.redenen.length ? `<span class="reden">${esc(s.redenen.join(" · "))}</span>` : "")).join("")}</ul>`
    : "";

  $("#aantal").textContent = `${lijst.length} van ${recepten.length} recepten`;
  $("#lijst").innerHTML = lijst.map((r) => kaart(r)).join("") ||
    `<li class="leeg">Geen recepten gevonden met deze filters.</li>`;
}

function toonTags() {
  const tags = [...new Set(recepten.flatMap((r) => r.tags || []))].sort();
  $("#tagChips").innerHTML = tags.map((t) =>
    `<button class="chip${actieveTags.has(t) ? " aan" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
}

function alleIngredienten() {
  const set = new Map();
  for (const r of recepten) for (const i of r.ingredienten) if (!i.basis) set.set(norm(i.naam), i.naam);
  for (const e of staat.extra) set.set(norm(e), e);
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

function toonThuis() {
  const alles = alleIngredienten();
  $("#alleIngredienten").innerHTML = alles.map((n) => `<option value="${esc(n)}">`).join("");
  const aan = new Set(staat.thuis.map(norm));
  $("#thuisLijst").innerHTML = `<p class="muted">${staat.thuis.length} aangevinkt</p>` +
    alles.map((n) => `<label class="vink"><input type="checkbox" data-naam="${esc(n)}" ${aan.has(norm(n)) ? "checked" : ""}> ${esc(n)}</label>`).join("");
}

function toonDetail(id) {
  const r = recepten.find((x) => x.id === id);
  if (!r) return;
  const gek = staat.gekookt[r.id] || [];
  const o = staat.oordeel[r.id];
  $("#detailInhoud").innerHTML = `
    <h2>${esc(r.titel)}</h2>
    <p class="meta">${r.tijd ? `⏱ ${r.tijd} min · ` : ""}${r.porties ? `${r.porties} porties · ` : ""}${(r.tags || []).map(esc).join(", ")}</p>
    ${r.bron ? `<p class="meta">Bron: ${/^https?:/.test(r.bron) ? `<a href="${esc(r.bron)}" target="_blank" rel="noopener">${esc(new URL(r.bron).hostname)}</a>` : esc(r.bron)}</p>` : ""}
    <div class="acties">
      <button data-oordeel="op" class="${o === "op" ? "aan" : ""}">👍</button>
      <button data-oordeel="neer" class="${o === "neer" ? "aan" : ""}">👎</button>
      <button id="gekookt" class="hoofd">Vandaag gekookt</button>
    </div>
    <p class="meta">${gek.length ? `${gek.length}× gemaakt, laatst ${dagenGeleden(gek.at(-1)) === 0 ? "vandaag" : `${dagenGeleden(gek.at(-1))} dagen geleden`}` : "Nog nooit gemaakt"}</p>
    <h3>Ingrediënten</h3>
    <ul class="ingr">${r.ingredienten.map((i) => {
      const k = i.basis ? "" : heb(i.naam) ? "heb" : staat.thuis.length && !i.optioneel ? "niet" : "";
      return `<li class="${k}"><span>${esc(i.naam)}${i.optioneel ? " <em>(optioneel)</em>" : ""}</span><span>${esc(i.hoeveelheid || "")}</span></li>`;
    }).join("")}</ul>
    <h3>Bereiding</h3>
    <ol class="stappen">${r.bereiding.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    ${r.notities ? `<h3>Notities</h3><p>${esc(r.notities)}</p>` : ""}`;
  $("#detail").hidden = false;
  $("#detail").scrollTop = 0;
  $("#detail").dataset.id = id;
}

function sluitDetail() { $("#detail").hidden = true; toonRecepten(); }

function wissel(view) {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("actief", b.dataset.view === view));
  $("#pageTitle").textContent = view === "thuis" ? "Wat heb ik thuis?" : "Recepten";
  if (view === "thuis") toonThuis(); else toonRecepten();
  window.scrollTo(0, 0);
}

// ---------- events ----------
["#zoek", "#maxTijd", "#thuisFilter"].forEach((s) => $(s).addEventListener("input", toonRecepten));

document.addEventListener("click", (e) => {
  const k = e.target.closest(".kaart"); if (k) return toonDetail(k.dataset.id);
  const c = e.target.closest(".chip");
  if (c) { const t = c.dataset.tag; actieveTags.has(t) ? actieveTags.delete(t) : actieveTags.add(t); toonTags(); return toonRecepten(); }
  if (e.target.closest("#anders")) { suggestieRonde++; return toonRecepten(); }
  const tab = e.target.closest(".tabs button"); if (tab) { $("#detail").hidden = true; return wissel(tab.dataset.view); }
  const oo = e.target.closest("[data-oordeel]");
  if (oo) {
    const id = $("#detail").dataset.id;
    staat.oordeel[id] = staat.oordeel[id] === oo.dataset.oordeel ? undefined : oo.dataset.oordeel;
    bewaar(); return toonDetail(id);
  }
  if (e.target.closest("#gekookt")) {
    const id = $("#detail").dataset.id;
    (staat.gekookt[id] ||= []);
    if (staat.gekookt[id].at(-1) !== vandaag()) staat.gekookt[id].push(vandaag());
    bewaar(); return toonDetail(id);
  }
});

$("#terug").addEventListener("click", sluitDetail);

$("#thuisLijst").addEventListener("change", (e) => {
  const n = e.target.dataset.naam; if (!n) return;
  staat.thuis = staat.thuis.filter((t) => norm(t) !== norm(n));
  if (e.target.checked) staat.thuis.push(n);
  bewaar(); $("#thuisLijst p").textContent = `${staat.thuis.length} aangevinkt`;
});

$("#thuisForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#thuisInput").value.trim(); if (!v) return;
  if (!alleIngredienten().some((n) => norm(n) === norm(v))) staat.extra.push(v);
  if (!staat.thuis.some((t) => norm(t) === norm(v))) staat.thuis.push(v);
  $("#thuisInput").value = ""; bewaar(); toonThuis();
});

$("#thuisLeeg").addEventListener("click", () => { staat.thuis = []; bewaar(); toonThuis(); });

// ---------- start ----------
fetch("data/recipes.json", { cache: "no-cache" })
  .then((r) => r.json())
  .then((data) => { recepten = data; toonTags(); toonRecepten(); })
  .catch(() => { $("#lijst").innerHTML = `<li class="leeg">Kon recepten niet laden.</li>`; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
