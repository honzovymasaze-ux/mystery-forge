import struct
import zlib

from mystery_forge.spec.photos import photo_size, photo_svg, photo_title


def png_bytes(width: int, height: int) -> bytes:
    """A real PNG picture of one gray color."""

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))

    header = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    pixels = zlib.compress(b"".join(b"\x00" + b"\x80" * width for _ in range(height)))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")


def jpeg_bytes(width: int, height: int) -> bytes:
    """The start of a JPEG file: an APP0 segment, then the frame header that holds the size."""
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    frame = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + frame + b"\xff\xd9"


def test_the_size_of_a_png_is_read_from_its_header() -> None:
    assert photo_size(png_bytes(40, 30)) == (40, 30)


def test_the_size_of_a_jpeg_is_read_from_its_frame_header() -> None:
    assert photo_size(jpeg_bytes(640, 480)) == (640, 480)


def test_bytes_that_are_no_picture_have_no_size() -> None:
    assert photo_size(b"GIF89a....") is None
    assert photo_size(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16) is None
    assert photo_size(b"\xff\xd8\x00\x00\x00\x00") is None
    assert photo_size(b"\xff\xd8") is None
    assert photo_size(jpeg_bytes(0, 480)) is None
    assert photo_size(png_bytes(40, 30)[:20]) is None


def test_a_photo_title_spells_out_the_id() -> None:
    assert photo_title("suspect-ana_ruiz") == "suspect ana ruiz"


def test_a_photo_becomes_an_svg_with_a_data_uri_and_an_escaped_title() -> None:
    svg = photo_svg(b"abc", "image/png", " Ana <smiling> \n", (4, 3))
    assert svg.startswith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"')
    assert "<title>Ana &lt;smiling&gt;</title>" in svg
    assert 'href="data:image/png;base64,YWJj"' in svg
