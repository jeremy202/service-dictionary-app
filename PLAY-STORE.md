# Publishing Service Dictionary on Google Play

App ID: `com.servicedictionary.app` · Privacy policy: https://service-dictionary-pay.netlify.app/privacy

The Play Store version charges through **Google Play Billing** (Play's rule for Nigeria). The `.apk` you share yourself still uses Paystack. Both have the same 7-day free trial and 10 free entries a day afterwards.

---

## 1. Upload key → GitHub secrets (once)

In GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**. Add these four:

| Name | Value |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | the whole contents of `keystore-base64.txt` |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | the password in `upload-key-password.txt` |
| `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | the same password |

Keep `service-dictionary-upload.jks` and its password somewhere safe, such as a password manager. Don't put it in the repository. If it's ever lost, Play support can reset the upload key (Play App Signing holds the real signing key).

## 2. Build the bundle

GitHub → **Actions → Build for Google Play → Run workflow**. When it finishes, the signed `ServiceDictionary-play-N.aab` is on the **Releases** page (tag `play-N`). Every run gets a higher version code automatically.

## 3. Create the app in Play Console

**Create app**:
- Name: Service Dictionary
- Default language: English (United Kingdom)
- App or game: App
- Free or paid: **Free** (purchases happen inside the app)

## 4. Products (Monetize with Play → Products)

Play only lets you create products after a build containing billing has been uploaded to a track. So upload the first `.aab` to **Internal testing** first (step 6), then come back here.

- **Subscriptions → Create subscription**
  - Product ID `premium`, name "Premium"
  - Base plan `monthly`: auto-renewing, billing period 1 month, price ₦500
  - Base plan `yearly`: auto-renewing, billing period 1 year, price ₦3,000
  - Activate both base plans
- **One-time products → Create**
  - Product ID `lifetime`, name "Lifetime", price ₦12,500 → Activate

Don't add Play free-trial offers: the app already gives every phone 7 days free.

Product IDs must match exactly (`premium`, `monthly`, `yearly`, `lifetime`).

## 5. Purchase checking (recommended)

This lets the payment service confirm each Play purchase with Google, so a tampered app can't unlock Premium.

1. Google Cloud console (the project linked to Play Console):
   1. Enable **Google Play Android Developer API**.
   2. **IAM → Service accounts → Create**, then **Keys → Add key → JSON**. A `.json` file downloads.
2. Play Console → **Users and permissions → Invite new users**:
   1. Invite the service account's email.
   2. Under App permissions, add Service Dictionary.
   3. Tick *View financial data* and *Manage orders and subscriptions*.
3. Netlify (service-dictionary-pay) → **Site configuration → Environment variables**:
   1. Add `GOOGLE_PLAY_SERVICE_ACCOUNT` = the whole JSON file contents.
   2. Redeploy.

Until this is done, the app trusts what Google Play reports on the phone, so testing isn't blocked.

Optional: add the same JSON as the GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`. Then "Run workflow" can upload straight to the internal or closed track. Your first upload must still be done by hand.

## 6. Testing (required for personal accounts)

1. **Internal testing**: create a release, upload the `.aab` and add your own Gmail as a tester. Install it from the opt-in link.
   - Add the same Gmail under **Settings → License testing**, so test purchases are free.
2. **Closed testing**: you need **12 or more testers opted in for 14 days in a row** before you can apply for production.
   1. Create a release and upload the `.aab`.
   2. Add a Google Group or an email list of testers.
   3. Share the opt-in link.
   4. Testers must stay opted in for the whole 14 days.
3. After the 14 days: **Dashboard → Apply for production**, answer the questions about your test, then publish to Production.

---

## Store listing (Grow users → Store presence → Main store listing)

**App name** (30 max)
> Service Dictionary

**Short description** (80 max)
> Military terms, abbreviations, prowords and symbols. Fast search, works offline.

**Full description**
> Service Dictionary puts the language of the service in your pocket: terms and their meanings, abbreviations, prowords and military symbols, all in one place and all available offline.
>
> SEARCH EVERYTHING
> Start typing and results appear instantly across names and meanings, with matches highlighted. Misspelt a word? Service Dictionary suggests what you meant.
>
> CLEAR, STRUCTURED MEANINGS
> Long definitions are laid out with their sub-points and headings, so they are easy to read on a phone.
>
> MILITARY SYMBOLS
> Browse Army, Naval, Air Force and Operations Other Than War symbols, each with its description, number and remarks.
>
> ABBREVIATIONS, A TO Z
> Look up an abbreviation or find the abbreviation for a phrase. Jump to any letter with the side index.
>
> SAVE AND REVISIT
> Save the entries you use most, see what you looked at recently, and share or copy any entry.
>
> WORKS OFFLINE
> Everything is on your phone. No signal needed.
>
> FREE TRIAL
> Enjoy full access free for 7 days. After that, open 10 entries a day for free, or go Premium for unlimited access: monthly, yearly, or a one-time lifetime purchase.

**Graphics** (in the `play-store-assets` folder)
- App icon: `icon-512.png`
- Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: `phone-1.png` … `phone-6.png`

**Category:** Books & Reference · **Tags:** Dictionary, Education, Reference
**Contact email:** required, and shown publicly on the store page.
**Privacy policy:** https://service-dictionary-pay.netlify.app/privacy

---

## App content answers (Policy → App content)

| Form | Answer |
|---|---|
| Privacy policy | https://service-dictionary-pay.netlify.app/privacy |
| Ads | No, the app has no ads |
| App access | All functionality available without special access (no login) |
| Content rating | Questionnaire, category *Reference, News, or Educational*; answer **No** to violence, sexual content, language, controlled substances, gambling, user interaction and sharing location. The app has digital purchases: **Yes**. Expected rating: Everyone / PEGI 3 |
| Target audience | 18 and over |
| News app | No |
| Government app | No (unless it is officially published by the service) |
| Financial features | None |
| Health | No |

**Data safety**

1. Data collected: **Yes**. Shared with third parties: **No**. Encrypted in transit: **Yes**. Users can request deletion: **Yes**.
2. Declare these data types:

| Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| **Device or other IDs** | Yes | No | Required | App functionality (free trial, once per phone) and fraud prevention |
| **Financial info → Purchase history** | Yes | No | Required | App functionality (confirming Premium purchases) |

3. Personal info (email): not collected in the Play version, because Google Play handles payment.
