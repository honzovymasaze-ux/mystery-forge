"""The investigator's story and the voice messages (`investigation.yaml`): each entry must belong to a real envelope.

An entry with `after` waits for a puzzle. That puzzle must exist and sit in the entry's own envelope, so the entry
never appears before players hold the envelope. A recording in `source/audio/` must belong to a voice message, a
chapter, the intro (`intro`), or an ending (`epilog-<ending id>`).
"""

from collections.abc import Sequence

from mystery_forge.findings import Finding
from mystery_forge.game import Game
from mystery_forge.spec.loader import AUDIO_FOLDER, INVESTIGATION_FILE
from mystery_forge.spec.models import Chapter, VoiceMessage

INTRO_AUDIO: str = "intro"
EPILOGUE_AUDIO_PREFIX: str = "epilog-"


def audio_ids(game: Game) -> set[str]:
    """The names that a recording in `source/audio/` may have: a voice message, a chapter, the intro, an ending."""
    ids: set[str] = {INTRO_AUDIO, *(f"{EPILOGUE_AUDIO_PREFIX}{epilogue.id}" for epilogue in game.story.epilogues)}
    if game.investigation is not None:
        ids |= {message.id for message in game.investigation.voice_messages}
        ids |= {chapter.id for chapter in game.investigation.chapters}
    return ids


def check_investigation(game: Game) -> list[Finding]:
    findings: list[Finding] = []
    if game.investigation is not None:
        stage_ids: set[str] = {stage.id for stage in game.flow.stages}
        puzzle_stages: dict[str, str] = {puzzle.source.id: puzzle.source.stage for puzzle in game.puzzles}
        groups: tuple[tuple[str, Sequence[Chapter | VoiceMessage]], ...] = (
            ("chapters", game.investigation.chapters),
            ("voice_messages", game.investigation.voice_messages),
        )
        for group, entries in groups:
            for index, entry in enumerate(entries):
                path: str = f"{group}.{index}"
                if entry.stage not in stage_ids:
                    findings.append(
                        error(
                            "investigation.stage_unknown",
                            f"The entry '{entry.id}' belongs to envelope {entry.stage}, which flow.yaml does not have.",
                            f"{path}.stage",
                            f"Use one of the envelopes: {', '.join(sorted(stage_ids))}.",
                        )
                    )
                if entry.after is None:
                    continue
                if entry.after not in puzzle_stages:
                    findings.append(
                        error(
                            "investigation.after_unknown",
                            f"The entry '{entry.id}' waits for the puzzle {entry.after}, which does not exist.",
                            f"{path}.after",
                            "Name a puzzle of the same envelope, or remove `after`.",
                        )
                    )
                elif puzzle_stages[entry.after] != entry.stage:
                    findings.append(
                        error(
                            "investigation.after_other_stage",
                            f"The entry '{entry.id}' sits in envelope {entry.stage}, but waits for the puzzle "
                            f"{entry.after} of envelope {puzzle_stages[entry.after]}.",
                            f"{path}.after",
                            f"Move the entry to envelope {puzzle_stages[entry.after]}, or wait for a puzzle of "
                            f"envelope {entry.stage}.",
                        )
                    )
    known: set[str] = audio_ids(game)
    findings.extend(
        Finding(
            severity="warning",
            rule="investigation.audio_unused",
            message=f"The recording '{audio_id}' belongs to no voice message, chapter, intro, or ending.",
            file=f"{AUDIO_FOLDER}/{audio_id}",
            fix_hint="Name the file after a voice message or a chapter id of investigation.yaml, 'intro', or "
            "'epilog-<ending id>', or delete it.",
        )
        for audio_id in sorted(game.audio)
        if audio_id not in known
    )
    return findings


def error(rule: str, message: str, path: str, fix_hint: str) -> Finding:
    return Finding(severity="error", rule=rule, message=message, file=INVESTIGATION_FILE, path=path, fix_hint=fix_hint)
