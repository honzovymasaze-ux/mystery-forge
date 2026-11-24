"""Photos: real pictures (JPEG or PNG) that the game owner puts into `images/`, such as a suspect or a camera still.

The toolkit draws every image as SVG. A photo therefore becomes a small SVG that holds the picture as a data URI, so
the checks, the renderer, and the solver panel treat it like any other image. A photo replaces the SVG image with the
same id, so the owner can swap a drawn portrait for a real one. The optional text file `images/<id>.txt` says in plain
words what the photo shows; it becomes the SVG title that the solver panel reads.
"""

import base64
import struct
from html import escape
from typing import Final

PHOTO_MEDIA_TYPES: Final[dict[str, str]] = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
PNG_SIGNATURE: Final[bytes] = b"\x89PNG\r\n\x1a\n"
JPEG_START: Final[bytes] = b"\xff\xd8"
# The JPEG start-of-frame markers that carry the picture size (all SOFn except DHT, JPG, and DAC).
JPEG_FRAME_MARKERS: Final[frozenset[int]] = frozenset(range(0xC0, 0xD0)) - {0xC4, 0xC8, 0xCC}
# The data URI prefixes that the image check accepts inside an SVG.
PHOTO_DATA_PREFIXES: Final[tuple[str, ...]] = tuple(
    f"data:{media_type};base64," for media_type in sorted(set(PHOTO_MEDIA_TYPES.values()))
)


def photo_size(data: bytes) -> tuple[int, int] | None:
    """Return the width and height of a PNG or JPEG picture, or None when the bytes are neither."""
    if data.startswith(PNG_SIGNATURE) and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
        return (width, height) if width and height else None
    if data.startswith(JPEG_START):
        return jpeg_size(data)
    return None


def jpeg_size(data: bytes) -> tuple[int, int] | None:
    position: int = 2
    while position + 4 <= len(data):
        if data[position] != 0xFF:
            return None
        marker: int = data[position + 1]
        length: int = struct.unpack(">H", data[position + 2 : position + 4])[0]
        if marker in JPEG_FRAME_MARKERS and position + 9 <= len(data):
            height, width = struct.unpack(">HH", data[position + 5 : position + 9])
            return (width, height) if width and height else None
        position += 2 + length
    return None


def photo_title(image_id: str) -> str:
    """The title of a photo without a description file: its id with spaces, such as "suspect ana"."""
    return image_id.replace("-", " ").replace("_", " ")


def photo_svg(data: bytes, media_type: str, title: str, size: tuple[int, int]) -> str:
    width, height = size
    encoded: str = base64.b64encode(data).decode("ascii")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" class="mf-photo">'
        f"<title>{escape(title.strip())}</title>"
        f'<image width="{width}" height="{height}" href="data:{media_type};base64,{encoded}"/></svg>'
    )
