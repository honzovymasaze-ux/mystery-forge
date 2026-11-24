"""The investigator's story and the voice messages: `investigation.yaml`, its recordings, checks, and outputs."""

import shutil
from pathlib import Path

import pytest
from pydantic import ValidationError
from test_checks_support import golden_game, rules
from test_spec_loader import GOLDEN_SOURCE

from mystery_forge.checks.investigation import check_investigation
from mystery_forge.checks.leaks import check_leaks
from mystery_forge.game import Game
from mystery_forge.render.companion_data import build_companion_data
from mystery_forge.render.materials import (
    ChapterBlock,
    ChaptersPage,
    chapter_sheets,
    materials_sheets,
    split_chapter_block,
)
from mystery_forge.spec.loader import load_game_source
from mystery_forge.spec.models import Chapter, Investigation, Narrator, VoiceMessage

NARRATOR = Narrator(name="Insp. Maud Price", role="Lead investigator")
INVESTIGATION_YAML: str = """format_version: 1
narrator:
  name: Insp. Maud Price
  role: Lead investigator
chapters:
  - id: ch-rock
    stage: A
    title: The dark rock
    text: |
      The light went out at ten.

      I took the first ferry.
voice_messages:
  - id: vm-hale
    stage: A
    sender: Sgt. Hale
    role: Constable
    text: The keeper is waiting for you at the tower.
"""


def investigation(chapters: list[Chapter] | None = None, messages: list[VoiceMessage] | None = None) -> Investigation:
    return Investigation(format_version=1, narrator=NARRATOR, chapters=chapters or [], voice_messages=messages or [])


def chapter(entry_id: str, stage: str = "A", after: str | None = None, text: str = "The light went out.") -> Chapter:
    return Chapter(id=entry_id, stage=stage, after=after, title=f"Title {entry_id}", text=text)


def message(entry_id: str, stage: str = "A", after: str | None = None, text: str = "Come quickly.") -> VoiceMessage:
    return VoiceMessage(id=entry_id, stage=stage, after=after, sender="Sgt. Hale", voice="female", text=text)


def with_investigation(game: Game, value: Investigation | None, audio: dict[str, str] | None = None) -> Game:
    return game.model_copy(update={"investigation": value, "audio": audio or {}})


@pytest.fixture
def game_dir(tmp_path: Path) -> Path:
    shutil.copytree(GOLDEN_SOURCE, tmp_path / "source")
    return tmp_path


# ---------- The model and the loader ----------


def test_chapter_and_message_ids_must_be_unique() -> None:
    with pytest.raises(ValidationError, match="appear twice"):
        investigation([chapter("x")], [message("x")])


def test_the_loader_reads_the_investigation_and_the_recordings(game_dir: Path) -> None:
    source_dir = game_dir / "source"
    (source_dir / "investigation.yaml").write_text(INVESTIGATION_YAML, encoding="utf-8")
    (source_dir / "audio").mkdir()
    (source_dir / "audio" / "vm-hale.MP3").write_bytes(b"ID3")
    (source_dir / "audio" / "notes.txt").write_text("ignored", encoding="utf-8")
    source, findings = load_game_source(game_dir)
    assert findings == []
    assert source.investigation is not None
    assert source.investigation.narrator.name == "Insp. Maud Price"
    assert source.investigation.voice_messages[0].voice == "male"
    assert source.audio == {"vm-hale": "data:audio/mpeg;base64,SUQz"}


def test_a_game_without_an_investigation_loads_without_one(game_dir: Path) -> None:
    source, findings = load_game_source(game_dir)
    assert findings == []
    assert source.investigation is None
    assert source.audio == {}


# ---------- The checks ----------


def test_a_valid_investigation_has_no_findings() -> None:
    game = with_investigation(
        golden_game(),
        investigation([chapter("ch-a"), chapter("ch-b", "B", "P3")], [message("vm-a", after="P2")]),
        {"vm-a": "data:audio/mpeg;base64,AA=="},
    )
    assert check_investigation(game) == []
    assert check_investigation(golden_game()) == []


def test_an_entry_must_belong_to_a_real_envelope_and_wait_for_a_puzzle_of_it() -> None:
    game = with_investigation(
        golden_game(),
        investigation([chapter("ch-z", "H"), chapter("ch-gone", after="P9")], [message("vm-early", "A", "P3")]),
    )
    findings = check_investigation(game)
    assert rules(findings) == [
        "investigation.stage_unknown",
        "investigation.after_unknown",
        "investigation.after_other_stage",
    ]
    assert findings[2].path == "voice_messages.0.after"
    assert findings[0].file == "investigation.yaml"


