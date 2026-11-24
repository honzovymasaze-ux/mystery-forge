import json
from pathlib import Path
from typing import Any

import pytest

from mystery_forge.sealing import (
    answer_key,
    key_check,
    keystream,
    lock_text,
    open_text,
    seal_text,
    xor_hex,
)

CONTRACT_PATH: Path = Path(__file__).resolve().parents[2] / "contracts" / "sealing-vectors.json"
VECTORS: dict[str, Any] = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_a_sealed_text_opens_with_its_key_and_not_with_another() -> None:
    key = answer_key("salt", "stage:B", "boathouse")
    sealed = seal_text("Obálka B: pitevní protokol ✓", key)
    assert open_text(sealed, key) == "Obálka B: pitevní protokol ✓"
    with pytest.raises(UnicodeDecodeError):
        open_text(seal_text("žluťoučký kůň úpěl ďábelské ódy" * 3, key), answer_key("salt", "stage:B", "x"))


def test_the_keystream_has_the_asked_length() -> None:
    assert len(keystream("k", 0)) == 0
    assert len(keystream("k", 33)) == 33


def test_every_accepted_answer_unwraps_the_same_content_key() -> None:
    lock = lock_text("tajné", "salt", "stage:B", ["pokladna", "provoznimobil"])
    keys = {
        xor_hex(wrap, answer_key("salt", "stage:B", answer))
        for wrap, answer in zip(lock.wraps, ["pokladna", "provoznimobil"], strict=True)
    }
    assert len(keys) == 1
    key = keys.pop()
    assert key_check(key) == lock.check
    assert open_text(lock.payload, key) == "tajné"
    assert lock.as_json()["label"] == "stage:B"
    assert "pokladna" not in json.dumps(lock.as_json())


@pytest.mark.parametrize("vector", VECTORS["vectors"], ids=lambda vector: vector["label"])
def test_the_lock_matches_the_shared_vectors(vector: dict[str, Any]) -> None:
    lock = lock_text(vector["text"], VECTORS["salt"], vector["label"], vector["answers"])
    assert lock.as_json() == vector["lock"]
