from __future__ import annotations

import hashlib
import hmac
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import settings

logger = logging.getLogger("ruveon-whatsapp")


def verify_webhook_signature(body: bytes, signature: str | None) -> bool:
    if not settings.whatsapp_app_secret or not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(settings.whatsapp_app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))


def send_whatsapp_message(recipient: str, text: str) -> None:
    required = (settings.whatsapp_access_token, settings.whatsapp_phone_number_id)
    if not all(required):
        raise RuntimeError("WhatsApp Cloud API credentials are not configured")

    body = json.dumps({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": False, "body": text[:4000]},
    }).encode("utf-8")
    request = Request(
        f"https://graph.facebook.com/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        logger.exception("WhatsApp message delivery failed")
        raise RuntimeError("WhatsApp message delivery failed") from exc