def test_a_recording_without_a_voice_message_is_a_warning() -> None:
    findings = check_investigation(with_investigation(golden_game(), None, {"vm-lost": "data:audio/mpeg;base64,AA=="}))
    assert rules(findings) == ["investigation.audio_unused"]
    assert findings[0].severity == "warning"


def test_a_chapter_that_players_read_before_a_puzzle_must_not_hold_its_answer() -> None:
    game = with_investigation(
        golden_game(),
        investigation(
            [chapter("ch-a", text="It was the boathouse all along.")],
            [message("vm-a", after="P1", text="The boathouse! I knew it."), message("vm-c", "C", text="boathouse")],
        ),
    )
    leaks = [finding for finding in check_leaks(game) if finding.file == "investigation.yaml"]
    assert [finding.path for finding in leaks] == ["chapters.0.text"]
    assert all(finding.path is not None for finding in check_leaks(with_investigation(golden_game(), None)))


# ---------- The companion page ----------


def test_the_companion_data_orders_the_entries_as_players_meet_them() -> None:
    game = with_investigation(
        golden_game(),
        investigation(
            [chapter("ch-b", "B"), chapter("ch-a2", after="P2"), chapter("ch-a")],
            [message("vm-a", after="P1"), message("vm-b", "B")],
        ),
        {"vm-b": "data:audio/mpeg;base64,AA=="},
    )
    data = build_companion_data(game)["investigation"]
    assert data["narrator"] == {"name": "Insp. Maud Price", "role": "Lead investigator"}
    assert [entry["id"] for entry in data["entries"]] == ["ch-a", "vm-a", "ch-a2", "ch-b", "vm-b"]
    voice = data["entries"][1]
    assert voice["after"] == "A1"
    assert voice["voice"] == "female"
    assert voice["audio"] == ""
    assert data["entries"][4]["audio"] == "data:audio/mpeg;base64,AA=="
    assert build_companion_data(golden_game())["investigation"] is None


def test_an_entry_of_an_unknown_envelope_sorts_last() -> None:
    game = with_investigation(golden_game(), investigation([chapter("ch-z", "H"), chapter("ch-a")]))
    entries = build_companion_data(game)["investigation"]["entries"]
    assert [entry["id"] for entry in entries] == ["ch-a", "ch-z"]


# ---------- The printed chapters ----------


def test_the_chapters_of_an_envelope_print_right_behind_its_stop_sheet() -> None:
    game = with_investigation(
        golden_game(),
        investigation([chapter("ch-a", text="One.\n\n  \n\nTwo."), chapter("ch-a2", after="P1"), chapter("ch-b", "B")]),
    )
    sheets = materials_sheets(game)
    roles = [sheet.role for sheet in sheets]
    first_cover = roles.index("stage-cover")
    assert roles[first_cover + 1] == "chapters"
    page = sheets[first_cover + 1].content
    assert isinstance(page, ChaptersPage)
    assert page.narrator == "Insp. Maud Price, Lead investigator"
    assert page.first
    assert [block.text for block in page.blocks] == ["Title ch-a", "One.", "Two."]
    assert roles.count("chapters") == 2


def test_an_envelope_without_chapters_prints_none() -> None:
    game = with_investigation(golden_game(), investigation([], [message("vm-a")]))
    assert chapter_sheets(game, game.flow.stages[0], {}) == []
    assert chapter_sheets(golden_game(), golden_game().flow.stages[0], {}) == []


def test_a_long_chapter_flows_over_several_pages() -> None:
    long_text = "\n\n".join(" ".join(["The tide came in slowly over the rocks."] * 12) for _ in range(12))
    game = with_investigation(golden_game(), investigation([chapter("ch-a", text=long_text)]))
    sheets = chapter_sheets(game, game.flow.stages[0], {})
    assert len(sheets) > 1
    assert all(isinstance(sheet.content, ChaptersPage) for sheet in sheets)
    assert [sheet.content.first for sheet in sheets if isinstance(sheet.content, ChaptersPage)][:2] == [True, False]


def test_a_paragraph_taller_than_a_page_splits_into_pieces() -> None:
    block = ChapterBlock(text=" ".join(["Waves broke on the rock."] * 400), heading=False)
    pieces = split_chapter_block(block, 200)
    assert len(pieces) > 1
    assert all(not piece.heading for piece in pieces)
    assert split_chapter_block(ChapterBlock(text="Title", heading=True), 200) == [ChapterBlock("Title", True)]
