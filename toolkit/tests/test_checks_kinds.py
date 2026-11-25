from test_checks_support import edit_document, golden_game, rules

from mystery_forge.checks.kinds import check_document_kinds
from mystery_forge.game import Game
from mystery_forge.render.kinds import document_kind_ids
from mystery_forge.spec.models import KNOWN_DOCUMENT_KINDS


def test_the_golden_documents_use_known_kinds() -> None:
    assert check_document_kinds(golden_game()) == []
    assert "case-briefing" in KNOWN_DOCUMENT_KINDS


def test_an_unknown_document_kind_is_an_error() -> None:
    findings = check_document_kinds(edit_document(golden_game(), "D5", meta={"kind": "diary"}))
    assert rules(findings) == ["documents.kind_unknown"]
    assert (findings[0].file, findings[0].path, findings[0].severity) == ("documents/D5.md", "kind", "error")
    assert "notebook" in (findings[0].fix_hint or "")


def test_the_known_kinds_match_the_renderer_templates() -> None:
    assert set(KNOWN_DOCUMENT_KINDS) == document_kind_ids()


def test_a_document_must_wait_for_a_puzzle_that_players_can_solve_by_then() -> None:
    game = golden_game()
    late = next(puzzle for puzzle in game.puzzles if puzzle.source.stage != game.flow.stages[0].id)
    first_stage = next(document for document in game.documents if document.meta.stage == game.flow.stages[0].id)

    def waiting(after: str) -> Game:
        meta = first_stage.meta.model_copy(update={"after": after})
        documents = [
            document.model_copy(update={"meta": meta}) if document is first_stage else document
            for document in game.documents
        ]
        return game.model_copy(update={"documents": documents})

    assert [finding.rule for finding in check_document_kinds(waiting(game.puzzles[0].source.id))] == []
    assert [finding.rule for finding in check_document_kinds(waiting("P9"))] == ["documents.after_unknown"]
    assert [finding.rule for finding in check_document_kinds(waiting(late.source.id))] == [
        "documents.after_later_stage"
    ]
