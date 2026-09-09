"""
Alert dispatch via Twilio SMS/WhatsApp. Runs in dry-run mode (logs + returns
a mock response, sends nothing) whenever TWILIO_ACCOUNT_SID/AUTH_TOKEN/
FROM_NUMBER aren't set in the environment - so the whole alert flow is
testable end-to-end before real trial credentials exist.

Set these in backend/.env (see backend/.env.example) to send for real:
  TWILIO_ACCOUNT_SID=...
  TWILIO_AUTH_TOKEN=...
  TWILIO_FROM_NUMBER=+1...          (SMS) or whatsapp:+14155238886 (sandbox)
"""
import logging
import os

logger = logging.getLogger("alerts")


def _twilio_configured() -> bool:
    return bool(
        os.getenv("TWILIO_ACCOUNT_SID")
        and os.getenv("TWILIO_AUTH_TOKEN")
        and os.getenv("TWILIO_FROM_NUMBER")
    )


def send_alert(to_number: str, message: str) -> dict:
    if not _twilio_configured():
        logger.info("[DRY RUN] would send to %s: %s", to_number, message)
        return {"status": "dry_run", "to": to_number, "message": message}

    from twilio.rest import Client

    client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    msg = client.messages.create(body=message, from_=os.getenv("TWILIO_FROM_NUMBER"), to=to_number)
    return {"status": "sent", "to": to_number, "message": message, "sid": msg.sid}


def build_alert_message(severity_band: str, risk_score: float, alternate: dict | None) -> str:
    lines = [
        f"[Hyderabad Flood Alert] {severity_band.upper()} risk (score {risk_score:.2f}) near your location.",
    ]
    if alternate:
        lines.append(
            f"Suggested safer route: head toward {alternate['lat']:.4f},{alternate['lon']:.4f} "
            f"(~{alternate['distance_km']} km, {alternate['severity_band']} zone)."
        )
    else:
        lines.append("No safer nearby cell found within 5km - avoid travel if possible.")
    return " ".join(lines)
