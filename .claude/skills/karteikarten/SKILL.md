---
name: karteikarten
description: Juristische Karteikarten für das TRÆCK-Kartenmodul erstellen. Verwenden, wenn der Nutzer "erstelle Karten zu <Thema>" oder Ähnliches sagt — schreibt Karten nach content/FORMAT.md in das passende Deck unter content/decks/ und öffnet einen Pull Request.
---

# Karteikarten erstellen
Wenn der Nutzer "erstelle Karten zu <Thema>" sagt:
1. content/decks/**/_deck.yaml lesen, passendes Deck wählen, bei Unklarheit fragen.
2. Bestehende Karten des Decks auf Duplikate prüfen (front / title / problem).
3. Karten nach content/FORMAT.md schreiben. Regeln:
   - Eine Karte = eine Information. Definitionen als basic, Prüfungsaufbau als schema,
     Meinungsstreits als streitstand, Normkern als cloze.
   - source nur wenn sicher bekannt, sonst weglassen. Nichts erfinden.
   - Juristische Abkürzungen (h. M., str., BGH, Rn.) sind erlaubt, sonst keine.
   - Tags: rechtsgebiet, teilgebiet, kartenart.
   - Niveau: zweites Staatsexamen, Assessorperspektive (Relation, Urteil, Anwaltsklausur).
4. An die passende .md anhängen, nie überschreiben.
5. npm run cards:check ausführen (falls vorhanden) und Zusammenfassung ausgeben:
   neue Karten pro Typ, mögliche Duplikate.
6. Branch content/<thema-slug>, Pull Request öffnen.
