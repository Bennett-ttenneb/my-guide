# My Guide

**A free, offline Bible app for Android — by BBotnics Industries.**

My Guide reads the Bible to you every morning, keeps your place, and gives you everything you need to study, pray and take notes — with no internet, no account and no ads.

## Download

Get the latest APK from the **[Releases page](https://github.com/Bennett-ttenneb/my-guide/releases/latest)**. Open it on your Android phone and tap **Install** (allow installs from your browser if Android asks; tap **Install anyway** if Play Protect warns that it isn't from the Play Store).

## Features

**Bible**
- 14 translations built in, fully offline: World English Bible, King James Version, Berean Standard Bible, American Standard Version, Bible in Basic English, Young's Literal, Darby, Revised Version, Webster, World Messianic, Geneva 1599, Douay-Rheims, isiNdebele and Setswana (New Testament)
- Book → chapter → verse navigation, typed references ("Jn 3:16"), word search, bookmarks and history
- Swipe between chapters, adjustable text size, dark mode for night reading

**Listening**
- Reads the Bible aloud, highlighting each verse as it goes
- Morning reminder that opens today's reading
- Play through the night with a sleep timer (15 minutes to 8 hours)
- Optional natural AI voices (Piper, 8 voices, about 20 MB each, then offline)

**Study and prayer**
- Highlight verses in five colours, write notes on verses
- Notes with titles, checklists, formatting, voice recordings, photos and drawings
- 24 topical prayers and devotionals built from scripture (financial breakthrough, spiritual warfare, healing, protection, peace, and more)
- Reading plans to finish the Bible in 30 days to 2 years or a custom length, with a daily streak

## Privacy

Everything you create stays on your phone. My Guide has no accounts, analytics or ads, and BBotnics Industries never receives your data. See the [Privacy Policy](PRIVACY.md) and [Terms of Use](TERMS.md).

## Building it yourself

The app is an [Expo](https://expo.dev) (React Native) project.

```bash
npm install
npx expo start --web                                                      # quick preview in a browser (no AI voice)
npx eas-cli@latest build -p android --profile preview                     # Android APK via EAS Build
```

Checks:

```bash
node plan.test.mjs     # reading plans, streaks and all Bible data files
node nav.test.mjs      # reference parsing and search
node topics.test.mjs   # every scripture reference in the devotionals
```

### Project layout

| Path | What it is |
| --- | --- |
| `App.js` | Main screen: reader, read-aloud, tabs, verse actions |
| `Navigator.js` | Book/chapter/verse picker, search, saved, history |
| `Devotions.js`, `topics.js` | Devotionals and prayers screen, and their content |
| `Notes.js`, `RichNote.js`, `Sketch.js` | Notes list, note editor, drawing pad |
| `Settings.js` | Plans, theme, reminder, voices |
| `plan.js`, `nav.js` | Reading plan, streak, reference and search logic |
| `speaker.js`, `aivoice.js` | Phone voice and natural AI voice playback |
| `bible.js`, `data/` | Translation list and the embedded Bibles |
| `scripts/build-bibles.mjs` | Converts eBible.org downloads into `data/*.json` |
| `plugins/force-room.js` | Android build fix (Room version for WorkManager) |

## Credits and licences

- Bible texts from [eBible.org](https://ebible.org). English translations are public domain. isiNdebele and Setswana are © Biblica, Inc., licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Natural voices: [Piper](https://github.com/rhasspy/piper) voice models (licences vary by voice, see each voice's model card) via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0).
- Devotionals, prayers, design and code © 2026 BBotnics Industries. All rights reserved.
