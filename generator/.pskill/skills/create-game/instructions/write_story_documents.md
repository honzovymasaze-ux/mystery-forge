Write the story documents of the game in `{{ steps.setup.json.game_dir }}`: every entry of `story_documents` in `source/plan.yaml`.

Read first: `source/config.json`, `source/draw.json` (the audience rule), `source/story.yaml`, `source/flow.yaml`, `source/plan.yaml`, `uv run --project ../toolkit forge schema document`, and `uv run --project ../toolkit forge schema references`.

For each planned story document, write `source/documents/<id>.md` with the Write tool (a long shell command fails on Windows): front matter (`format_version: 1`, `id`, `kind`, `stage`, `title`, and the `fields` that its kind uses, such as `sender` and `date` for a letter) and a body in the game language. Write no `puzzle` field: a story document prints no puzzle badge.
- Include every sentence of its `must_contain` list word for word.
- Make each document feel real for its kind: a police report reads like a police report, a receipt like a receipt. Use `{{ '{{char:<id>}}' }}` and the other references for names, places, and dates, so every document agrees with the registry.
- Keep the reading budget: the audience rule's words per document, and `brief.json` → `reading_words` for the whole game.
- Add texture that rewards close readers. Never add a fact that contradicts `story.yaml`, never reveal a puzzle answer or a hidden clue (not in clear text, not in other words, and not together with another document), and never write the culprit's confession or written plan.
- When `config.json` sets `equipment.printer` to `black_and_white`, no clue depends on a color, and no text names a printed color ("ruled off in red").
- Every document needs a story reason to be in the players' hands (the intro or another document says how they got it).
- You may add simple SVG illustrations in `source/images/<id>.svg` (stamps, maps, logos, diagrams) and place them with `{{ '{{image:<id>|caption}}' }}`. Use `currentColor` and plain shapes; no scripts, no external links, no raster images.

- When the config format is `case_file` or `both`, make the papers look like a real police file: follow section 15 of `uv run --project ../toolkit forge catalog rules` (autopsy and lab reports, phone records, invoices, interview transcripts, a `person-photo` for each suspect and key witness, camera stills).

Then write `source/investigation.yaml` with the Write tool (fields: `uv run --project ../toolkit forge schema investigation`; rules: section 15 of the catalog rules):
- `narrator`: the lead investigator, with a name and a rank or role that fit the setting. Players are the investigator's team.
- `chapters`: the investigator's story in the first person, in the game language. At least one chapter without `after` per envelope (it prints behind the STOP sheet), plus up to one chapter per envelope that waits for a puzzle of that envelope (`after: P<n>`, from `plan.yaml`).
- `voice_messages`: 1 to 3 per envelope from colleagues of the team (`sender`, `role`, `voice: male` or `female`). Give some of them `after` a puzzle, so new messages arrive as the group progresses.
- Never put a puzzle answer, a hidden clue, or a fact that only this file gives into a chapter or a message. Point to the documents instead.

Then run `uv run --project ../toolkit forge assemble --game {{ steps.setup.json.game_dir }}` and fix every error in your files (errors in puzzle files that do not exist yet are expected). Your answer lists the files that you wrote (the documents and `investigation.yaml`), with a spoiler-free summary.
