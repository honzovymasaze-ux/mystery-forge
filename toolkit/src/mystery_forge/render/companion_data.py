"""The companion page: one offline HTML file that checks answers, gives hints, and scores the accusation.

The page must work from `file://` in every browser, so this module inlines every script, the style sheet, and the
game data into one HTML string. The data never holds an answer in plain text, except inside the solutions, which the
page shows only after a confirm: answers, near misses, and the correct accusation options are salted hashes
(`mystery_forge.answers.answer_hash`), and the page hashes what players type in the same way.
"""

import base64
import json
from importlib.resources import files
from importlib.resources.abc import Traversable
from typing import Any, Final

from jinja2 import Environment, StrictUndefined

from mystery_forge.answers import answer_hash, normalize_answer
from mystery_forge.game import AssembledPuzzle, Game
from mystery_forge.i18n import STRINGS, known_language, text, text_direction
from mystery_forge.render.archive import build_archive
from mystery_forge.render.themes import style_settings
from mystery_forge.sealing import lock_text
from mystery_forge.spec.models import AccusationQuestion, Deduction, Investigation

COMPANION_FOLDER: Final[str] = "companion"
TEMPLATE_FILE: Final[str] = "companion.html.j2"
# In the order that the page loads them: the logic files must exist before the app file runs.
STYLE_FILE: Final[str] = "companion.css"
SCRIPT_FILES: Final[tuple[str, ...]] = ("answers.js", "sealing.js", "qrcode.js", "companionLogic.js", "companionApp.js")
COMPANION_STATIC_FILES: Final[tuple[str, ...]] = (STYLE_FILE, *SCRIPT_FILES)
COMPANION_TEXT_PREFIX: Final[str] = "companion_"
BOARD_ART_FOLDER: Final[str] = "board-art"
# The board art files and the CSS property that each one fills (companion/board-art/README.md).
BOARD_ART: Final[dict[str, str]] = {
    "background": "--board-background",
    "pin": "--board-pin",
    "sticky": "--board-sticky",
    "stamp-cleared": "--board-stamp-cleared",
}
ART_MEDIA_TYPES: Final[dict[str, str]] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}
DATA_FORMAT_VERSION: Final[int] = 1
# The lock of the sealed endings: the correct option of the first accusation question opens it.
ENDING_LOCK_LABEL: Final[str] = "accusation"


def build_companion_data(game: Game) -> dict[str, Any]:
    """Return the JSON-serializable data that the companion page reads."""
    codes: dict[str, str] = {puzzle.source.id: puzzle.code for puzzle in game.puzzles}
    unlocks: dict[str, str] = {stage.opens_with: stage.id for stage in game.flow.stages if stage.opens_with != "start"}
    puzzles: list[AssembledPuzzle] = sorted(
        game.puzzles, key=lambda puzzle: (puzzle.source.stage, int(puzzle.code[1:]))
    )
    final_puzzle: str | None = game.flow.final_puzzle
    return {
        "format_version": DATA_FORMAT_VERSION,
        "title": game.story.title,
        "tagline": game.story.tagline,
        "intro": game.story.intro,
        "language": game.config.language,
        "salt": game.salt,
        "duration_minutes": game.config.duration_minutes,
        # The solver panel does not exist yet; the page reads this flag once it does.
        "panel_verified": True,
        "final_puzzle": codes[final_puzzle] if final_puzzle is not None else None,
        "ui": companion_texts(game.config.language),
        "stages": [
            {
                "id": stage.id,
                "label": stage.label,
                "envelope": text(game.config.language, "envelope_label", stage=stage.id),
                "opens_with": "start" if stage.opens_with == "start" else codes[stage.opens_with],
                "opening_text": stage.opening_text,
            }
            for stage in game.flow.stages
        ],
        "puzzles": [puzzle_data(puzzle, unlocks.get(puzzle.source.id), game) for puzzle in puzzles],
        "deduction": deduction_data(game.story.deduction, game.salt),
        "epilogues": [
            {"min_score_percent": epilogue.min_score_percent, "title": epilogue.title, "text": epilogue.text}
            for epilogue in sorted(game.story.epilogues, key=lambda epilogue: -epilogue.min_score_percent)
        ],
        "reveal": [step.text for step in game.story.reveal],
        "investigation": investigation_data(game, codes),
        "player": False,
        "archive": None,
        "ending_lock": None,
    }


