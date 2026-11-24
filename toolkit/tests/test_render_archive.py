"""The evidence archive and the player companion: printed sheets, device screens, sealed envelopes, no solutions."""

import json
from pathlib import Path
from typing import Any

import pytest
from test_render_support import golden_game, showcase_game

from mystery_forge.answers import normalize_answer
from mystery_forge.game import Game
from mystery_forge.render.archive import build_archive, screen_view, sheet_sections, table_rows
from mystery_forge.render.companion_data import (
    board_art_css,
    build_companion_data,
    build_player_companion_data,
    build_player_companion_html,
    ending_keys,
)
from mystery_forge.render.themes import style_settings
from mystery_forge.sealing import answer_key, key_check, open_text, xor_hex


def archive_of(game: Game) -> dict[str, Any]:
    return build_archive(game, style_settings(game, None))


def open_stage(game: Game, stage: dict[str, Any], answer: str) -> dict[str, Any]:
    lock = stage["lock"]
    for wrap in lock["wraps"]:
        key = xor_hex(wrap, answer_key(game.salt, lock["label"], answer))
        if key_check(key) == lock["check"]:
            content: dict[str, Any] = json.loads(open_text(lock["payload"], key))
            return content
    raise AssertionError("no wrap fits")


def test_the_first_envelope_is_open_and_holds_its_printed_documents_and_the_character_files() -> None:
    game = showcase_game()
    archive = archive_of(game)
    first = archive["stages"][0]
    assert first["lock"] is None
    ids = [document["id"] for document in first["documents"]]
    assert "D10" in ids
    assert ids[-1] == "characters"
    letter = next(document for document in first["documents"] if document["kind"] == "letter")
    assert letter["screen"] is None
    assert all(sheet.startswith('<section class="sheet') for sheet in letter["sheets"])
    assert "@font-face" in archive["css"]
    assert "theme-" in archive["body_class"]


def test_a_later_envelope_is_sealed_and_opens_with_any_accepted_answer() -> None:
    game = golden_game()
    sealed = archive_of(game)["stages"][1]
    assert sealed["documents"] is None
    assert sealed["label"] == ""
    opener = next(puzzle for puzzle in game.puzzles if puzzle.source.id == game.flow.stages[1].opens_with)
    for answer in opener.accepted_normalized:
        content = open_stage(game, sealed, answer)
        assert content["label"] == game.flow.stages[1].label
        assert [document["id"] for document in content["documents"]]
    assert opener.accepted_normalized[0] not in json.dumps(sealed)


def test_digital_documents_carry_their_device_screen() -> None:
    documents = {document["kind"]: document for document in archive_of(showcase_game())["stages"][0]["documents"]}
    chat = documents["chat-log"]["screen"]
    assert chat["type"] == "chat"
    assert [message["speaker"] for message in chat["messages"]] == ["Felix", "Tom"]
    calls = documents["phone-records"]["screen"]
    assert calls["header"] == ["Time", "Called", "Seconds", "Cell"]
    assert calls["rows"] == [["21:14", "555 0177", "64", "WREN-3"]]
    assert documents["email"]["screen"]["type"] == "email"
    camera = documents["cctv-still"]["screen"]
    assert camera["type"] == "camera"
    assert "<svg" in camera["html"]
    assert camera["fields"]["camera"] == "CAM 02"


def test_a_phone_record_without_a_table_has_no_rows() -> None:
    game = showcase_game()
    document = next(document for document in game.documents if document.meta.kind == "phone-records")
    view = screen_view(document, "<p>No table.</p>")
    assert view == {"type": "calls", "fields": document.meta.fields, "header": [], "rows": []}


def test_table_rows_read_only_the_first_table_and_skip_empty_rows() -> None:
    html = (
        "<p>x</p><table><tr><th>A</th><th>B </th></tr><tr></tr><tr><td>1</td><td>2 <b>x</b></td></tr></table>"
        "<table><tr><td>other</td></tr></table>"
    )
    assert table_rows(html) == [["A", "B"], ["1", "2 x"]]


def test_the_sheet_count_must_match_the_rendered_sections() -> None:
    assert sheet_sections('<section class="sheet a"></section><section class="sheet b">x</section>', 2) == [
        '<section class="sheet a"></section>',
        '<section class="sheet b">x</section>',
    ]
    with pytest.raises(ValueError, match="3 sheets"):
        sheet_sections('<section class="sheet a"></section>', 3)


