"""The evidence archive of the player companion: every document that players print, to read on a TV or a phone.

The archive groups the documents by envelope. A document keeps its printed look: the archive holds the HTML of its
sheets, cut from the rendered materials, plus the theme CSS once. Four digital kinds (chat log, phone records, email,
camera still) also get the data of a device screen, which the page draws like a phone or a camera player.

An envelope that does not open at the start is sealed (`mystery_forge.sealing`) with the answer that opens it, so the
page can show it only after players solve that puzzle. The archive never holds a solution, a hint, or the truth.
"""

import json
import re
from html.parser import HTMLParser
from typing import Any, Final

from mystery_forge.game import AssembledDocument, Game
from mystery_forge.i18n import text
from mystery_forge.render.document_body import insert_artifacts, insert_images, speaker_lines
from mystery_forge.render.html import render_output_html
from mystery_forge.render.materials import DocumentPage, document_sort_key, materials_sheets
from mystery_forge.render.sheets import OutputPlan, Sheet, number_sheets_by_stage
from mystery_forge.render.themes import StyleSettings
from mystery_forge.sealing import lock_text

SECTION_START: Final[str] = '<section class="sheet'
STYLE_PATTERN: Final[re.Pattern[str]] = re.compile(r"<style>\n?(.*?)</style>", re.DOTALL)
BODY_CLASS_PATTERN: Final[re.Pattern[str]] = re.compile(r'<body class="([^"]*)"')
SCREEN_KINDS: Final[dict[str, str]] = {
    "chat-log": "chat",
    "phone-records": "calls",
    "email": "email",
    "cctv-still": "camera",
}
# The pages outside the envelopes that help players read the case. The register, the story cards, and the accusation
# form stay off the archive: the companion page checks answers and takes the accusation itself.
HELPER_ROLES: Final[tuple[str, ...]] = ("characters",)
HELPERS_ID: Final[str] = "characters"


class TableReader(HTMLParser):
    """Read the cells of the first table of a document body as plain text."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self.cell: list[str] | None = None
        self.tables: int = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.tables += 1
        elif self.tables == 1 and tag == "tr":
            self.rows.append([])
        elif self.tables == 1 and tag in ("td", "th"):
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if self.tables == 1 and tag in ("td", "th") and self.cell is not None and self.rows:
            self.rows[-1].append(" ".join("".join(self.cell).split()))
            self.cell = None

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)


def table_rows(body_html: str) -> list[list[str]]:
    reader = TableReader()
    reader.feed(body_html)
    return [row for row in reader.rows if row]


def sheet_sections(html: str, count: int) -> list[str]:
    """Cut the rendered output into the HTML of each sheet, in plan order."""
    parts: list[str] = html.split(SECTION_START)[1:]
    sections: list[str] = [SECTION_START + part.split("</section>")[0] + "</section>" for part in parts]
    if len(sections) != count:
        raise ValueError(f"The materials have {count} sheets, but the HTML has {len(sections)} sections.")
    return sections


def screen_view(document: AssembledDocument, body_html: str) -> dict[str, Any] | None:
    """The data of a device screen for a digital document, or None for a paper document."""
    screen: str | None = SCREEN_KINDS.get(document.meta.kind)
    if screen is None:
        return None
    view: dict[str, Any] = {"type": screen, "fields": document.meta.fields}
    if screen == "chat":
        view["messages"] = [{"speaker": line.speaker, "html": str(line.html)} for line in speaker_lines(body_html)]
    elif screen == "calls":
        rows: list[list[str]] = table_rows(body_html)
        view["header"] = rows[0] if rows else []
        view["rows"] = rows[1:]
    else:
        view["html"] = body_html
    return view


def document_entry(game: Game, document: AssembledDocument, sheets: list[str]) -> dict[str, Any]:
    artifacts = {puzzle.source.id: puzzle.artifact for puzzle in game.puzzles}
    body: str = insert_images(insert_artifacts(document.body_html, artifacts), game.images)
    return {
        "id": document.meta.id,
        "kind": document.meta.kind,
        "title": document.meta.title,
        "sheets": sheets,
        "screen": screen_view(document, body),
    }


def build_archive(game: Game, settings: StyleSettings) -> dict[str, Any]:
    """Return the archive data of the player companion, with every envelope after the first one sealed."""
    language: str = game.config.language
    sheets: list[Sheet] = number_sheets_by_stage(materials_sheets(game))
    html: str = render_output_html(
        OutputPlan(id="materials", sheets=sheets), settings, game.story.title, language, game.config.players.count == 1
    )
    sections: list[str] = sheet_sections(html, len(sheets))
    by_document: dict[str, list[str]] = {}
    helpers: list[str] = []
    for sheet, section in zip(sheets, sections, strict=True):
        if isinstance(sheet.content, DocumentPage):
            by_document.setdefault(sheet.content.document_id, []).append(section)
        elif sheet.role in HELPER_ROLES:
            helpers.append(section)
    accepted: dict[str, list[str]] = {puzzle.source.id: puzzle.accepted_normalized for puzzle in game.puzzles}
    stages: list[dict[str, Any]] = []
    for index, stage in enumerate(game.flow.stages):
        documents: list[AssembledDocument] = sorted(
            (document for document in game.documents if document.meta.stage == stage.id), key=document_sort_key
        )
        entries: list[dict[str, Any]] = [
            document_entry(game, document, by_document.get(document.meta.id, [])) for document in documents
        ]
        if index == 0 and helpers:
            entries.append(
                {"id": HELPERS_ID, "kind": "characters", "title": text(language, "characters_title"),
                 "sheets": helpers, "screen": None}
            )  # fmt: skip
        envelope: str = text(language, "envelope_label", stage=stage.id)
        if stage.opens_with == "start":
            stages.append({"id": stage.id, "envelope": envelope, "label": stage.label, "documents": entries,
                           "lock": None})  # fmt: skip
            continue
        content: str = json.dumps({"label": stage.label, "documents": entries}, ensure_ascii=False)
        lock = lock_text(content, game.salt, f"stage:{stage.id}", accepted[stage.opens_with])
        stages.append({"id": stage.id, "envelope": envelope, "label": "", "documents": None, "lock": lock.as_json()})
    style: re.Match[str] | None = STYLE_PATTERN.search(html)
    body_class: re.Match[str] | None = BODY_CLASS_PATTERN.search(html)
    return {
        "css": style.group(1) if style else "",
        "body_class": body_class.group(1) if body_class else "",
        "stages": stages,
    }
