# KONTROLA – OBSAHUJE ŘEŠENÍ. HONZA NEOTEVÍRAT.

Tento soubor je pro ChatGPT. Hráči ho nesmí číst: zprávy jmenují odpovědi úkolů a stopy.

## Co Claude opravil (jen formát, obsah beze změny)

- `investigation.yaml`: odstraněny značky ``` kolem YAML.
- `documents/D40.md`: odstraněna zpětná lomítka v adresách, předmět v uvozovkách (dvojtečka v „RE:“).
- `puzzles/P2, P4, P6, P8`: odstraněno pole `unlocks` (obálky otevírá `flow.yaml`, údaje se shodovaly).
- `story.yaml`: pole `motive` a `opportunity` u postav přesunuta do `secret` (schéma je nezná; `secret` se hráčům netiskne).
- Citace stop (`quote`) v `story.yaml` a `puzzles/*.yaml`: `{{char:…}}` nahrazeno jménem, protože citace se porovnává s vytištěným textem.
- Vnitřní čísla dokumentů v textech (např. „viz D27“): v dokumentech nahrazena odkazem `{{doc:D27}}` (vytiskne se název), v nápovědách názvem dokumentu.
- Doplněny `brief.json` a `draw.json` (generátor je potřebuje, obsah hry neovlivňují).

## Co musí opravit ChatGPT (obsah)

Každý řádek: pravidlo, soubor a místo, zpráva kontroly. Opravy se týkají jen uvedeného místa.

- **leaks.answer_in_title** – `documents/D14.md` `fields.cause_of_death`: The answer of P3 ('hlavy') appears in the field 'cause_of_death' of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **leaks.answer_in_title** – `documents/D14.md` `fields.cause_of_death`: The answer of P3 ('poranenihlavy') appears in the field 'cause_of_death' of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **leaks.answer_in_title** – `documents/D14.md` `fields.cause_of_death`: The answer of P3 ('tupeporanenihlavy') appears in the field 'cause_of_death' of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P1.yaml` `reveal_text`: The reveal_text of P1 contains its answer 't04'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P2.yaml` `leak_allowlist`: The answer of P2 ('1915') appears in the text of D13 (documents/D13.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P2.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P2.yaml` `reveal_text`: The reveal_text of P2 contains its answer '1915'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P3.yaml` `leak_allowlist`: The answer of P3 ('hlavy') appears in the text of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P3.yaml` `leak_allowlist`: The answer of P3 ('poranenihlavy') appears in the text of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P3.yaml` `leak_allowlist`: The answer of P3 ('tupeporanenihlavy') appears in the text of D14 (documents/D14.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P3.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P3.yaml` `reveal_text`: The reveal_text of P3 contains its answer 'hlavy'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **hints.reveal_names_answer** – `puzzles/P4.yaml` `reveal_text`: The reveal_text of P4 contains its answer '25'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **hints.reveals_later_answer** – `puzzles/P5.yaml` `hints.2.text`: Hint 3 of P5 contains 'osm', the answer of P9 in the later stage E. Návrh: Rephrase the hint so that it does not name the answer of a later puzzle.
- **hints.reveal_names_answer** – `puzzles/P5.yaml` `reveal_text`: The reveal_text of P5 contains its answer '2118'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P6.yaml` `leak_allowlist`: The answer of P6 ('2124') appears in the text of D23 (documents/D23.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P6.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P6.yaml` `leak_allowlist`: The answer of P6 ('2124') appears in the text of D30 (documents/D30.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P6.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P6.yaml` `leak_allowlist`: The answer of P6 ('2124') appears in the text of D32 (documents/D32.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P6.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P6.yaml` `leak_allowlist`: The answer of P6 ('212400') appears in the text of D32 (documents/D32.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P6.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P6.yaml` `leak_allowlist`: The answer of P6 ('2124') appears in the text of D35 (documents/D35.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P6.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P6.yaml` `reveal_text`: The reveal_text of P6 contains its answer '2124'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P7.yaml` `leak_allowlist`: The answer of P7 ('187600') appears in the text of D43 (documents/D43.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P7.yaml with the reason.
- **leaks.answer_in_text** – `puzzles/P7.yaml` `leak_allowlist`: The answer of P7 ('187600kc') appears in the text of D43 (documents/D43.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P7.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P7.yaml` `reveal_text`: The reveal_text of P7 contains its answer '187600'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P8.yaml` `leak_allowlist`: The answer of P8 ('bt552') appears in the text of D44 (documents/D44.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P8.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P8.yaml` `reveal_text`: The reveal_text of P8 contains its answer 'bt552'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **leaks.answer_in_text** – `puzzles/P9.yaml` `leak_allowlist`: The answer of P9 ('8minut') appears in the text of D27 (documents/D27.md), which players read before they solve it. Návrh: Rephrase the text so that it does not contain the answer. If the text must contain it, add the passage to `leak_allowlist` in puzzles/P9.yaml with the reason.
- **hints.reveal_names_answer** – `puzzles/P9.yaml` `reveal_text`: The reveal_text of P9 contains its answer 'osm'. The story card prints it for players on paper, who may read it before they solve the puzzle. Návrh: Tell what the answer means for the case without the answer itself.
- **registry.two_places** – `story.yaml` `timeline.2`: Bořek Vítek is at 'hospoda' (spor-dodavatel) and at 'kunstat' (vztah) at the same time. Nobody can be in two places at once. Návrh: Change the times, the location, or the participants of one of the two events.
- **registry.two_places** – `story.yaml` `timeline.3`: Lenka Šimková is at 'kunstat' (vztah) and at 'koupaliste-kunstat' (nesrovnalosti) at the same time. Nobody can be in two places at once. Návrh: Change the times, the location, or the participants of one of the two events.
- **deduction.puzzles_not_needed** – `story.yaml` `deduction.questions.0.proven_by`: The accusation question 'kdo' cites no hidden clue that a puzzle reveals, so players can answer it without solving the puzzles. Návrh: Add a hidden clue (hidden: true, revealed_by: <puzzle id>) whose quote states the fact that the puzzle reveals, and cite it in proven_by of the question.
- **deduction.puzzles_not_needed** – `story.yaml` `deduction.questions.1.proven_by`: The accusation question 'jak' cites no hidden clue that a puzzle reveals, so players can answer it without solving the puzzles. Návrh: Add a hidden clue (hidden: true, revealed_by: <puzzle id>) whose quote states the fact that the puzzle reveals, and cite it in proven_by of the question.
- **deduction.puzzles_not_needed** – `story.yaml` `deduction.questions.2.proven_by`: The accusation question 'proc' cites no hidden clue that a puzzle reveals, so players can answer it without solving the puzzles. Návrh: Add a hidden clue (hidden: true, revealed_by: <puzzle id>) whose quote states the fact that the puzzle reveals, and cite it in proven_by of the question.
- **deduction.puzzles_not_needed** – `story.yaml` `deduction.questions.3.proven_by`: The accusation question 'dukaz' cites no hidden clue that a puzzle reveals, so players can answer it without solving the puzzles. Návrh: Add a hidden clue (hidden: true, revealed_by: <puzzle id>) whose quote states the fact that the puzzle reveals, and cite it in proven_by of the question.
- **deduction.culprit_by_elimination** – `story.yaml` `deduction.exclusions`: Plain clues alone clear every innocent suspect, so players can name the culprit by elimination without solving a puzzle. Návrh: Clear at least one innocent suspect only with a hidden clue that a puzzle reveals: cite it in that exclusion, and make sure that no plain document clears this suspect on its own.
- **references.internal_id** – `story.yaml` `deduction.questions.3.options.0.text`: A text that players read names the internal ids D23, which no printed page shows. Návrh: Name the printed puzzle code (A1, B2) or the document title instead, or write {{doc:<document id>}} in a document.
- **references.internal_id** – `story.yaml` `deduction.questions.3.options.1.text`: A text that players read names the internal ids D25, D42, which no printed page shows. Návrh: Name the printed puzzle code (A1, B2) or the document title instead, or write {{doc:<document id>}} in a document.
- **references.internal_id** – `story.yaml` `deduction.questions.3.options.2.text`: A text that players read names the internal ids D2, D29, D53, D54, D55, which no printed page shows. Návrh: Name the printed puzzle code (A1, B2) or the document title instead, or write {{doc:<document id>}} in a document.
- **references.internal_id** – `story.yaml` `deduction.questions.3.options.3.text`: A text that players read names the internal ids D28, D36, which no printed page shows. Návrh: Name the printed puzzle code (A1, B2) or the document title instead, or write {{doc:<document id>}} in a document.
- **references.internal_id** – `story.yaml` `deduction.questions.3.options.4.text`: A text that players read names the internal ids D20, D19, which no printed page shows. Návrh: Name the printed puzzle code (A1, B2) or the document title instead, or write {{doc:<document id>}} in a document.

## Upozornění (doporučeno opravit)

- references.free_text – `documents/D26.md`: The document D26 writes 'obálka C' as plain text.
- references.free_text – `documents/D39.md`: The document D39 writes 'obálku D' as plain text.
- references.free_text – `documents/D47.md`: The document D47 writes 'dokumenty
21' as plain text.
- references.free_text – `documents/D50.md`: The document D50 writes 'dokumentu  21' as plain text.
- budget.document_words – `documents/D54.md`: The document D54 has 612 words; the adults audience allows 600 words per document.
- budget.document_words – `documents/D55.md`: The document D55 has 743 words; the adults audience allows 600 words per document.
- budget.document_words – `documents/D63.md`: The document D63 has 780 words; the adults audience allows 600 words per document.
- leaks.short_answer – `puzzles/P1.yaml`: The answer of P1 has fewer than 4 letters or digits, so the leak check cannot search for it.
- leaks.short_answer – `puzzles/P10.yaml`: The answer of P10 has fewer than 4 letters or digits, so the leak check cannot search for it.
- leaks.short_answer – `puzzles/P4.yaml`: The answer of P4 has fewer than 4 letters or digits, so the leak check cannot search for it.
- leaks.short_answer – `puzzles/P9.yaml`: The answer of P9 has fewer than 4 letters or digits, so the leak check cannot search for it.

## Vysvětlení nejčastějších pravidel

- `leaks.answer_in_text` / `answer_in_title`: odpověď úkolu je čitelná v textu, který hráči mají dřív, než úkol vyřeší. Přeformulovat text, nebo odpověď změnit.
- `hints.reveal_names_answer`: nápověda (kromě poslední) nebo text po vyřešení obsahuje odpověď. Přepsat bez odpovědi.
- `deduction.culprit_by_elimination`: pachatel jde určit jen vylučováním z volných stop, úkoly nejsou potřeba. Některou vylučující stopu skrýt za úkol (hidden clue).
- `deduction.puzzles_not_needed`: otázka obvinění jde zodpovědět bez úkolů. Do `proven_by` přidat skrytou stopu, kterou odhalí úkol.
- `registry.two_places`: postava je v časové ose na dvou místech zároveň. Opravit časy nebo místa.
- `references.internal_id`: text pro hráče jmenuje vnitřní číslo dokumentu (D23). V možnostech obvinění nahradit popisem dokumentu (do 120 znaků).