def test_the_player_data_holds_no_solution_and_seals_the_endings() -> None:
    game = golden_game()
    full = build_companion_data(game)
    assert full["player"] is False
    assert full["archive"] is None
    player = build_player_companion_data(game, {"stages": []})
    assert player["player"] is True
    assert all(puzzle["solution"] is None for puzzle in player["puzzles"])
    assert player["reveal"] == []
    assert len(player["epilogues"]) == 1
    assert player["epilogues"][0]["min_score_percent"] == min(
        epilogue.min_score_percent for epilogue in game.story.epilogues
    )
    lock = player["ending_lock"]
    assert lock["label"] == "accusation"
    assert game.story.deduction is not None
    key = xor_hex(lock["wraps"][0], answer_key(game.salt, "accusation", game.story.deduction.questions[0].correct))
    sealed = json.loads(open_text(lock["payload"], key))
    assert len(sealed["epilogues"]) == len(game.story.epilogues) - 1
    assert sealed["reveal"] == [step.text for step in game.story.reveal]


def test_a_game_without_an_accusation_seals_its_endings_with_the_final_answer() -> None:
    game = golden_game()
    no_deduction = game.model_copy(update={"story": game.story.model_copy(update={"deduction": None})})
    final = next(puzzle for puzzle in game.puzzles if puzzle.source.id == game.flow.final_puzzle)
    assert ending_keys(no_deduction) == final.accepted_normalized
    open_game = no_deduction.model_copy(update={"flow": game.flow.model_copy(update={"final_puzzle": None})})
    assert ending_keys(open_game) == []
    player = build_player_companion_data(open_game, {"stages": []})
    assert player["ending_lock"] is None
    assert len(player["epilogues"]) == len(game.story.epilogues)
    assert player["player"] is True


def test_the_player_page_holds_the_archive_and_no_answer_in_clear_text() -> None:
    game = golden_game()
    html = build_player_companion_html(game)
    assert '"player": true' in html
    assert "sealing.js" not in html
    assert "MysteryForgeSealing" in html
    assert "MysteryForgeQrCode" in html
    answer = normalize_answer(game.puzzles[-1].source.answer, game.config.language)
    assert f'"answer": "{game.puzzles[-1].source.answer}"' not in html
    assert answer


def test_the_board_people_are_the_suspects_and_the_victim_without_the_culprit_flag() -> None:
    game = golden_game()
    people = archive_of(game)["people"]
    expected = [character.id for character in game.story.characters if character.is_suspect or character.is_victim]
    assert [person["id"] for person in people] == expected
    assert all(set(person) == {"id", "name", "role", "portrait", "victim"} for person in people)


def test_board_art_fills_the_css_properties_with_the_files_that_exist(tmp_path: Path) -> None:
    assert board_art_css(tmp_path / "missing") == ""
    assert board_art_css(tmp_path) == ""
    (tmp_path / "pin.png").write_bytes(b"png")
    (tmp_path / "sticky.svg").write_bytes(b"<svg/>")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")
    css = board_art_css(tmp_path)
    assert (
        css
        == ":root{--board-pin:url(data:image/png;base64,cG5n);--board-sticky:url(data:image/svg+xml;base64,PHN2Zy8+)}"
    )
    html = build_player_companion_html(golden_game(), tmp_path)
    assert "--board-pin:url(data:image/png" in html


def test_a_document_that_waits_for_a_puzzle_is_sealed_inside_its_envelope() -> None:
    game = golden_game()
    first = game.puzzles[0]
    waiting = game.documents[0].meta.model_copy(update={"after": first.source.id})
    unknown = game.documents[1].meta.model_copy(update={"after": "P9"})
    documents = [
        game.documents[0].model_copy(update={"meta": waiting}),
        game.documents[1].model_copy(update={"meta": unknown}),
        *game.documents[2:],
    ]
    stage = archive_of(game.model_copy(update={"documents": documents}))["stages"][0]
    sealed = next(entry for entry in stage["documents"] if entry["id"] == waiting.id)
    assert set(sealed) == {"id", "after", "lock"}
    assert sealed["after"] == first.code
    lock = sealed["lock"]
    key = xor_hex(lock["wraps"][0], answer_key(game.salt, lock["label"], first.accepted_normalized[0]))
    assert json.loads(open_text(lock["payload"], key))["title"] == waiting.title
    assert "sheets" in next(entry for entry in stage["documents"] if entry["id"] == unknown.id)
