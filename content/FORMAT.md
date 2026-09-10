# Kartenformat

Karteikarten liegen als Markdown-Dateien unter `content/decks/<rechtsgebiet>/*.md`.
Jeder Ordner mit einer `_deck.yaml` ist ein Deck; Unterordner mit eigener `_deck.yaml`
sind Unterdecks. Alle `.md`-Dateien eines Ordners gehören zu dessen Deck.

## Aufbau

Eine .md-Datei enthält viele Karten, getrennt durch eine Zeile `---`.
Jede Karte beginnt mit YAML-Frontmatter (`type`, `tags`, optional `source`), danach
Abschnitte mit `## <feldname>`.

```
---
type: basic
tags: [zivilrecht, bgb-at, definition]
source: Palandt/Ellenberger, Einf. v. § 116 Rn. 1
---
## front
…

## back
…
---
type: cloze
tags: [strafrecht, at, norm]
---
## text
…
```

Präzise Regeln, damit der Parser eindeutig arbeitet:

- Die Datei beginnt mit `---`. Die Zeile `---`, die eine Karte abschließt, ist zugleich
  die öffnende Zeile des Frontmatters der nächsten Karte. Beim Aufteilen an allen
  `---`-Zeilen wechseln sich also Frontmatter und Kartenkörper ab.
- Innerhalb einer Karte darf keine Zeile nur aus `---` bestehen. Trennlinien im
  Markdown mit `***` schreiben.
- `type` ist Pflicht und einer von `basic`, `reverse`, `cloze`, `schema`, `streitstand`.
- `tags` ist eine YAML-Liste: `[rechtsgebiet, teilgebiet, kartenart]`.
- `source` (Fundstelle) nur angeben, wenn sie sicher bekannt ist. Sonst weglassen.
- Feldnamen (`## front` usw.) kleingeschrieben, Reihenfolge wie unten; unbekannte
  Felder sind ein Fehler.
- Feldinhalt ist Markdown (GFM). Normzitate wie `§ 823 I BGB` oder `Art. 12 GG` werden
  in der App automatisch hervorgehoben — kein Markup nötig.
- Eine Datei ohne Karten (nur ein Kommentar) ist erlaubt, siehe die leeren `allgemein.md`.

## Felder je Typ

| type | Felder |
|---|---|
| `basic` | `## front`, `## back` |
| `reverse` | `## front`, `## back` — erzeugt zwei Lernrichtungen |
| `cloze` | `## text` (mit `{{c1::…}}`), optional `## extra` — eine Karte pro Lücke |
| `schema` | `## title`, `## steps` (nummerierte Liste; `Label — Inhalt` pro Zeile) |
| `streitstand` | `## problem`, `## ansichten` (`### Name der Ansicht`, darunter Bullet-Argumente), optional `## rechtsprechung`, `## stellungnahme` |

Bei `schema` trennt ein Gedankenstrich ` — ` (U+2014 mit Leerzeichen) Label und Inhalt.
Bei `cloze` sind Lücken `{{c1::Text}}`, `{{c2::Text}}` …; gleiche Nummer = gleiche Lücke.

## Beispiele

### basic

```
---
type: basic
tags: [zivilrecht, bgb-at, definition]
---
## front
Was ist eine Willenserklärung?

## back
Eine **private Willensäußerung**, die unmittelbar auf die Herbeiführung einer
Rechtsfolge gerichtet ist.

Objektiver Tatbestand: Erklärung, die aus Sicht eines objektiven Empfängers
(§§ 133, 157 BGB) auf einen Rechtsbindungswillen schließen lässt.

Subjektiver Tatbestand:
- Handlungswille (konstitutiv)
- Erklärungsbewusstsein (nach h. M. entbehrlich, wenn zurechenbar — BGHZ 91, 324)
- Geschäftswille (nicht konstitutiv, § 119 I BGB)
```

### reverse

```
---
type: reverse
tags: [zivilrecht, bgb-at, norm]
---
## front
§ 130 I 1 BGB

## back
Zugang einer Willenserklärung unter Abwesenden: Sie wird wirksam, wenn sie dem
Empfänger zugeht.
```

### cloze

```
---
type: cloze
tags: [strafrecht, at, definition]
---
## text
Vorsatz ist {{c1::Wissen}} und {{c2::Wollen}} der Verwirklichung des
{{c3::objektiven Tatbestands}} zum Zeitpunkt der {{c4::Tathandlung}} (§ 16 I 1 StGB).

## extra
Stufen: Absicht (dolus directus 1. Grades), Wissentlichkeit (dolus directus
2. Grades), Eventualvorsatz (dolus eventualis).
```

### schema

```
---
type: schema
tags: [zivilrecht, schuldrecht-at, schema]
---
## title
Schadensersatz statt der Leistung, §§ 280 I, III, 281 BGB

## steps
1. Schuldverhältnis — vertraglich oder gesetzlich, wirksam
2. Pflichtverletzung — Nichtleistung oder Schlechtleistung trotz Fälligkeit und Durchsetzbarkeit (§ 281 I 1 BGB)
3. Fristsetzung — angemessene Frist erfolglos abgelaufen oder entbehrlich nach § 281 II BGB bzw. § 323 II BGB analog
4. Vertretenmüssen — §§ 280 I 2, 276, 278 BGB; wird vermutet, Schuldner muss sich entlasten
5. Schaden — Differenzhypothese, § 249 ff. BGB; Abgrenzung kleiner/großer Schadensersatz (§ 281 I 2, 3 BGB)
6. Rechtsfolge — Schadensersatz statt der Leistung; Leistungsanspruch erlischt mit Verlangen, § 281 IV BGB
```

### streitstand

```
---
type: streitstand
tags: [strafrecht, at, streitstand]
---
## problem
Ist ein Rücktritt vom unbeendeten Versuch (§ 24 I 1 Alt. 1 StGB) möglich, wenn der
Täter sein außertatbestandliches Ziel bereits erreicht hat und deshalb von der
weiteren Ausführung absieht („Denkzettel-Fall")?

## ansichten
### Tatplantheorie / Teile der Literatur
- Kein „Aufgeben", wenn der Täter kein Motiv mehr für die Vollendung hat — es gibt
  nichts mehr aufzugeben.
- Rücktrittsprivileg belohnt die Umkehr, nicht die bloße Zweckerreichung.
- Wortlaut „aufgibt" setzt Verzicht auf ein noch verfolgtes Ziel voraus.

### Rechtsprechung / h. M.
- Maßgeblich ist allein, ob der Täter nach seiner Vorstellung noch vollenden könnte
  und davon freiwillig absieht (Rücktrittshorizont).
- Außertatbestandliche Ziele sind für § 24 StGB unbeachtlich; entscheidend ist der
  tatbestandliche Erfolg.
- Opferschutz: Wer den Anreiz zum Weiterhandeln nimmt, soll nicht schlechter stehen.

## rechtsprechung
BGH (GrS), BGHSt 39, 221: Rücktritt möglich. Der Täter, der von der Tatvollendung
absieht, obwohl er sie für möglich hält, gibt die Tat auf, auch wenn das
außertatbestandliche Ziel erreicht ist.

## stellungnahme
Der h. M. ist zu folgen. Der Wortlaut verlangt nur das Aufgeben der weiteren
Ausführung der Tat, nicht des Motivs. Das Opferschutzargument trägt: Ein
Ausschluss des Rücktritts würde den Täter zur Vollendung drängen. In der Klausur
kurz den Streit darstellen, dann mit der Rechtsprechung entscheiden.
```
