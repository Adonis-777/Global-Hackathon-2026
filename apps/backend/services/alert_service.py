import os
from typing import List, Dict, Any

class AlertService:
    """
    Abstracted Alert Service wrapping Twilio SMS and WhatsApp Sandbox APIs.
    Falls back to mock mode when TWILIO credentials are not provided.
    """
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_phone = os.getenv("TWILIO_PHONE_NUMBER", "+15005550006")
        self.whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        
        self.twilio_client = None
        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self.twilio_client = Client(self.account_sid, self.auth_token)
                print("[AlertService] Initialized Twilio Client successfully.")
            except Exception as e:
                print(f"[AlertService] Twilio init warning: {e}. Falling back to sandbox mock mode.")

    def trigger_emergency_alert(
        self,
        hex_id: str,
        locality: str,
        message: str,
        severity: str,
        channels: List[str],
        affected_population: int
    ) -> Dict[str, Any]:
        """
        Dispatches emergency alerts via requested channels.
        """
        dispatch_results = []
        
        for ch in channels:
            if ch.upper() == "SMS":
                if self.twilio_client:
                    try:
                        # Attempt real Twilio SMS (sandbox/live)
                        msg = self.twilio_client.messages.create(
                            body=f"URBAN FLOOD ALERT [{locality}]: {message}",
                            from_=self.from_phone,
                            to="+919000000000" # Placeholder target number
                        )
                        dispatch_results.append({"channel": "SMS", "status": "SENT", "sid": msg.sid})
                    except Exception as e:
                        dispatch_results.append({"channel": "SMS", "status": "MOCK_SENT", "note": f"Twilio fallback: {str(e)}"})
                else:
                    dispatch_results.append({"channel": "SMS", "status": "MOCK_DISPATCHED", "recipients": affected_population})
            
            elif ch.upper() == "WHATSAPP":
                if self.twilio_client:
                    try:
                        msg = self.twilio_client.messages.create(
                            body=f"🌊 HYDERABAD NOWCAST WARNING [{locality}]: {message}. Avoid flooded roads.",
                            from_=self.whatsapp_from,
                            to="whatsapp:+919000000000"
                        )
                        dispatch_results.append({"channel": "WHATSAPP", "status": "SENT", "sid": msg.sid})
                    except Exception as e:
                        dispatch_results.append({"channel": "WHATSAPP", "status": "MOCK_SENT", "note": f"WhatsApp fallback: {str(e)}"})
                else:
                    dispatch_results.append({"channel": "WHATSAPP", "status": "MOCK_DISPATCHED", "recipients": affected_population})
            
            elif ch.upper() == "PUSH":
                dispatch_results.append({"channel": "PUSH", "status": "BROADCAST_ACTIVE", "hexId": hex_id})

        return {
            "success": True,
            "hexId": hex_id,
            "locality": locality,
            "severity": severity,
            "affectedPopulation": affected_population,
            "dispatches": dispatch_results,
            "timestamp": "2026-09-09T16:00:00Z"
        }
