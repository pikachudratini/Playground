"""Best-effort local OCR for scanned records — Phase 2.

Runs Tesseract on-premises so patient records never leave the building.
When Tesseract or pytesseract is not installed, extraction degrades
gracefully (status SKIPPED) — the record is still stored and the rest of
the system is unaffected. PDFs are not rasterised here; they are stored
and marked SKIPPED.
"""

import logging

logger = logging.getLogger(__name__)


def ocr_available():
    """True only if both pytesseract and the Tesseract binary are usable."""
    try:
        import pytesseract
    except ImportError:
        return False
    try:
        pytesseract.get_tesseract_version()
    except Exception:  # binary missing or not runnable
        return False
    return True


def extract_text(file_field):
    """Return ``(text, status)`` for an uploaded record file.

    ``status`` is one of the RecordsIntake.ExtractionStatus values.
    """
    from .models import RecordsIntake

    status = RecordsIntake.ExtractionStatus
    if not file_field:
        return "", status.SKIPPED

    name = (getattr(file_field, "name", "") or "").lower()
    if name.endswith(".pdf"):
        # PDF rasterisation is out of scope for this module.
        return "", status.SKIPPED
    if not ocr_available():
        return "", status.SKIPPED

    try:
        import pytesseract
        from PIL import Image

        with Image.open(file_field.path) as image:
            text = pytesseract.image_to_string(image)
        return text.strip(), status.DONE
    except Exception as exc:  # corrupt image, unreadable file, etc.
        logger.warning("OCR failed for %s: %s", name, exc)
        return "", status.FAILED
