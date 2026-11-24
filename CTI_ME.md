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
