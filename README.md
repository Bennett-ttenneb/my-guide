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
- Import more versions from OSIS, USFX or Zefania XML files and MySword or e-Sword modules
- Split view on tablets and in landscape: scripture on one side, notes on the other, with a draggable divider

**Listening**
- Reads the Bible aloud, highlighting each verse as it goes
- Morning reminder that opens today's reading
- Play through the night with a sleep timer (15 minutes to 8 hours)
- Optional natural AI voices (Piper, 8 voices, about 20 MB each, then offline)

**Study and prayer**
- Highlight verses in five colours, write notes on verses
- Notes with titles, checklists, formatting, voice recordings, photos and drawings
- Live transcriber for sermons and Bible studies (offline, runs for hours); scriptures it hears become tappable links
- Transcribe audio files (MP3, M4A, WAV) into point-form notes
- Share notes as text or PDF, with the linked verses written out
- A new devotional every day (reading, reflection and verse), with earlier days to look back on
- 24 topical prayers and devotionals built from scripture (financial breakthrough, spiritual warfare, healing, protection, peace, and more)
- Bible in a year (or 30 days to 2 years, or your own length): day-by-day plan, catch-up for missed days, daily reminder and streak
- A personal greeting by name and time of day
- A notice on the home screen when a newer version is available

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
node spoken.test.mjs   # scripture references in speech, transcript tidying
node bibleImport.test.mjs  # OSIS, USFX, Zefania and MySword/e-Sword parsing
node daily.test.mjs    # daily devotional rotation
node update.test.mjs   # version comparison for the update notice
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
| `transcribe.js`, `spoken.js` | Speech to text, and finding spoken scripture references |
| `bibleImport.js`, `bibleStore.js` | Importing Bible files from other apps |
| `PlanView.js`, `daily.js` | Reading plan screen and daily devotional |
| `notePdf.js`, `models.js` | Note PDF export; model downloads |
| `bible.js`, `data/` | Translation list and the embedded Bibles |
| `scripts/build-bibles.mjs` | Converts eBible.org downloads into `data/*.json` |
| `plugins/force-room.js` | Android build fix (Room version for WorkManager) |

## Credits and licences

- Bible texts from [eBible.org](https://ebible.org). English translations are public domain. isiNdebele and Setswana are © Biblica, Inc., licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Speech to text: [Kroko ASR](https://huggingface.co/Banafo/Kroko-ASR) community model by Banafo (CC BY-SA 4.0) via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).
- Natural voices: [Piper](https://github.com/rhasspy/piper) voice models (licences vary by voice, see each voice's model card) via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0).
- Devotionals, prayers, design and code © 2026 BBotnics Industries. All rights reserved.
