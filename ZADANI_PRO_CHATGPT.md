# Zadání pro ChatGPT: napište detektivní případ

Takhle vznikne hra:

1. **ChatGPT** napíše případ: příběh, důkazní materiály, kapitoly vyšetřovatele a hlasovky. Vygeneruje i fotky
   podezřelých, svědků a záběry z kamer.
2. **Claude** (v tomto repozitáři) výstup zkontroluje nástrojem Mystery Forge, opraví chyby, vytvoří PDF k tisku
   a aplikaci pro televizi.
3. Vy vytisknete důkazy, nainstalujete aplikaci do televize a hrajete.

## Jak na to

1. Otevřete nový chat v ChatGPT.
2. Zkopírujte celý text z rámečku **„Zadání“** níže a doplňte tři řádky nahoře (téma, hráči, délka).
3. ChatGPT bude odpovídat po částech. Když skončí uprostřed, napište mu **„pokračuj“**.
4. Až napíše `KONEC PŘÍPADU`, požádejte ho o fotky (druhý rámeček **„Fotky“**).
5. Celé odpovědi (text) a stažené obrázky pošlete Claudovi. Stačí je vložit do chatu nebo poslat jako soubory.

## Zadání

```text
Jsi autor realistických detektivních her typu "policejní spis v krabici". Napiš kompletní kooperativní
detektivní případ v češtině pro hru u stolu. Hráči jsou tým vyšetřovatelů. Dostanou vytištěné důkazní
materiály rozdělené do obálek a na televizi aplikaci, kde jim vedoucí vyšetřování vypráví příběh a kolegové
posílají hlasové zprávy.

TÉMA A PROSTŘEDÍ: [sem napište, např. "vražda majitele vinařství na jižní Moravě, současnost"]
POČET HRÁČŮ: [např. 4 dospělí]
DÉLKA HRY: [např. 2 až 3 hodiny]

PRAVIDLA OBSAHU
- Vše je smyšlené: osoby, firmy, úřady, telefonní čísla, SPZ, e-maily (doména .example). Žádné skutečné osoby.
- Realistické, ale ne naturalistické: pitva a fotky bez krve a zranění v detailu.
- Případ musí jít vyřešit jen z dokumentů. Každý krok řešení stojí na konkrétní větě v konkrétním dokumentu.
- Dedukce místo šifer: hráči porovnávají časy, místa, výpovědi, výpisy hovorů a účtenky.
- Pachatel je jeden. 3 až 4 podezřelí. Každý nevinný jde vyloučit konkrétní stopou.
- Alespoň 2 falešné stopy, které se dají vyvrátit.
- 3 nebo 4 obálky (A, B, C, D). Obálka A se otevře na začátku, každá další po vyřešení jednoho úkolu.
- 18 až 28 dokumentů celkem. Využij tyto druhy (pole "kind"):
  police-report (úřední záznam), transcript (protokol o výslechu: řádky "JMÉNO: text"),
  autopsy-report (pitevní protokol), lab-report (krevní test, toxikologie, otisky, DNA – výsledky v tabulce),
  phone-records (výpis hovorů a buněk – tabulka: čas, typ, druhé číslo, délka, buňka),
  email, chat-log (SMS / chat, řádky "Jméno: zpráva"), letter (dopis), note (krátký ručně psaný vzkaz),
  receipt (účtenka), invoice (faktura), newspaper (noviny), person-photo (fotka osoby, jedna pro každého
  podezřelého a důležitého svědka), cctv-still (záběr z kamery), map (plánek), form (úřední formulář),
  case-briefing (úvodní zadání případu).
- Tabulky piš v Markdownu (| sloupec | sloupec |).
- Důkazy přicházejí postupně: dokument, který má hráč dostat až po vyřešení úkolu, dostane ve front matter
  `after: P<číslo>` (úkol stejné nebo dřívější obálky). Na televizi se pak objeví až po vyřešení.
- Na každém místě, kde se objeví jméno postavy, napiš {{char:id-postavy}}, místo {{place:id-mista}}.
  Nástroj tam doplní jméno.

ÚKOLY (4 až 6) A OBVINĚNÍ
- Každý úkol je otázka, na kterou hráči odpoví jedním slovem, jménem nebo číslem, a odpověď ověří v aplikaci.
- Úkol, který otevírá další obálku, uvádí "unlocks" v flow.yaml (opens_with).
- Otázka úkolu musí doslova stát v textu některého dokumentu dané obálky (jako vzkaz, poznámka šéfa apod.).
- mechanic: "deduction" (kdo/jak/proč), "observation" (detail v dokumentu), nebo "recontextualized-document".
- params: {} (prázdné).
- Na konci je obvinění: 3 až 4 otázky s možnostmi (kdo, jak, proč, klíčový důkaz).

KAPITOLY A HLASOVKY (soubor investigation.yaml)
- Vypravěč: vedoucí vyšetřování (jméno, hodnost). Píše v první osobě, napínavě, 120 až 250 slov na kapitolu.
- Každá obálka má aspoň jednu kapitolu bez "after" (čte se při otevření obálky). Může mít další kapitolu
  s "after: P<číslo>", která se objeví po vyřešení úkolu.
- Hlasovky: 1 až 3 na obálku od kolegů (soudní lékař, technik, operativec, analytik telefonů...).
  20 až 70 slov, hovorově, jako opravdová hlasová zpráva. "voice": male nebo female.
- Kapitoly ani hlasovky NIKDY neprozradí odpověď úkolu ani pachatele. Jen navádějí k dokumentům.

VÝSTUP
Odpovídej pouze soubory. Každý soubor začni řádkem
=== SOUBOR: cesta/k/souboru ===
a pak jeho obsah. Pořadí: story.yaml, flow.yaml, puzzles/P1.yaml ..., documents/D1.md ..., investigation.yaml,
fotky.txt. Na úplný konec napiš KONEC PŘÍPADU. Když dojde místo, skonči celým souborem a pokračuj
po mé zprávě "pokračuj".

FORMÁT story.yaml
format_version: 1
title: <název případu>
tagline: <jedna věta na obálku>
premise: <o čem případ je, bez řešení>
setting: <místo>
era: <doba, např. "2026">
tone: <např. "temný, realistický">
visual_style: noir
truth: <celá pravda: kdo, jak, proč – pro řešení>
characters:
  - {id: jan-novak, name: Jan Novák, role: majitel vinařství, description: ..., age: 58, is_victim: true}
  - {id: eva-mala, name: Eva Malá, role: účetní, description: ..., age: 41, is_suspect: true, is_culprit: true,
     secret: ...}
locations:
  - {id: sklep, name: vinný sklep, description: ...}
objects:
  - {id: klic-od-sklepa, name: klíč od sklepa, description: ...}
timeline:
  - {id: vecere, start: "2026-10-14 19:00", end: "2026-10-14 20:30", location: sklep,
     participants: [jan-novak, eva-mala], description: ..., known_to_players: true}
clues:   # každá stopa = DOSLOVNÁ věta z dokumentu
  - {id: hovor-2214, document: D7, quote: "22:14 | hovor | 605 770 141 | 1:04 | ZNOJMO-SEVER"}
intro: <úvod, který se čte nahlas na začátku, 60 až 200 slov, bez řešení>
deduction:
  culprit: eva-mala
  questions:
    - id: kdo
      prompt: Kdo zabil Jana Nováka?
      options: [{id: eva, text: Eva Malá}, {id: petr, text: Petr Veselý}, {id: lucie, text: Lucie Kratochvílová}]
      correct: eva
      points: 50
      proven_by: [hovor-2214, ...]
  exclusions:
    - {suspect: petr-vesely, clues: [...], explanation: ...}
epilogues:
  - {id: vyreseno, min_score_percent: 75, title: ..., text: ...}
  - {id: napul, min_score_percent: 40, title: ..., text: ...}
  - {id: nevyreseno, min_score_percent: 0, title: ..., text: ...}
reveal:
  - {text: <krok vysvětlení řešení>, clues: [hovor-2214]}

FORMÁT flow.yaml
format_version: 1
structure: linear
stages:
  - {id: A, label: Místo činu, opens_with: start}
  - {id: B, label: Pitva a laboratoř, opens_with: P1, opening_text: <věta při otevření obálky>}
final_puzzle: P5
accusation: true

FORMÁT puzzles/P1.yaml
format_version: 1
id: P1
title: <krátký název>
stage: A
mechanic: observation
difficulty: medium
in_world_reason: <proč úkol v příběhu existuje>
reveals: <co hráči zjistí>
reveal_text: <1 až 2 věty, které aplikace ukáže po správné odpovědi>
answer: <odpověď>
accepted: [<další uznané tvary odpovědi>]
answer_format: {kind: word, label: jedno slovo}     # kind: word | number | digits | name | phrase
question: <otázka doslova tak, jak stojí v dokumentu>
params: {}
clues:
  - {id: p1-stopa, document: D3, quote: <doslovná věta z D3>}
solution:
  - {text: <krok řešení>, uses: [p1-stopa]}
hints:
  - {level: 1, text: <jemná nápověda>}
  - {level: 2, text: <silnější nápověda>}
  - {level: 3, text: <skoro řešení>}
canary: canary-p1-<náhodné slovo>

FORMÁT documents/D1.md
---
format_version: 1
id: D1
kind: police-report
stage: A
title: Úřední záznam o nálezu
fields:
  station: Policie ČR, KŘ Jihomoravského kraje
  case_number: KRPB-1148/TČ-2026
  officer: nprap. Petr Hála
  date: 15. 10. 2026
---
Text dokumentu v Markdownu...

Pole "fields" podle druhu:
- police-report: station, case_number, officer, date, subject
- transcript: case_number, subject, interviewer, place, date
- autopsy-report: issuer, case_number, date, examiner, deceased, time_of_death, cause_of_death
- lab-report: issuer, number, case_number, sample, test, requested_by, date, analyst
- phone-records: issuer, subscriber, phone_number, period, case_number, number
- email: from, to, cc, date, subject
- chat-log: contact, owner, date, device
- letter: letterhead, place, date, recipient, sender
- note: signature, date
- receipt: shop, address, date, number, total
- invoice: issuer, address, number, recipient, date, due_date, total
- newspaper: masthead, date, edition, price, headline, subheadline
- person-photo: name, role, case_number, date   (text dokumentu: {{image:portrait-<id-postavy>|}})
- cctv-still: camera, location, date, time, evidence_number   (text: {{image:<id-snimku>|}})
- map: place, scale, legend_title
- form: issuer, form_number, date
- case-briefing: agency, case_number, classification, recipient, date

FORMÁT investigation.yaml
format_version: 1
narrator: {name: kpt. Jana Horáková, role: vedoucí vyšetřování}
chapters:
  - id: kap-a1
    stage: A
    title: <název kapitoly>
    text: |
      <odstavec>

      <odstavec>
  - {id: kap-a2, stage: A, after: P1, title: ..., text: ...}
voice_messages:
  - {id: hz-kalinova-1, stage: A, sender: MUDr. Věra Kalinová, role: soudní lékařka, voice: female,
     text: ...}
  - {id: hz-hala-1, stage: B, after: P2, sender: nprap. Petr Hála, role: hlídka, voice: male, text: ...}

FORMÁT fotky.txt
Pro každý obrázek jeden řádek: <název souboru>.png | <přesný popis pro generátor obrázků>
Názvy: portrait-<id-postavy>.png pro fotky osob, <id-snimku>.png pro záběry z kamer.
```

