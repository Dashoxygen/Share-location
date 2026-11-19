# Apache Roof Tiles – WhatsApp estimate bot

A customer sends their roof size on WhatsApp and gets back two messages:

1. **A free roof cost** at the **one published price per m²**: Double Roman tiles with ridge caps and oxide, incl. VAT. Retail is **P140/m²**, so 120 m² comes to P16,800. The message also gives the number of tiles, ridge caps and kg of oxide needed.
2. **A free cost comparison with IBR sheeting** for the same roof.

There are no dependencies. It runs on Node.js 20 or later and talks to the official **WhatsApp Cloud API** (Meta).

## What customers can send

| Customer sends | Bot replies |
|---|---|
| `hi`, `menu`, `help` | Welcome and instructions |
| `120`, `120m2`, `120 sqm`, `12 x 10`, `12m by 10m` | Roof cost at the per-m² price, quantities, and the IBR comparison |
| The "Roof quote request" message from `roof-calculator.html` | Estimate and IBR comparison, then asks for the quote details |
| `colours` | The six promotional colours and the three profiles. Dolomite is left out on purpose because it is special order only |
| `quote` | Asks for name, two numbers, location and colour, then records a lead |
| `contact` | Office address, phone and email |
| `cancel` | Back to the start |

## The published price per m²

Apache's price list only has per-tile and per-unit rates. The bot turns them into **one price per m² of house-plan area** for the main tile, Double Roman:

```
1.15 (overhang & pitch) × 11 tiles/m² × (tile P7.81 + 6% × ridge cap P28.60 + 0.2% × oxide P78.95/kg) × 1.14 VAT
= P139.65 → rounded up to P140 per m²
```

- Set `PUBLISHED_PRICE_PER_M2` to fix an approved figure. If you change it, also change `PRICE_PER_M2` in [`../roof-calculator.html`](../roof-calculator.html).
- The per-m² figure is an estimate. A formal quote is still counted from the roof plan, and it comes out about 2–4% higher, because tiles are rounded up to full 50s and ridge caps to full 5s, and hip starters are added.
- Shingle and Tuscan are not given a per-m² price. Customers are told those profiles cost a little more and to ask for a quote.

## How it calculates (Apache estimating standard)

- Tiles = plan area × 1.15 (overhang and pitch) × **11 tiles/m²**, rounded up to the next 50. The 11/m² quoting rate includes a cutting and breakage allowance.
- Ridge caps = 6% of tiles, rounded up to the next 5.
- Oxide = 1 kg per 30 ridge caps, rounded up.
- Pallets = tiles ÷ 250, rounded up. Off-loading costs P50 per pallet.
- Prices come from the **retail** list by default. Set `PRICE_LIST=wholesale` to use developer prices. VAT is 14%.
- Hip starters, delivery, diesel, timber and labour are **not** in the total. The message tells the customer this.
- When the Double Roman product value incl. VAT is over P14,500, the bot mentions the free-delivery zones. Diesel and off-loading still apply.

**IBR comparison:** sheet length = roof area ÷ 0.686 m cover width + 5% for laps and cutting. Apache does not sell IBR, so **you must set `IBR_PRICE_PER_LM`** from a current local supplier price. If it is not set, the bot shows the sheet metres and offers IBR pricing on request. It never makes up an IBR price.

All of these numbers are in [`src/config.js`](src/config.js).

## Try it locally (no WhatsApp needed)

```bash
cd whatsapp-bot
npm test        # 12 tests
npm run chat    # chat with the bot in your terminal
```

## Go live on WhatsApp

1. **Create the app.** Go to [developers.facebook.com](https://developers.facebook.com), click Create App, choose Business, and add the **WhatsApp** product.
2. **Get your credentials.** Under WhatsApp → API Setup, copy the **Phone number ID** and a **token**. For production, create a permanent System User token in Meta Business Settings, because the temporary token expires after 24 hours. Then add your real business number.
3. **Deploy the server.** Any Node host works, for example Render, Railway, Fly.io or a VPS. Set the environment variables listed in [`.env.example`](.env.example), and use `npm start` as the start command.
4. **Connect the webhook.** Under WhatsApp → Configuration → Webhook, set:
   - Callback URL: `https://YOUR-HOST/webhook`
   - Verify token: the same value as `WHATSAPP_VERIFY_TOKEN`
   - Then subscribe to the **messages** field.
5. **Test it.** Message the business number "hi".

To test locally against real WhatsApp, run `npm run dev` with a `.env` file and expose port 3000 with a tunnel such as ngrok.

## Quote requests (leads)

When a customer replies to QUOTE, the bot:
- logs the lead,
- appends it to `data/leads.jsonl` (this file is ignored by git), and
- if `SALES_NOTIFY_NUMBER` is set, sends it to that WhatsApp number. WhatsApp only delivers that message if the sales number has messaged the bot within the last 24 hours, so check the leads file as well.

The bot reads text only. Customers who send a photo are asked to email their roof plan to sales.

## Files

```
src/config.js      prices, estimating rules, IBR settings
src/calculator.js  tile and IBR maths
src/parse.js       reads "120", "12 x 10", "1,200 m²", ...
src/messages.js    all customer-facing wording
src/bot.js         conversation logic
src/whatsapp.js    Cloud API send, signature check, payload parsing
src/server.js      webhook server (GET/POST /webhook, GET /health)
src/cli.js         local terminal chat
test/              node:test suite
```