def build_player_companion_data(game: Game, archive: dict[str, Any]) -> dict[str, Any]:
    """Return the data of the player companion: the archive of documents, and no solution in readable form.

    The page on the TV and on the phones must not spoil the game for the players who run it. So it drops every
    solution and the answer step of the hints, and it seals the endings and the reveal with the correct option of the
    first accusation question (usually "who"), or with the answer of the final puzzle in a game without an accusation.
    Only the lowest ending stays readable: a group that names the wrong person reads it. The full answers stay in
    the spoiler PDF files for a host.
    """
    data: dict[str, Any] = build_companion_data(game)
    for puzzle in data["puzzles"]:
        puzzle["solution"] = None
    endings: list[dict[str, Any]] = data["epilogues"]
    sealed: dict[str, Any] = {"epilogues": endings[:-1], "reveal": data["reveal"]}
    keys: list[str] = ending_keys(game)
    if not keys:
        return {**data, "archive": archive, "player": True}
    data["epilogues"] = endings[-1:]
    data["reveal"] = []
    data["ending_lock"] = lock_text(
        json.dumps(sealed, ensure_ascii=False), game.salt, ENDING_LOCK_LABEL, keys
    ).as_json()
    data["archive"] = archive
    data["player"] = True
    return data


def ending_keys(game: Game) -> list[str]:
    """The answers that open the sealed endings: the correct option of the first accusation question, or else the
    accepted answers of the final puzzle. A game with neither keeps its endings readable."""
    deduction: Deduction | None = game.story.deduction
    if deduction is not None:
        return [deduction.questions[0].correct]
    final: list[AssembledPuzzle] = [puzzle for puzzle in game.puzzles if puzzle.source.id == game.flow.final_puzzle]
    return final[0].accepted_normalized if final else []


def investigation_data(game: Game, codes: dict[str, str]) -> dict[str, Any] | None:
    """The investigator's story and the voice messages, in the order that players meet them.

    Each entry comes with its envelope. Within an envelope, the entries that need no puzzle come first, then the ones
    that wait for a puzzle, by puzzle code. A voice message carries its recording as a data URI, or an empty text when
    the page must read it with the speech voice.
    """
    investigation: Investigation | None = game.investigation
    if investigation is None:
        return None
    stage_order: dict[str, int] = {stage.id: index for index, stage in enumerate(game.flow.stages)}
    entries: list[tuple[tuple[int, int, int, int], dict[str, Any]]] = []
    for index, chapter in enumerate(investigation.chapters):
        entry: dict[str, Any] = {
            "type": "chapter",
            "id": chapter.id,
            "stage": chapter.stage,
            "after": codes.get(chapter.after) if chapter.after is not None else None,
            "title": chapter.title,
            "text": chapter.text,
        }
        entries.append((entry_order(entry, stage_order, 0, index), entry))
    for index, message in enumerate(investigation.voice_messages):
        entry = {
            "type": "voice",
            "id": message.id,
            "stage": message.stage,
            "after": codes.get(message.after) if message.after is not None else None,
            "sender": message.sender,
            "role": message.role,
            "voice": message.voice,
            "text": message.text,
            "audio": game.audio.get(message.id, ""),
        }
        entries.append((entry_order(entry, stage_order, 1, index), entry))
    return {
        "narrator": {"name": investigation.narrator.name, "role": investigation.narrator.role},
        "entries": [entry for _, entry in sorted(entries, key=lambda pair: pair[0])],
    }


def entry_order(entry: dict[str, Any], stage_order: dict[str, int], kind: int, index: int) -> tuple[int, int, int, int]:
    after: str | None = entry["after"]
    puzzle_number: int = int(after[1:]) if after is not None else 0
    return (stage_order.get(entry["stage"], len(stage_order)), puzzle_number, kind, index)


