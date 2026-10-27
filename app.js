// Mijn Recepten — geen build-stap, gewoon statische bestanden.
// data/recipes.json      → alle recepten
// data/voorraadkast.json → ingrediënten die je altijd in huis hebt (tellen nergens mee)
// Duimpjes en "gekookt op" staan lokaal op je telefoon (localStorage).

const $ = (s) => document.querySelector(s);
const OPSLAG = "recepten-v1";

let recepten = [];
let voorraad = new Set();
let staat = laad();
let actieveTags = new Set();
let suggestieRonde = 0;
let restjes = []; // wat je wilt opmaken (niet bewaard)

// ---------- opslag ----------
function laad() {
  try {
    const s = JSON.parse(localStorage.getItem(OPSLAG));
    if (s) return { oordeel: s.oordeel || {}, gekookt: s.gekookt || {} };
  } catch (e) {}
  return { oordeel: {}, gekookt: {} };
}
function bewaar() {
  try { localStorage.setItem(OPSLAG, JSON.stringify(staat)); } catch (e) {}
}

// ---------- helpers ----------
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").trim();
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vandaag = () => new Date().toISOString().slice(0, 10);
const dagenGeleden = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const isVoorraad = (naam) => voorraad.has(norm(naam));
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; }

// Simpele Nederlandse 'stam': tomaat → tomat (matcht cherrytomaten), eieren → eier, gamba's → gamba
function stam(t) {
  let s = norm(t).replace(/(en|s)$/, "");
  s = s.replace(/([aeou])\1([^aeiou])$/, "$1$2");
  return s;
}
// Komt restje r voor in ingrediëntnaam n?
function matcht(r, n) {
  const st = stam(r), nn = norm(n);
  if (st.length < 3) return nn.split(/[\s-]+/).some((w) => w.startsWith(st));
  return nn.includes(st) || stam(n) === st;
}

// ---------- recepten-tab ----------
function gefilterd() {
  const q = norm($("#zoek").value);
  const maxTijd = +$("#maxTijd").value || Infinity;
  return recepten.filter((r) => {
    if (r.tijd && r.tijd > maxTijd) return false;
    if (actieveTags.size && ![...actieveTags].every((t) => (r.tags || []).includes(t))) return false;
    if (q) {
      const tekst = norm([r.titel, ...(r.tags || []), ...r.ingredienten.map((i) => i.naam)].join(" "));
      if (!q.split(/\s+/).every((w) => tekst.includes(w))) return false;
    }
    return true;
  });
}

