# Board art

Image files for the evidence board of the player companion. `companion_data.py` inlines each file that exists as a
CSS property. A missing file keeps the plain fallback color of `companion.css`.

| File (PNG, JPG, WebP, or SVG) | CSS property            | What it shows                                    |
| ----------------------------- | ----------------------- | ------------------------------------------------ |
| `background.*`                | `--board-background`    | The board surface behind the cards (cork, noir). |
| `pin.*`                       | `--board-pin`           | The pin at the top of a pinned card, square.     |
| `sticky.*`                    | `--board-sticky`        | The paper of a sticky note, behind its text.     |
| `stamp-cleared.*`             | `--board-stamp-cleared` | The stamp over a cleared person.                 |
