# Mijn Recepten — instructies voor Claude

Dit is Max' persoonlijke recepten-app: een statische web-app (geen build-stap) die via
GitHub Pages draait en op zijn telefoon als app op het beginscherm staat. Communiceer in het Nederlands.

## Structuur
- `data/recipes.json` — alle recepten (één JSON-array). **Dit is het enige bestand dat je normaal aanpast.**
- `index.html`, `app.js`, `style.css` — de app zelf (filters, "wat heb ik thuis", slimme suggesties).
- Voorraad, duimpjes en "gekookt op" staan in localStorage op de telefoon, niet in de repo.

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
  "tags": ["vega", "pasta", "snel"],
  "ingredienten": [
    { "naam": "kikkererwten", "hoeveelheid": "1 blik" },
    { "naam": "koriander", "hoeveelheid": "handje", "optioneel": true },
    { "naam": "zout", "hoeveelheid": "naar smaak", "basis": true }
  ],
  "bereiding": ["Stap 1.", "Stap 2."],
  "notities": ""
}
```

Regels:
- `naam`: kort en generiek, enkelvoud/meervoud zoals je het in de winkel zegt ("ui", "eieren",
  "tomatenblokjes"), zonder hoeveelheid of bereidingswijze. Gebruik dezelfde namen als in bestaande
  recepten (check eerst), anders matcht de "wat heb ik thuis"-functie niet.
- `basis: true` voor dingen die altijd in huis zijn: zout, peper, olie, olijfolie, boter, suiker, bloem, water.
- `optioneel: true` voor garnering/variaties.
- `tijd` in minuten (totaal, schatting mag). Weglaten als echt onbekend.
- `tags`: kleine letters, hergebruik bestaande tags. Gangbaar: vega, vegan, vis, vlees, kip, pasta, rijst,
  soep, salade, snel (≤ 20 min), comfort, ontbijt, lunch, meal-prep, oven.
- Houd stappen beknopt en in eigen woorden.
3. Controleer dat de JSON geldig is (`python3 -m json.tool data/recipes.json > /dev/null`).
4. Commit met `Recept: <titel>` en push naar `main`. GitHub Pages werkt de app binnen ~1 minuut bij.
5. Meld kort wat je hebt toegevoegd en of er iets onduidelijk was op de screenshot.

Recepten wijzigen of verwijderen gaat op dezelfde manier: pas `data/recipes.json` aan, commit, push.
De twee voorbeeldrecepten (bron "Voorbeeldrecept") mogen weg zodra Max eigen recepten heeft.