def companion_texts(language: str) -> dict[str, str]:
    strings: dict[str, str] = STRINGS[known_language(language)]
    return {
        key.removeprefix(COMPANION_TEXT_PREFIX): value
        for key, value in strings.items()
        if key.startswith(COMPANION_TEXT_PREFIX)
    }


def puzzle_data(puzzle: AssembledPuzzle, unlocks: str | None, game: Game) -> dict[str, Any]:
    language: str = game.config.language
    source = puzzle.source
    return {
        "code": puzzle.code,
        "title": source.title,
        "stage": source.stage,
        "answer_format": source.answer_format.label,
        "answer_hashes": [answer_hash(answer, game.salt) for answer in puzzle.accepted_normalized],
        "near_misses": [
            {"hash": answer_hash(normalize_answer(near_miss.answer, language), game.salt), "message": near_miss.message}
            for near_miss in source.near_misses
        ],
        "unlocks": unlocks,
        "hints": [{"level": hint.level, "text": hint.text} for hint in source.hints],
        "solution": {"steps": [step.text for step in source.solution], "answer": source.answer},
        "reveal_text": source.reveal_text,
    }


def deduction_data(deduction: Deduction | None, salt: str) -> dict[str, Any] | None:
    if deduction is None:
        return None
    return {"questions": [question_data(question, salt) for question in deduction.questions]}


def question_data(question: AccusationQuestion, salt: str) -> dict[str, Any]:
    return {
        "id": question.id,
        "prompt": question.prompt,
        "options": [{"id": option.id, "text": option.text} for option in question.options],
        # The question id is part of the hashed text, so two questions that share option ids get different hashes.
        "correct_hash": answer_hash(f"{question.id}:{question.correct}", salt),
        "points": question.points,
    }


def script_safe_json(value: Any) -> str:
    """Return JSON that cannot end its `<script>` element early, whatever text the story holds."""
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "\\u003c!--")


def board_art_css(folder: Traversable) -> str:
    """Return the CSS that fills the board art properties with the image files of the folder, as data URIs."""
    declarations: list[str] = []
    if folder.is_dir():
        entries: dict[str, Traversable] = {entry.name: entry for entry in folder.iterdir()}
        for stem, prop in BOARD_ART.items():
            for suffix, media_type in ART_MEDIA_TYPES.items():
                entry: Traversable | None = entries.get(f"{stem}{suffix}")
                if entry is not None:
                    encoded: str = base64.b64encode(entry.read_bytes()).decode("ascii")
                    declarations.append(f"{prop}:url(data:{media_type};base64,{encoded})")
                    break
    return f":root{{{';'.join(declarations)}}}" if declarations else ""


def build_player_companion_html(game: Game, art_folder: Traversable | None = None) -> str:
    """Return the player companion: the page for the TV app and the phones, with the archive and no solutions."""
    archive: dict[str, Any] = build_archive(game, style_settings(game, None))
    folder: Traversable = art_folder or files("mystery_forge.render").joinpath(COMPANION_FOLDER, BOARD_ART_FOLDER)
    return companion_html(game, build_player_companion_data(game, archive), board_art_css(folder))


def build_companion_html(game: Game) -> str:
    """Return the whole companion page as one self-contained HTML string."""
    return companion_html(game, build_companion_data(game))


def companion_html(game: Game, data: dict[str, Any], art_css: str = "") -> str:
    folder: Traversable = files("mystery_forge.render").joinpath(COMPANION_FOLDER)
    environment = Environment(autoescape=True, undefined=StrictUndefined, keep_trailing_newline=True)
    template = environment.from_string(folder.joinpath(TEMPLATE_FILE).read_text(encoding="utf-8"))
    return template.render(
        language=game.config.language,
        direction=text_direction(game.config.language),
        title=game.story.title,
        style=folder.joinpath(STYLE_FILE).read_text(encoding="utf-8") + art_css,
        scripts=[folder.joinpath(name).read_text(encoding="utf-8") for name in SCRIPT_FILES],
        data_json=script_safe_json(data),
    )
