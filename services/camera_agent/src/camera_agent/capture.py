import logging

import cv2

logger = logging.getLogger(__name__)


def resolve_stream_url(url: str) -> str:
    """Return a direct stream URL, resolving YouTube links via yt-dlp."""
    if "youtube.com" in url or "youtu.be" in url:
        try:
            import yt_dlp

            ydl_opts = {
                "format": "best[ext=mp4]/best",
                "quiet": True,
                "no_warnings": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                # Live streams expose the URL directly; VODs use formats list
                direct = info.get("url") or info["formats"][-1]["url"]
                logger.info("Resolved YouTube URL to direct stream")
                return direct
        except Exception as exc:
            logger.error("Failed to resolve YouTube URL: %s", exc)
            raise
    return url


def open_capture(url: str) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open stream: {url}")
    return cap
