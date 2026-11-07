# Google Play listing — My Guide

Everything to paste into Play Console. Graphics are in this folder.

## Main store listing

**App name** (max 30):
My Guide: Bible & Notes

**Short description** (max 80):
Offline Bible that reads to you, with sermon notes, devotionals and Bible plans

**Full description** (max 4000):

My Guide is a free Bible app that works without internet. It reads the Bible to you every morning, helps you finish the whole Bible, and gives you a notebook that listens to the sermon with you.

READ AND LISTEN
• 14 Bible versions built in, no internet needed: KJV, World English Bible, Berean Standard Bible, ASV, Young's Literal, Darby, Geneva 1599, Douay-Rheims and more, plus isiNdebele and Setswana
• Import more versions from OSIS, USFX or Zefania files and MySword or e-Sword modules
• Reads aloud verse by verse, highlighting as it goes, with natural voices you can download
• Play through the night with a sleep timer
• Dark mode for reading at night

FIND YOUR WAY
• Jump to any book, chapter and verse, or just type "John 3:16"
• Search every word, bookmark verses, see your history
• Swipe between chapters
• On tablets and in landscape: scripture on one side, your notes on the other

SERMON AND STUDY NOTES
• Live transcriber: turns the preacher's words into text as they speak, for an hour or more, right on your phone
• Scriptures it hears ("John three sixteen", "Romans chapter eight verse twenty-eight") become links in your note
• Turn an audio recording of a sermon into point-form notes
• Checklists, formatting, voice notes, photos and drawings
• Share notes as text or PDF, with the verses written out
• Highlight verses in five colours and write notes on any verse

GROW EVERY DAY
• A new devotional every day: a reading, a short reflection and a verse
• 24 prayers and devotionals from scripture: healing, protection, peace, spiritual warfare, financial breakthrough, wisdom, grief, and more
• Bible in a year, or set your own pace from 30 days to 2 years
• Daily reminder, streaks, and an easy way to catch up on missed days
• A morning greeting with your name

PRIVATE BY DESIGN
No account, no ads, no tracking. Your notes, highlights and recordings stay on your phone. Speech is turned into text on your phone and never sent anywhere.

Made with care by BBotnics Industries.

**App category:** Books & Reference
**Tags (choose up to 5):** Bible, Religion, Books & reference, Education, Notes
**Contact email:** required by Google — use a support address you check (it is shown publicly on the listing)
**Privacy policy URL:** https://github.com/Bennett-ttenneb/my-guide/blob/main/PRIVACY.md

## Graphics (this folder)

| Play Console field | File | Size |
| --- | --- | --- |
| App icon | `icon-512.png` | 512 × 512 |
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots (2–8) | `screenshot-*.png` | 1080 × 2160 |

## App content (Policy → App content)

**Privacy policy:** the URL above.

**Ads:** No, the app does not contain ads.

**App access:** All functionality is available without special access (no login).

**Content rating (IARC questionnaire):** Category *Reference, News, or Educational*. Answer **No** to violence, sexual content, profanity, drugs, gambling, user-to-user communication and sharing of location. Expected rating: Everyone / PEGI 3. (The Bible text is reference material; the questionnaire is about interactive content.)

**Target audience:** choose **13 and over** (13–15, 16–17, 18+). The app is fine for children, but selecting under-13 brings in the Families policy and extra review. You can widen this later.

**News app:** No.

**Data safety:**
- Does your app collect or share any of the required user data types? **No.**
- (Microphone audio, photos and notes are processed and stored only on the device and never leave it, so under Google's definitions they are not "collected".)
- Is all user data encrypted in transit? Not applicable (nothing is transmitted). If the form insists, answer **Yes**: the only network use is HTTPS downloads from GitHub.
- Account deletion: not applicable — there are no accounts.

**Government app:** No. **Financial features:** None. **Health:** No.

**Permissions you may be asked to explain:**
- *Microphone:* voice notes and speech-to-text in notes, only when the user taps record or transcribe.
- *Camera:* adding a photo to a note, only when the user chooses "Take photo".
- *Notifications:* the daily reading reminder.
- *Foreground service (media playback):* keeps Bible reading playing when the screen is off (read-aloud and the night sleep timer). If Play Console asks for a video, record the phone playing a chapter with the screen locked.

## Testing tracks

- **Personal developer account:** you must run a **closed test with at least 12 testers for 14 days in a row** before you can apply for production. Add testers' Gmail addresses under Testing → Closed testing.
- **Organisation account:** you can go straight to production after review.

## Releasing

1. Testing → Closed testing (or Production) → Create new release.
2. Let Google manage the app signing key (Play App Signing). Upload `my-guide-<version>.aab` — it is already signed with the BBotnics Industries upload key.
3. Release name: the version (e.g. 2.3.0). Release notes: from the GitHub release.
4. Review and roll out. Google's first review usually takes a few days.
