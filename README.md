# Share-location

Customer delivery-location link. Opening index.html asks the visitor's permission, gets their GPS location, and opens WhatsApp pre-filled to the dispatch team with a Google Maps pin.

## WhatsApp roof tile estimate bot

`whatsapp-bot/` holds a WhatsApp bot. A customer sends their roof size in m² and gets a free Apache tile estimate plus a free cost comparison with IBR sheeting. See [whatsapp-bot/README.md](whatsapp-bot/README.md) for setup.

## Roof cost calculator page

`roof-calculator.html` shows the published roof price (P140 per m² incl. VAT, Double Roman). The customer enters m² or length × width and sees the cost and quantities. A button opens WhatsApp with the estimate filled in. You set the receiving number in `WHATSAPP_NUMBER` at the top of the script.
