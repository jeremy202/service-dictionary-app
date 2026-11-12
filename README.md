# Service Dictionary: mobile app

The Service Dictionary as a native **Android** and **iOS** app, built with **Nuxt 4**, **Tailwind CSS 4** and **Capacitor 8**.
The app works fully offline: all 5,072 entries and the fonts are bundled inside it.

- 1,006 terms (`data/source/Words_and_meaning.csv`)
- 3,975 abbreviations (`data/source/ABBREVIATION.csv`)
- 91 prowords (`data/source/prowords.csv`)

App ID: `com.servicedictionary.app`

## Getting the Android APK (no Android Studio needed)

Every push to `main` builds the APK on GitHub Actions
(`.github/workflows/android.yml`) and publishes it on the repository's **Releases** page.

1. Open the repository's **Releases** page on your Android phone.
2. Download `ServiceDictionary-build-N.apk` from the newest release.
3. Open the file. If Android asks, allow installing apps from your browser or files app.

To rebuild without changing code, go to **Actions → Build Android APK → Run workflow**.

This is a debug build, which is fine for testing. A Play Store release needs a signed release build (see below).

## iOS (on a Mac)

Needs Xcode (from the Mac App Store). To publish on the App Store you also need an Apple Developer account.

```bash
npm install
npm run generate
npx cap sync ios
npx cap open ios     # opens Xcode
```

In Xcode, choose your iPhone or a simulator and press ▶ Run.
For a real iPhone, set your Apple ID team under **Signing & Capabilities**.

## Working on the app

```bash
npm install
npm run dev              # preview in the browser at http://localhost:3000
npm run generate         # build the web app into .output/public
npx cap sync             # copy it into the android/ and ios/ projects
npx cap open android     # open in Android Studio (optional)
```

## Updating the content

1. Edit the CSV files in `data/source/` (keep the same columns).
2. Run `node scripts/build-data.mjs`.
3. Push to `main`, and a new APK is built automatically.

## App icon and splash screen

The source images are in `assets/`. After changing them, run:

```bash
npx capacitor-assets generate --iconBackgroundColor '#2e5c45' --iconBackgroundColorDark '#2e5c45' --splashBackgroundColor '#f5f2ea' --splashBackgroundColorDark '#121513'
```

## Play Store release (later)

1. Create a signing key: `keytool -genkey -v -keystore release.keystore -alias servicedictionary -keyalg RSA -keysize 2048 -validity 10000`
2. Build a signed bundle in Android Studio (**Build → Generate Signed App Bundle**), or with `./gradlew bundleRelease` after you add the signing config.
3. Keep the keystore safe. Every future update must be signed with the same key.
