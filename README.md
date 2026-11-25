# smallhotelroom-app

Offline chord and lyric reader, string strum/arpeggio sequencer, polyrhythm metronome, and reference ear tuner built with Vite, React, SQLite (`sql.js` WASM), Capacitor, and Tauri.

Depends on `smallhotelroom.github.io` (git clone it next to this repository).

## 0. [optional] Linter install (VSCode extension)

```bash
npm run linter:install
```

## 1. Database (`songs-official.db`)

Generate the SQLite database (`public/songs.db` & `dist-dbs/songs-official.db`) from `smallhotelroom.github.io` Markdown songs, which defaults to official ("clean") configured via `shr-config.yaml` which uses variables that can be stored in your personal `.env` (see `.env.example` for example):

```bash
npm run db:build
```

[Optional] The previous command, depending on the files present in your device, can generate several database files. If you want the same command to do the same process but additionally merge them into an additional merged database at the end (slightly slower):

```bash
npm run db:build -- --merge
```

[Optional] For single custom inputs, e.g. the following outputs dist-dbs/songs-cosecha.db with playlist "cosecha":

```bash
npm run db:build -- --input ~/jgvictoresAsrob/chords/0-GUITAR/cosecha
```

[Optional] You can also cusomize the custom output path:

```bash
npm run db:build -- --input ~/jgvictoresAsrob/chords/0-GUITAR/cosecha --output dist-dbs/my-custom.db
```

## 2. PDF Generator

Build PDF from `public/songs.db`:

```bash
npm run pdf:build -- --output SmallHotelRoom.pdf 
```

More examples:

```bash
npm run pdf:build -- --db dist-dbs/songs-curated.db --playlist "Español" --template templates/espanol.tex --transpose -5 --capo-drop-correction --output Ukelele_Espanol.pdf
```

## 3. Local Web Development

```bash
nvm use
npm install
npm run dev
```

Build and preview the production web bundle locally:

```bash
npm run build
npm run preview
```

## 4. Android (via Docker)

First, download or build the Docker image (only needed once or when `Dockerfile` changes)


**Option A: Pull the pre-built image (Fastest)**

The build environment is hosted privately on the GitHub Container Registry to save time.

1. Create a [GitHub Personal Access Token (Classic)](https://github.com/settings/tokens) and check the `read:packages` scope.
2. Log in to the registry (replace with your username and token):
   ```bash
   echo "YOUR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```
3. Later on (when you run the compiler), Docker will automatically pull the image.

**Option B: Build locally**

1. Build the Docker compiler image:
    ```bash
    docker compose build
    ```

### 4.1. Android (via Docker): Debug

Compile the debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`):

```bash
docker compose up
```

Install the debug APK onto a USB-connected Android device:

```bash
docker compose run --rm android-builder adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

If fails, possibly you may locally (`sudo apt install android-tools-adb`):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

More useful debug commands: debug/view live Android device logs:

```bash
docker compose run --rm android-builder adb logcat | grep -i capacitor
```

Even more useful debug commands: Open an interactive shell inside the Android builder container:

```bash
docker compose run --rm android-builder bash
```

### 4.2. Android (via Docker): Release APK

Or compile the release APK (`ls android/app/build/outputs/apk/release/app-release-*.apk`):

```bash
GRADLE_TASK=assembleRelease docker compose up
```

### 4.3. Android (via Docker): Play Store bundle

Or compile the Play Store bundle (`ls android/app/build/outputs/bundle/release/app-release.aab`):

```bash
GRADLE_TASK=bundleRelease docker compose up
```

## 5. iOS

Sync web assets and Capacitor plugins to the Xcode project (`ios/`):

```bash
npm run build
npx cap sync ios
```

Open in Xcode (requires macOS):

```bash
npx cap open ios
```

## 6. How to bump version

E.g. bumping `v0.2.0` to `v0.2.1`,

Manually upgrade `android/app/build.gradle`:
```json
versionCode 2
versionName "0.2.1"
```

Then annotated tag on latest commit:

```bash
npm version v0.2.1 --no-git-tag-version # updates package.json and package-lock.json
git tag -a v0.2.1 -m "v0.2.1 - <msg>"
git push origin v0.2.1
```

Required for Google Play `android/app/build.gradle`:

- versionName "0.2.1" (the version string shown in Android App Info).
- versionCode 2 (an integer that must increment by +1 for every APK/AAB uploaded)

## 7. Notes on syntax

Syntax for custom chords section:

```md
## Chords
Cmaj7: x32000
Bm7b5: x2323x
D5: x577xx
C#aug: x4322x
F#sus2: 244122 "Thumb on 6th"
G7 (uke): 0212
C#7 (uke): 1,1,1,4
```
