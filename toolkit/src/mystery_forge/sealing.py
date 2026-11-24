"""Sealed content: text that the companion page can read only after players give the right answer.

The player version of the companion page holds the documents of every envelope, but an envelope that players have
not opened yet must stay unreadable, also in the page source. The toolkit seals its content with a key. The key comes
from the answer that opens the envelope, so only a group that solved that puzzle can derive it. The JavaScript copy
in `render/companion/sealing.js` must give the same bytes; `contracts/sealing-vectors.json` keeps both copies equal.

The cipher is a SHA-256 keystream: block i is SHA-256("<key>:<i>"), and the content bytes are XORed with it. It is a
game lock, not a vault: it hides the text from a curious look, and it needs no library on either side.
"""

import base64
import hashlib
from dataclasses import dataclass
from typing import Final

BLOCK_BYTES: Final[int] = 32
# The first characters of SHA-256("<key>:check"): the page tests a key with it before it opens anything.
CHECK_LENGTH: Final[int] = 16


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def answer_key(salt: str, label: str, normalized_answer: str) -> str:
    """The key that one accepted answer gives for one lock, such as the lock of envelope B."""
    return sha256_hex(f"{salt}:seal:{label}:{normalized_answer}")


def key_check(key: str) -> str:
    return sha256_hex(f"{key}:check")[:CHECK_LENGTH]


def keystream(key: str, length: int) -> bytes:
    blocks: list[bytes] = [
        hashlib.sha256(f"{key}:{index}".encode()).digest() for index in range((length + BLOCK_BYTES - 1) // BLOCK_BYTES)
    ]
    return b"".join(blocks)[:length]


def xor_hex(left: str, right: str) -> str:
    return bytes(a ^ b for a, b in zip(bytes.fromhex(left), bytes.fromhex(right), strict=True)).hex()


def seal_text(text: str, key: str) -> str:
    """Return the text encrypted with the key, as base64."""
    data: bytes = text.encode()
    return base64.b64encode(bytes(a ^ b for a, b in zip(data, keystream(key, len(data)), strict=True))).decode()


def open_text(sealed: str, key: str) -> str:
    data: bytes = base64.b64decode(sealed)
    return bytes(a ^ b for a, b in zip(data, keystream(key, len(data)), strict=True)).decode()


@dataclass(frozen=True)
class Lock:
    """A sealed text with one wrapped copy of its key per accepted answer.

    `wraps` holds content key XOR answer key, so any accepted answer opens the lock and no answer is stored.
    """

    label: str
    check: str
    wraps: list[str]
    payload: str

    def as_json(self) -> dict[str, object]:
        return {"label": self.label, "check": self.check, "wraps": self.wraps, "payload": self.payload}


def lock_text(text: str, salt: str, label: str, accepted_answers: list[str]) -> Lock:
    """Seal the text so that each accepted normalized answer opens it. The first answer makes the content key."""
    content_key: str = sha256_hex(f"{salt}:content:{label}:{accepted_answers[0]}")
    return Lock(
        label=label,
        check=key_check(content_key),
        wraps=[xor_hex(content_key, answer_key(salt, label, answer)) for answer in accepted_answers],
        payload=seal_text(text, content_key),
    )
