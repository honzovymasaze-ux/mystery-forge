"""Document kinds: each document names a kind that the renderer has a template for, and waits only for a puzzle
that players can solve by then."""

from mystery_forge.findings import Finding
from mystery_forge.game import Game
from mystery_forge.spec.models import KNOWN_DOCUMENT_KINDS


def check_document_kinds(game: Game) -> list[Finding]:
    return [*unknown_kind_findings(game), *document_after_findings(game)]


def document_after_findings(game: Game) -> list[Finding]:
    """A document that waits for a puzzle needs a puzzle that players can solve before or in its own envelope."""
    positions: dict[str, int] = {stage.id: index for index, stage in enumerate(game.flow.stages)}
    stages: dict[str, str] = {puzzle.source.id: puzzle.source.stage for puzzle in game.puzzles}
    findings: list[Finding] = []
    for document in game.documents:
        after: str | None = document.meta.after
        if after is None:
            continue
        if after not in stages:
            findings.append(
                Finding(
                    severity="error",
                    rule="documents.after_unknown",
                    message=f"The document {document.meta.id} waits for the puzzle {after}, which does not exist.",
                    file=document.file,
                    path="after",
                    fix_hint="Name a puzzle of this envelope or an earlier one, or remove `after`.",
                )
            )
        elif positions.get(stages[after], 0) > positions.get(document.meta.stage, 0):
            findings.append(
                Finding(
                    severity="error",
                    rule="documents.after_later_stage",
                    message=f"The document {document.meta.id} sits in envelope {document.meta.stage}, but waits for "
                    f"the puzzle {after} of the later envelope {stages[after]}.",
                    file=document.file,
                    path="after",
                    fix_hint=f"Move the document to envelope {stages[after]}, or wait for an earlier puzzle.",
                )
            )
    return findings


def unknown_kind_findings(game: Game) -> list[Finding]:
    return [
        Finding(
            severity="error",
            rule="documents.kind_unknown",
            message=f"The document {document.meta.id} has the kind '{document.meta.kind}', which has no template.",
            file=document.file,
            path="kind",
            fix_hint=f"Use one of: {', '.join(KNOWN_DOCUMENT_KINDS)}.",
        )
        for document in game.documents
        if document.meta.kind not in KNOWN_DOCUMENT_KINDS
    ]
