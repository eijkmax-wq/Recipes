// Mijn Recepten — geen build-stap, gewoon statische bestanden.
// data/recipes.json      → alle recepten (met verborgen 'kenmerken' voor de Kiezen-tab)
// data/voorraadkast.json → ingrediënten die je altijd in huis hebt (tellen nergens mee)
// De app bewaart niets op je telefoon: restjes en swipes gelden alleen voor dat moment.

const $ = (s) => document.querySelector(s);

let recepten = [];
let voorraad = new Set();
let actieveTags = new Set();   // filters op de recepten-tab
let kiesTags = new Set();      // filters op de kiezen-tab
let restjes = [];              // wat je wilt opmaken
let swipe = null;              // { kaarten, i, ja, nee, aantal }

// ---------- helpers ----------
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").trim();
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isVoorraad = (naam) => voorraad.has(norm(naam));
const alleTags = () => [...new Set(recepten.flatMap((r) => r.tags || []))].sort();
const heeftTags = (r, set) => [...set].every((t) => (r.tags || []).includes(t));
const kernIngredienten = (r) => r.ingredienten.filter((i) => !isVoorraad(i.naam) && !i.optioneel).map((i) => i.naam);

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

function kaart(r, extra = "") {
  return `<li><button class="kaart" data-id="${esc(r.id)}">
    <strong>${esc(r.titel)}</strong>
    <span class="meta">${r.tijd ? `⏱ ${r.tijd} min` : ""}${(r.tags || []).map((t) => ` · ${esc(t)}`).join("")}</span>
    ${extra}
  </button></li>`;
}