function suggesties(lijst) {
  return lijst
    .filter((r) => staat.oordeel[r.id] !== "neer")
    .map((r) => {
      const laatst = staat.gekookt[r.id]?.at(-1);
      const dagen = laatst ? dagenGeleden(laatst) : null;
      let score = 0;
      const redenen = [];
      if (staat.oordeel[r.id] === "op") { score += 3; redenen.push("👍 favoriet"); }
      if (dagen === null) { score += 2.5; redenen.push("nog nooit gemaakt"); }
      else if (dagen < 4) score -= 6;
      else { score += Math.min(dagen, 60) / 10; if (dagen >= 14) redenen.push(`${Math.floor(dagen / 7)} weken niet gegeten`); }
      score += hash(vandaag() + suggestieRonde + r.id) * 2.5;
      return { r, score, redenen };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function kaart(r, extra = "") {
  const oordeel = staat.oordeel[r.id] === "op" ? " 👍" : staat.oordeel[r.id] === "neer" ? " 👎" : "";
  return `<li><button class="kaart" data-id="${esc(r.id)}">
    <strong>${esc(r.titel)}${oordeel}</strong>
    <span class="meta">${r.tijd ? `⏱ ${r.tijd} min` : ""}${(r.tags || []).map((t) => ` · ${esc(t)}`).join("")}</span>
    ${extra}
  </button></li>`;
}

function toonRecepten() {
  const lijst = gefilterd().sort((a, b) => a.titel.localeCompare(b.titel));
  const sug = lijst.length > 3 ? suggesties(lijst) : [];
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

// ---------- opmaken-tab ----------
function ingredientNamen() {
  const m = new Map();
  for (const r of recepten) for (const i of r.ingredienten) if (!isVoorraad(i.naam)) {
    const k = norm(i.naam); m.set(k, { naam: i.naam, n: (m.get(k)?.n || 0) + 1 });
  }
  return [...m.values()];
}

function toonDropdown() {
  const q = $("#restInput").value.trim();
  const dd = $("#dropdown");
  if (!q) { dd.hidden = true; return; }
  const al = new Set(restjes.map(norm));
  const nq = norm(q);
  const opties = ingredientNamen()
    .filter((o) => !al.has(norm(o.naam)) && (norm(o.naam).includes(nq) || matcht(q, o.naam)))
    .sort((a, b) => norm(b.naam).startsWith(nq) - norm(a.naam).startsWith(nq) || b.n - a.n || a.naam.localeCompare(b.naam))
    .slice(0, 8);
  const exact = opties.some((o) => norm(o.naam) === nq);
  const breed = ingredientNamen().filter((o) => matcht(q, o.naam)).length;
  const vrij = exact || al.has(nq) || isVoorraad(q) ? "" : breed > 1
    ? `<li><button data-rest="${esc(q)}">Alles met “${esc(q)}” <span class="muted">${breed} soorten</span></button></li>`
    : `<li><button data-rest="${esc(q)}">“${esc(q)}” toevoegen</button></li>`;
  const kast = isVoorraad(q) ? `<li class="muted kastmelding">${esc(q)} staat in je voorraadkast, telt niet mee</li>` : "";
  dd.innerHTML = kast + (breed > 1 ? vrij : "") +
    opties.map((o) => `<li><button data-rest="${esc(o.naam)}">${esc(o.naam)} <span class="muted">${o.n}×</span></button></li>`).join("") +
    (breed > 1 ? "" : vrij);
  if (!dd.innerHTML) { dd.hidden = true; return; }
  dd.hidden = false;
}

function voegRestToe(naam) {
  naam = naam.trim();
  if (naam && !restjes.some((r) => norm(r) === norm(naam))) restjes.push(naam);
  $("#restInput").value = "";
  $("#dropdown").hidden = true;
  toonOpmaken();
}

function toonOpmaken() {
  $("#restChips").innerHTML = restjes.map((r) =>
    `<button class="chip aan" data-weg="${esc(r)}">${esc(r)} ✕</button>`).join("");
  if (!restjes.length) { $("#restAantal").textContent = ""; $("#restLijst").innerHTML = ""; return; }

  const res = recepten.map((r) => {
    const gebruikt = [], nodig = [];
    for (const i of r.ingredienten) {
      if (isVoorraad(i.naam)) continue;
      const hit = restjes.some((x) => matcht(x, i.naam));
      if (hit) gebruikt.push(i.naam); else if (!i.optioneel) nodig.push(i.naam);
    }
    // per restje tellen (niet per ingrediënt), zodat 'tomaat' niet dubbel telt
    const score = restjes.filter((x) => r.ingredienten.some((i) => !isVoorraad(i.naam) && matcht(x, i.naam))).length;
    return { r, gebruikt, nodig, score };
  }).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.nodig.length - b.nodig.length || a.r.titel.localeCompare(b.r.titel));

  $("#restAantal").textContent = res.length ? `${res.length} recepten gebruiken iets hiervan` : "";
  $("#restLijst").innerHTML = res.map((x) => kaart(x.r,
    `<span class="ok">gebruikt: ${esc(x.gebruikt.join(", "))}</span>` +
    (x.nodig.length ? `<span class="mist">nog nodig: ${esc(x.nodig.join(", "))}</span>` : `<span class="ok">✓ verder niks nodig</span>`)
  )).join("") || `<li class="leeg">Geen recepten met deze ingrediënten.</li>`;
}

// ---------- detail ----------
function toonDetail(id) {
  const r = recepten.find((x) => x.id === id);
  if (!r) return;
  const gek = staat.gekookt[r.id] || [];
  const o = staat.oordeel[r.id];
  $("#detailInhoud").innerHTML = `
    <h2>${esc(r.titel)}</h2>
    <p class="meta">${r.tijd ? `⏱ ${r.tijd} min · ` : ""}${r.porties ? `${r.porties} porties` : ""}${(r.tags || []).length ? " · " + r.tags.map(esc).join(", ") : ""}</p>
    ${r.bron ? `<p class="meta">Bron: ${/^https?:/.test(r.bron) ? `<a href="${esc(r.bron)}" target="_blank" rel="noopener">${esc(new URL(r.bron).hostname)}</a>` : esc(r.bron)}</p>` : ""}
    <div class="acties">
      <button data-oordeel="op" class="${o === "op" ? "aan" : ""}">👍</button>
      <button data-oordeel="neer" class="${o === "neer" ? "aan" : ""}">👎</button>
      <button id="gekookt" class="hoofd">Vandaag gekookt</button>
    </div>
    <p class="meta">${gek.length ? `${gek.length}× gemaakt, laatst ${dagenGeleden(gek.at(-1)) === 0 ? "vandaag" : `${dagenGeleden(gek.at(-1))} dagen geleden`}` : "Nog nooit gemaakt"}</p>
    <h3>Ingrediënten</h3>
    <ul class="ingr">${r.ingredienten.map((i) => {
      const k = isVoorraad(i.naam) ? "kast" : restjes.some((x) => matcht(x, i.naam)) ? "heb" : "";
      return `<li class="${k}"><span>${esc(i.naam)}${i.optioneel ? " <em>(optioneel)</em>" : ""}</span><span>${esc(i.hoeveelheid || "")}</span></li>`;
    }).join("")}</ul>
    <h3>Bereiding</h3>
    <ol class="stappen">${r.bereiding.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    ${r.notities ? `<h3>Notities</h3><p>${esc(r.notities)}</p>` : ""}`;
  $("#detail").hidden = false;
  $("#detail").scrollTop = 0;
  $("#detail").dataset.id = id;
}

function sluitDetail() {
  $("#detail").hidden = true;
  if (!$("#view-opmaken").hidden) toonOpmaken(); else toonRecepten();
}

function wissel(view) {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("actief", b.dataset.view === view));
  $("#pageTitle").textContent = view === "opmaken" ? "Wat moet op?" : "Recepten";
  if (view === "opmaken") toonOpmaken(); else toonRecepten();
  window.scrollTo(0, 0);
}

// ---------- events ----------
["#zoek", "#maxTijd"].forEach((s) => $(s).addEventListener("input", toonRecepten));
$("#restInput").addEventListener("input", toonDropdown);
$("#restInput").addEventListener("focus", toonDropdown);
$("#restInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); const eerste = $("#dropdown [data-rest]"); voegRestToe(eerste ? eerste.dataset.rest : e.target.value); }
});

document.addEventListener("click", (e) => {
  const rest = e.target.closest("[data-rest]"); if (rest) return voegRestToe(rest.dataset.rest);
  if (!e.target.closest(".zoekvak")) $("#dropdown").hidden = true;
  const weg = e.target.closest("[data-weg]");
  if (weg) { restjes = restjes.filter((r) => r !== weg.dataset.weg); return toonOpmaken(); }
  const k = e.target.closest(".kaart"); if (k) return toonDetail(k.dataset.id);
  const c = e.target.closest(".chip[data-tag]");
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

// ---------- start ----------
Promise.all([
  fetch("data/recipes.json", { cache: "no-cache" }).then((r) => r.json()),
  fetch("data/voorraadkast.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []),
]).then(([data, kast]) => {
  recepten = data;
  voorraad = new Set(kast.map(norm));
  toonTags(); toonRecepten();
}).catch(() => { $("#lijst").innerHTML = `<li class="leeg">Kon recepten niet laden.</li>`; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
