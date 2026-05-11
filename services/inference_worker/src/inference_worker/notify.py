import logging
import os

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


async def send_telegram_alert(
    camera_name: str,
    confidence: float,
    image_path: str,
) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    caption = (
        f"\U0001f525 FIRE DETECTED\n"
        f"Camera: {camera_name}\n"
        f"Confidence: {confidence:.1%}"
    )
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            with open(image_path, "rb") as f:
                await client.post(
                    url,
                    data={"chat_id": TELEGRAM_CHAT_ID, "caption": caption},
                    files={"photo": ("alert.jpg", f, "image/jpeg")},
                )
        logger.info("Telegram alert sent for %s", camera_name)
    except Exception as exc:
        logger.error("Telegram notification failed: %s", exc)