## Fotky

Až ChatGPT napíše `KONEC PŘÍPADU`, pošlete mu:

```text
Teď vygeneruj obrázky podle fotky.txt, jeden po druhém. Fotky osob: realistický portrét smyšlené osoby,
neutrální pozadí, jako fotka do policejního spisu, na šířku 3:4 na výšku. Záběry z kamer: černobílý, zrnitý
záběr z bezpečnostní kamery z vyššího úhlu, obličeje nerozpoznatelné. Každý obrázek pojmenuj přesně podle
fotky.txt.
```

Obrázky stáhněte a pošlete Claudovi s tím, jak se jmenují (např. `portrait-eva-mala.png`).

## Co dodá Claude

- `2 - VYTISKNĚTE (herní materiály).pdf` – všechny důkazy po obálkách, s kapitolami vyšetřovatele,
- `1 - ZAČNĚTE TADY (návod).pdf`, nápovědy a řešení,
- `<název případu>.apk` – aplikace do televize (Android TV / Google TV): úvod, kapitoly, hlasovky,
  ověřování odpovědí, nápovědy a obvinění.

## Instalace aplikace do televize (Chromecast s Google TV)

Aplikace běží na **Chromecastu s Google TV** (ten s ovladačem), na Google TV a na Android TV.

1. Na Chromecastu otevřete **Nastavení → Systém → Informace** a sedmkrát klikněte na **Sestavení systému
   Android TV OS**. Zapne se vývojářský režim.
2. Z obchodu Google Play na Chromecastu nainstalujte aplikaci **Send files to TV** (stejnou dejte i do telefonu).
3. V **Nastavení → Aplikace → Zabezpečení a omezení → Neznámé zdroje** povolte aplikaci **Send files to TV**.
4. Soubor `.apk` pošlete z telefonu přes **Send files to TV** (telefon i Chromecast musí být na stejné Wi-Fi).
5. Na Chromecastu soubor otevřete a potvrďte **Instalovat**. Hra se objeví v **Aplikacích** pod názvem případu.

Starší Chromecast bez ovladače aplikace instalovat neumí. Tam otevřete soubor `Průvodce hrou.html` v telefonu
a obrazovku telefonu pošlete do televize: aplikace **Google Home → zařízení → Odeslat obrazovku**.

Ovládání: šipky na ovladači přecházejí mezi tlačítky, OK potvrdí. Odpověď se píše klávesnicí na obrazovce
(nebo hlasem z ovladače). Hlasovky čte hlas televize. V češtině je potřeba mít v televizi nainstalovaný
český hlas: **Nastavení → Systém → Jazyk / Převod textu na řeč**.
