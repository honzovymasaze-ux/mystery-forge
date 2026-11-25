# Detektivní spis – úpravy oproti Mystery Forge

Tento fork přidává k [Mystery Forge](https://github.com/guplem/mystery-forge) (licence MIT) realistický policejní spis,
hlasové zprávy od kolegů a předčítaný příběh hlavního vyšetřovatele. Hra se vyrábí stejně jako v původním projektu
(viz `README.md`): v konfiguraci zvolte jazyk **čeština** a formát **case file** (spis) nebo **both**.

## Co je nového

| Oblast               | Co umí                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokumenty            | pitevní protokol, laboratorní protokol (krev, toxikologie, forenzní stopy), výpis hovorů a buněk operátora, faktura, snímek z kamery, fotografie osoby, ručně psaný vzkaz – vedle původních (e-mail, účtenka, výslech, dopis, noviny, policejní záznam…) |
| Fotky                | skutečné fotky JPG/PNG v `source/images/`                                                                                                                                                                                                                |
| Příběh vyšetřovatele | kapitoly v `source/investigation.yaml`; tisknou se za stránkou STOP každé obálky a jsou v průvodci s tlačítkem „Přečti nám to“                                                                                                                           |
| Hlasovky             | hlasové zprávy kolegů v průvodci (záložka **Případ**); přicházejí s obálkou nebo po vyřešení úkolu                                                                                                                                                       |
| Čeština              | ručně přeložené všechny pevné texty, data („24. listopadu 2026“), kontroly textu                                                                                                                                                                         |

## Vlastní fotky svědků, podezřelých a z kamer

1. Najděte složku hry: `generator/games/<datum>-<název>/source/images/`.
2. Vložte fotku a pojmenujte ji podle obrázku, který má nahradit, např. `portrait-ana-ruiz.jpg`
   (portrét postavy `ana-ruiz`) nebo podle obrázku v dokumentu `{{image:kamera-brana|…}}` → `kamera-brana.jpg`.
3. Vedle ní můžete dát `portrait-ana-ruiz.txt` s jednou větou, co je na fotce (čte ji kontrola hry).
4. Spusťte generátor, zvolte 4 („Talk to the AI“) a napište „vyrenderuj hru znovu“.

Fotka nahradí kreslený obrázek se stejným jménem. Používejte jen fotky, ke kterým máte svolení (vlastní, herci, kamarádi).

## Vlastní nahrávky hlasovek

Bez nahrávky přečte zprávu hlas telefonu (syntéza řeči v prohlížeči, česky, mužský/ženský podle `voice`).
Pro lepší atmosféru namluvte zprávy sami:

1. V `source/investigation.yaml` najděte `id` zprávy, např. `vm-kalinova`.
2. Nahrávku uložte jako `source/audio/vm-kalinova.mp3` (také `.m4a`, `.ogg`, `.wav`).
3. Hru vyrenderujte znovu. Nahrávka se vloží přímo do souboru průvodce, takže funguje i bez internetu.

## Formát `investigation.yaml`

```yaml
format_version: 1
narrator:
  name: kpt. Jana Horáková
  role: vedoucí vyšetřování
chapters:
  - id: ch-a
    stage: A # obálka
    title: Maják zhasl
    text: |
      Volali mi ve čtyři ráno…
  - id: ch-a2
    stage: A
    after: P2 # objeví se v průvodci až po vyřešení úkolu P2 (netiskne se)
    title: Zámek povolil
    text: …
voice_messages:
  - id: vm-kalinova
    stage: A
    after: P1 # volitelné
    sender: MUDr. Věra Kalinová
    role: soudní lékařka
    voice: female # male / female
    text: Jano, pitva je hotová…
```

Kapitoly ani hlasovky nesmějí prozradit odpověď úkolu; kontrola hry to hlídá.

## Televize a telefony: archiv důkazů a sdílená hra

`forge render` vytváří vedle průvodce hrou i **Průvodce pro hráče (TV a mobil)**. Ten se dává do aplikace pro televizi
(`scripts/build-tv-apk.sh`).

- **Archiv důkazů** (záložka Důkazy): všechny dokumenty po obálkách, v tištěné podobě. Chat, výpis hovorů, e-mail
  a záznam z kamery se dají přepnout i do podoby obrazovky telefonu nebo kamery. Listuje se šipkami, `+` a `−`
  přibližuje, Zpět zavře.
- **Zamčené obálky** jsou v souboru zašifrované. Otevřou se teprve správnou odpovědí na úkol, který obálku otevírá.
- **Žádné řešení:** hráčská verze nemá záložku Řešení ani krok s odpovědí v nápovědách. Konce a vysvětlení jsou
  zašifrované a otevře je až správné obvinění. Řešení je jen v PDF pro vedoucího hry.
- **Telefony:** aplikace v televizi spustí v domácí síti malý server a na úvodní obrazovce ukáže QR kód. Telefon
  na stejné Wi-Fi ho naskenuje a otevře stejnou hru. Vyřešené úkoly, odemčené obálky a obvinění se sdílejí mezi
  televizí a všemi telefony. Nic neodchází mimo domácí síť.
- **Ovladač:** šipky přesouvají výběr mezi tlačítky, OK potvrdí, Zpět zavře dokument nebo dialog.

QR kód nejde vytisknout do návodu: adresa televize v domácí síti je známá až při spuštění aplikace.

## Nástěnka, postupné důkazy a dohrání

- **Nástěnka** (záložka Nástěnka): důkazy připnuté po obálkách, nahoře podezřelí. U osob stav (podezřelý, nejistý,
  vyloučen, svědek), přiřazené důkazy, rychlé štítky a žluté lístky s poznámkami. Ovladač: šipky, OK otevře,
  dlouhý stisk OK otevře možnosti. Rozložení se ukládá a sdílí s telefony. Aplikace nic nehodnotí.
- **Grafika nástěnky:** obrázky do `toolkit/src/mystery_forge/render/companion/board-art/` (viz README tamtéž).
- **Postupné důkazy:** dokument s polem `after: P<číslo>` se v archivu a na nástěnce objeví až po vyřešení toho úkolu.
  Vytištěný papír zůstává v obálce.
- **Uložený postup:** rozehraná hra se ukládá v televizi i v telefonech. Po obvinění tlačítko „Zapsat jako dohráno
  a začít znovu“ zapíše datum a skóre a hra začne od začátku.
