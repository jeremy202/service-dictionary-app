# Service Dictionary payment service (Paystack)

Small Netlify service that the app uses to take payments with Paystack.
Live address: https://service-dictionary-pay.netlify.app

| Address | What it does |
|---|---|
| `POST /api/pay` `{ plan, email }` | Starts a Paystack payment and returns the checkout page |
| `GET /api/verify?reference=…` | Confirms a payment with Paystack and returns what it unlocks |
| `POST /api/restore` `{ email }` | Finds the best active purchase for an email (new phone, reinstall) |
| `/paid` | Page Paystack returns to after paying; sends the person back to the app |

Prices are set in `netlify/lib/shared.mjs` (in kobo): Monthly ₦500 (30 days), Yearly ₦3,000 (365 days),
Lifetime ₦12,500. Plans don't renew automatically. If you change a price, change `app/utils/plans.ts` too.

## Setup (once)

1. **Link the Netlify site to GitHub.** In Netlify, open **service-dictionary-pay → Site configuration →
   Build & deploy → Continuous deployment → Link repository**, choose GitHub → `jeremy202/service-dictionary-app`,
   and set **Base directory** to `payments`. Leave the other fields as they are (they come from `netlify.toml`).
2. **Add your Paystack key.** In **Site configuration → Environment variables → Add a variable**:
   key `PAYSTACK_SECRET_KEY`, value your secret key from Paystack (**Settings → API Keys & Webhooks**).
   Use the **test** key (`sk_test_…`) first, then switch to the **live** key (`sk_live_…`) when your Paystack
   business is verified. Tick "Contains secret values".
3. **Deploy:** **Deploys → Trigger deploy → Deploy site** (needed after changing the key).

## Testing

With the test key, pay in the app using Paystack's test card: **4084 0840 8408 4081**, any future expiry date,
CVV **408**, PIN **0000**, OTP **123456**. No real money moves. Test payments show in Paystack with test mode on.