function chips(set) {
  return alleTags().map((t) => `<button class="chip${set.has(t) ? " aan" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
}

// ---------- recepten-tab ----------
function gefilterd() {
  const q = norm($("#zoek").value);
  const maxTijd = +$("#maxTijd").value || Infinity;
  return recepten.filter((r) => {
    if (r.tijd && r.tijd > maxTijd) return false;
    if (!heeftTags(r, actieveTags)) return false;
    if (q) {
      const tekst = norm([r.titel, ...(r.tags || []), ...r.ingredienten.map((i) => i.naam)].join(" "));
      if (!q.split(/\s+/).every((w) => tekst.includes(w))) return false;
    }
    return true;
  });
}

function toonRecepten() {
  const lijst = gefilterd().sort((a, b) => a.titel.localeCompare(b.titel));
  $("#tagChips").innerHTML = chips(actieveTags);
  $("#aantal").textContent = `${lijst.length} van ${recepten.length} recepten`;
  $("#lijst").innerHTML = lijst.map((r) => kaart(r)).join("") ||
    `<li class="leeg">Geen recepten gevonden met deze filters.</li>`;
}

// ---------- kiezen-tab (swipen) ----------
const AANTAL_SWIPES = 3;
const PER_KEER = 5;

function lijkt(a, b) {
  const ka = a.kenmerken || {}, kb = b.kenmerken || {};
  let s = 0;
  if (ka.basis && ka.basis === kb.basis) s += 2;
  if (ka.eiwit && ka.eiwit === kb.eiwit) s += 2;
  if (ka.gewicht && ka.gewicht === kb.gewicht) s += 1;
  s += (ka.karakter || []).filter((k) => (kb.karakter || []).includes(k)).length;
  const ib = kernIngredienten(b).map(norm);
  s += Math.min(kernIngredienten(a).filter((n) => ib.includes(norm(n))).length, 3) * 0.5;
  return s;
}

function kiesPool() {
  const maxTijd = +$("#kiesTijd").value || Infinity;
  return recepten.filter((r) => (!r.tijd || r.tijd <= maxTijd) && heeftTags(r, kiesTags));
}

// Kies gevarieerde kaarten: steeds het recept dat het minst lijkt op de al gekozen kaarten
function gevarieerd(pool, n) {
  const rest = [...pool].sort(() => Math.random() - 0.5);
  const gekozen = rest.length ? [rest.shift()] : [];
  while (gekozen.length < n && rest.length) {
    rest.sort((a, b) => Math.max(...gekozen.map((g) => lijkt(a, g))) - Math.max(...gekozen.map((g) => lijkt(b, g))));
    gekozen.push(rest.shift());
  }
  return gekozen;
}

function startSwipe() {
  const pool = kiesPool();
  swipe = { kaarten: gevarieerd(pool, Math.min(AANTAL_SWIPES, pool.length)), i: 0, ja: [], nee: [], aantal: PER_KEER, pool };
  toonKiezen();
}

function beslis(jaNee) {
  if (!swipe || swipe.i >= swipe.kaarten.length) return;
  const r = swipe.kaarten[swipe.i];
  (jaNee ? swipe.ja : swipe.nee).push(r);
  swipe.i++;
  toonKiezen();
}

function uitslag() {
  const { ja, nee, pool } = swipe;
  const gescoord = pool
    .filter((r) => !nee.includes(r))
    .map((r) => {
      let score = Math.random() * 0.5, beste = null, besteS = -1;
      for (const l of ja) { const s = r === l ? 100 : lijkt(r, l); score += s; if (s > besteS) { besteS = s; beste = l; } }
      for (const d of nee) score -= 0.7 * lijkt(r, d);
      const reden = ja.includes(r) ? "je had hier zin in" : beste ? `lijkt op ${beste.titel.replace(/ \(.*\)$/, "")}` : nee.length ? "anders dan wat je wegswipete" : "";
      return { r, score, reden, anker: ja.includes(r) ? null : beste };
    })
    .sort((a, b) => b.score - a.score);
  // Wissel af tussen de recepten waar je zin in had, zodat niet alles op één ervan lijkt
  const eerst = gescoord.filter((x) => !x.anker), groepen = new Map();
  for (const x of gescoord.filter((x) => x.anker)) {
    if (!groepen.has(x.anker)) groepen.set(x.anker, []);
    groepen.get(x.anker).push(x);
  }
  const rest = [];
  while ([...groepen.values()].some((g) => g.length)) for (const g of groepen.values()) if (g.length) rest.push(g.shift());
  return [...eerst, ...rest];
}

function swipeKaart(r) {
  const k = r.kenmerken || {};
  const labels = [k.basis, k.eiwit === "vega" ? null : k.eiwit, k.gewicht, ...(k.karakter || [])].filter(Boolean);
  const ingr = kernIngredienten(r);
  return `<div class="swipekaart" id="swipeKaart">
      <span class="badge ja">zin in</span><span class="badge nee">nee</span>
      <h2>${esc(r.titel)}</h2>
      <p class="meta">${r.tijd ? `⏱ ${r.tijd} min` : ""}${(r.tags || []).map((t) => ` · ${esc(t)}`).join("")}</p>
      <div class="labels">${labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
      <p class="ingrkort">${esc(ingr.slice(0, 8).join(", "))}${ingr.length > 8 ? "…" : ""}</p>
    </div>`;
}

function toonKiezen() {
  $("#kiesChips").innerHTML = chips(kiesTags);
  if (!swipe) startSwipe();
  const vak = $("#swipeVak");
  const { kaarten, i } = swipe;
  if (!swipe.pool.length) { vak.innerHTML = `<p class="leeg">Geen recepten met deze filters.</p>`; return; }
  if (i < kaarten.length) {
    vak.innerHTML = `<p class="muted stap">${i + 1} van ${kaarten.length} · swipe of tik</p>
      ${swipeKaart(kaarten[i])}
      <div class="swipeknoppen">
        <button data-swipe="nee" aria-label="Nee">✕</button>
        <button data-swipe="ja" aria-label="Zin in">♥</button>
      </div>`;
    sleepbaar($("#swipeKaart"));
    return;
  }
  const res = uitslag();
  vak.innerHTML = `<div class="sugkop"><h2>Voor jou</h2><button id="opnieuw" class="linkknop">↻ opnieuw swipen</button></div>
    <ul class="kaarten">${res.slice(0, swipe.aantal).map((x) => kaart(x.r, x.reden ? `<span class="reden">${esc(x.reden)}</span>` : "")).join("")}</ul>
    ${res.length > swipe.aantal ? `<button id="meer" class="meerknop">Meer suggesties</button>` : ""}`;
}

// Swipen met je vinger (of muis)
function sleepbaar(el) {
  let x0 = null, dx = 0;
  el.addEventListener("pointerdown", (e) => { x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.style.transition = "none"; });
  el.addEventListener("pointermove", (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    el.classList.toggle("naarJa", dx > 40); el.classList.toggle("naarNee", dx < -40);
  });
  const los = () => {
    if (x0 === null) return;
    x0 = null; el.style.transition = "";
    if (Math.abs(dx) > 90) {
      el.style.transform = `translateX(${dx > 0 ? 500 : -500}px) rotate(${dx / 10}deg)`;
      setTimeout(() => beslis(dx > 0), 180);
    } else { el.style.transform = ""; el.classList.remove("naarJa", "naarNee"); }
  };
  el.addEventListener("pointerup", los);
  el.addEventListener("pointercancel", los);
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
  $("#detailInhoud").innerHTML = `
    <h2>${esc(r.titel)}</h2>
    <p class="meta">${r.tijd ? `⏱ ${r.tijd} min · ` : ""}${r.porties ? `${r.porties} porties` : ""}${(r.tags || []).length ? " · " + r.tags.map(esc).join(", ") : ""}</p>
    ${r.bron ? `<p class="meta">Bron: ${/^https?:/.test(r.bron) ? `<a href="${esc(r.bron)}" target="_blank" rel="noopener">${esc(new URL(r.bron).hostname)}</a>` : esc(r.bron)}</p>` : ""}
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
}

function huidigeView() { return document.querySelector(".tabs .actief")?.dataset.view || "recepten"; }

function toonView(view) {
  if (view === "opmaken") toonOpmaken(); else if (view === "kiezen") toonKiezen(); else toonRecepten();
}

function wissel(view) {
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("actief", b.dataset.view === view));
  $("#pageTitle").textContent = { opmaken: "Wat moet op?", kiezen: "Waar heb je zin in?" }[view] || "Recepten";
  toonView(view);
  window.scrollTo(0, 0);
}

// ---------- events ----------
["#zoek", "#maxTijd"].forEach((s) => $(s).addEventListener("input", toonRecepten));
$("#kiesTijd").addEventListener("input", startSwipe);
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
  if (c) {
    const set = c.closest("#kiesChips") ? kiesTags : actieveTags, t = c.dataset.tag;
    set.has(t) ? set.delete(t) : set.add(t);
    return set === kiesTags ? startSwipe() : toonRecepten();
  }
  const sw = e.target.closest("[data-swipe]"); if (sw) return beslis(sw.dataset.swipe === "ja");
  if (e.target.closest("#opnieuw")) return startSwipe();
  if (e.target.closest("#meer")) { swipe.aantal += PER_KEER; return toonKiezen(); }
  const tab = e.target.closest(".tabs button"); if (tab) { $("#detail").hidden = true; return wissel(tab.dataset.view); }
});
$("#terug").addEventListener("click", () => { $("#detail").hidden = true; toonView(huidigeView()); });

// ---------- start ----------
Promise.all([
  fetch("data/recipes.json", { cache: "no-cache" }).then((r) => r.json()),
  fetch("data/voorraadkast.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => []),
]).then(([data, kast]) => {
  recepten = data;
  voorraad = new Set(kast.map(norm));
  toonRecepten();
}).catch(() => { $("#lijst").innerHTML = `<li class="leeg">Kon recepten niet laden.</li>`; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
