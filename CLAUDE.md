# Mijn Recepten — instructies voor Claude

Dit is Max' persoonlijke recepten-app: een statische web-app (geen build-stap) die via
GitHub Pages draait en op zijn telefoon als app op het beginscherm staat. Communiceer in het Nederlands.

## Structuur
- `data/recipes.json` — alle recepten (één JSON-array).
- `data/voorraadkast.json` — ingrediënten die Max altijd in huis heeft (specerijen, olie, azijn, sauzen,
  bouillon, ui, knoflook, …). Die tellen nergens mee in de app.
- `index.html`, `app.js`, `style.css` — de app zelf, drie tabs:
  - **Recepten:** lijst met zoeken en filters (tijd, tags).
  - **Kiezen:** filters (tijd, tags) → 3 gevarieerde recepten swipen → 5 suggesties (+ "meer"),
    gebaseerd op de verborgen `kenmerken` en gedeelde ingrediënten.
  - **Opmaken:** restjes intypen → recepten die er zoveel mogelijk van gebruiken.
- De app bewaart niets op de telefoon (geen duimpjes, geen kookgeschiedenis): restjes en swipes gelden
  alleen voor dat moment.

## Een recept toevoegen
Max stuurt meestal een screenshot (Instagram, website, kookboekfoto), soms tekst of een link.

1. Lees het recept uit. Vertaal naar het Nederlands als het in een andere taal is.
   Reken cups/oz/°F om naar gram/ml/°C.
2. Voeg een object toe aan `data/recipes.json` volgens dit schema:

```json
{
  "id": "korte-unieke-slug",
  "titel": "Naam van het gerecht",
  "bron": "https://… of bv. 'Instagram @account' of 'Kookboek X'",
  "tijd": 30,
  "porties": 2,
  "tags": ["vega"],
  "kenmerken": { "basis": "pasta", "eiwit": "vega", "karakter": ["pittig"], "gewicht": "licht" },
  "ingredienten": [
    { "naam": "kikkererwten", "hoeveelheid": "1 blik" },
    { "naam": "koriander", "hoeveelheid": "handje", "optioneel": true },
    { "naam": "zout", "hoeveelheid": "naar smaak" }
  ],
  "bereiding": ["Stap 1.", "Stap 2."],
  "notities": ""
}
```

Regels:
- `naam`: kort en generiek, enkelvoud/meervoud zoals je het in de winkel zegt ("ui", "eieren",
  "tomatenblokjes"), zonder hoeveelheid of bereidingswijze. Gebruik dezelfde namen als in bestaande
  recepten (check eerst), anders matcht de Opmaken-functie niet. Voor voorraadkast-items exact
  dezelfde naam als in `data/voorraadkast.json`.
- **Voorraadkast:** check elk nieuw ingrediënt. Duidelijk voorraadkast (specerij, gedroogde kruiden, olie,
  azijn, saus uit fles/pot zoals sojasaus/hoisin/ketjap, maizena, bouillon, suiker, bloem, boter, honing,
  mosterd, tomatenpuree, ui, knoflook) → voeg toe aan `data/voorraadkast.json`. Blikjes (tomatenblokjes,
  kikkererwten, kokosmelk) horen er níét in. **Twijfel je, vraag het Max** en voeg pas toe na zijn antwoord.
- `optioneel: true` voor garnering/variaties.
- `tijd` in minuten (totaal, schatting mag). Weglaten als echt onbekend.
- `tags`: alleen deze drie, verder niks:
  - `vega` als het gerecht vegetarisch is;
  - `vegan` als het ook veganistisch is (dan óók `vega`);
  - `slowcooker` als het in de slowcooker wordt gemaakt.
- `kenmerken` (verborgen, voor de Kiezen-tab) — altijd invullen:
  - `basis`: pasta / rijst / noedels / aardappel / brood / soep / groente / graan / bonen
  - `eiwit`: kip / vlees / vis / vega (vis = ook schaal- en schelpdieren)
  - `karakter`: lijst met 1–2 van comfort / fris / pittig
  - `gewicht`: licht / zwaar
  Kijk bij twijfel hoe vergelijkbare bestaande recepten zijn ingedeeld.
- Houd stappen beknopt en in eigen woorden.
3. Controleer dat de JSON geldig is (`python3 -m json.tool data/recipes.json > /dev/null`, idem voorraadkast).
4. Commit met `Recept: <titel>` en push naar `main`. GitHub Pages werkt de app binnen ~1 minuut bij.
5. Meld kort wat je hebt toegevoegd en of er iets onduidelijk was op de screenshot.

Recepten wijzigen of verwijderen gaat op dezelfde manier: pas `data/recipes.json` aan, commit, push.
Zegt Max "X hoort (niet) in de voorraadkast", pas dan alleen `data/voorraadkast.json` aan.

Al beslist door Max als **géén** voorraadkast (niet opnieuw vragen): sjalot, lente-ui, kappertjes,
olijven, jalapeños, harissa, zongedroogde tomaten, ingemaakte citroen, citroen, limoen, Noilly Prat,
cognac, wijn, verse gember, melk, eieren, gochujang.
