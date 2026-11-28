# Linux support for the Twinmap app

## Intent

Twinmap's app runs on Windows and macOS. Players on Linux run World of Warcraft: Forever under Wine or Proton (DXVK) and have no way to use the map. This adds a Linux build of the app.

The work is developed and tested by one contributor on their own machine first (Arch, Hyprland, Wayland) and then offered upstream to `catubba/twinmap-forever` as a pull request. It is built to the project's standards from the start: its conventions, its eight languages, CI, and release artifacts. The upstream maintainers then only review it, without reworking it.

## Goals

- A Linux x86_64 build of the app that reads the addon's strip and the minimap off the game window, with the same accuracy as on Windows and macOS.
- Works on any desktop with an xdg-desktop-portal ScreenCast implementation and PipeWire: Hyprland (tested first), GNOME, KDE. See "Desktop coverage" for what is verified before the pull request.
- The game folder is found by itself in the common Wine setups, with the existing "pick folder" dialog as the fallback.
- Distributed as an AppImage that updates itself, the way the Windows installer does.
- A CI job that type-checks, tests and builds the Linux app and its helper.

## Non-goals

- Packages other than the AppImage (Flatpak, AUR, .deb). Possible later.
- arm64 Linux.
- HDR reading. It stays Windows only: `readHdr` returns null outside Windows (`hdr.ts:12`).
- DMA-BUF buffers in the first version. All three target portals deliver shared-memory buffers when no modifier is offered (see the helper).
- Capture through OBS, obs-vkcapture, X11-only APIs (XGetImage, XComposite) or compositor-specific protocols (wlr-screencopy, hyprland-toplevel-export).
- Running the Windows build of Twinmap under Wine.
- Steam Deck gaming mode (gamescope without a portal).
- Replay trials that find a window by title (`TWINMAP_WINDOW`). The portal exposes no titles, so `findWindow` returns null on Linux; replay of strips (`TWINMAP_REPLAY`) still works.

## Anti-goals: a failure even if it works

- The window picker pops up over the game without the player asking for it. A portal shows the picker by itself when a restore token matches no live window, so this can be made unlikely but not impossible. The lifecycle below is built around that.
- It needs root, a kernel module, OBS, or anything installed beyond a normal desktop with PipeWire.
- It changes behaviour on Windows or macOS.
- The strip decodes less reliably than on Windows, for example through colour conversion or scaling of the frames.
- Pixels from a window that is not the game are treated as the game's: decoded, sampled or uploaded.
- The AppImage bundles its own libpipewire, which can disagree with the system's PipeWire.

## Constraints

- The capture backend implements the `Capture` interface in `app/src/main/capture.ts`. `link.ts` and `index.ts` need small, Linux-gated changes (listed below). Windows and macOS paths stay as they are.
- The strip carries 3 bits per pixel: red, green and blue each on or off, one cell per pixel (`app/src/shared/strip.ts`). Frames must arrive as raw RGB, never as YUV or anything with chroma subsampling, and unscaled.
- The strip is read every 15 ms (`READ_EVERY` in `link.ts:14`), and a block stays on screen for 50 ms. The player chooses the edge, and the app tries all four (`EDGES`, `link.ts:18`). Every edge must be fresh on every frame, and reads must not wait on the compositor.
- Electron's V8 memory cage forbids external ArrayBuffers over a mapping. Shared memory is read with `mmap` and `memcpy` through koffi, as `capture-darwin.ts` does.
- The repository's comment rule applies to all code: almost no comments, at most one short line each.
- New user-facing text exists in all eight languages under `app/src/shared/i18n/`.

## Approaches considered

1. **Native C helper using the portal and PipeWire.** Picked by the contributor. A small program opens a portal ScreenCast session for one window, receives the PipeWire stream as raw buffers in shared memory, and writes the edges and a snapshot into shared memory that the app maps. It follows the macOS design (`capture-darwin.ts` + `native/capture-mac.swift`), so it is familiar to the maintainers, and it gets exact pixels. The cost is C code to maintain, plus PipeWire and GLib development headers in CI.
2. **Electron's built-in capture (`getDisplayMedia` / `desktopCapturer`).** Chromium uses the same portal, so there would be no native code. But Chromium may convert frames to a YUV 4:2:0 colour format, where neighbouring pixels share colour information, which would blur the 1-pixel cells. Frames would also go through a renderer and IPC. It was not picked: the contributor chose the route that is known to give exact pixels over a spike.
3. **Helper in Rust (ashpd + pipewire-rs).** Better libraries, but it adds a Rust toolchain to a TypeScript project, which upstream is unlikely to want. Dropped.

Also ruled out earlier: the OBS virtual camera (needs OBS), an obs-vkcapture listener (conflicts with OBS over one socket), X11 capture (black or stale frames for Vulkan games under XWayland), and wlr-screencopy (wlroots compositors only).

## Design

### Overview

```
link.ts ──► capture.ts ──► capture-linux.ts ──spawn──► twinmap-capture (C)
   ▲  session id,              ▲   mmap + flock            │ portal (D-Bus) → PipeWire stream
   │  trust                    └──── shared memory ◄───────┘ writes edges + snapshot, prints JSON lines
index.ts ── IPC "choose the window" (local window only) ──► capture-linux.ts
```

### The helper: `app/native/capture-linux.c` → `twinmap-capture`

**Start-up and descriptors**
- Spawned like the macOS helper (`capture-darwin.ts:204-222`): the parent opens a lock file twice (one descriptor for each side, so `flock` works across processes). It passes the frame descriptor's number as an argument: a `shm_open` descriptor, or the lock file itself when `shm_open` is denied.
- The restore token, if any, arrives on stdin as a JSON line, so it never shows in `ps`.
- Spawned with `LD_LIBRARY_PATH` removed from its environment, so libraries from the AppImage never shadow the system's libpipewire, its SPA plugins or GIO.

**Portal (GDBus, ScreenCast version 4 or later required, version 6 on current systems)**
1. Call `org.freedesktop.host.portal.Registry.Register("app.twinmap", {})` first, if the interface exists. Restore tokens are stored per app id, and an unsandboxed app otherwise gets an id derived from however it was launched, so a token from one launch path fails on another.
2. `CreateSession`, `SelectSources`, `Start`, `OpenPipeWireRemote`. Each request needs a `handle_token` (and `session_handle_token` on `CreateSession`). Subscribe to `Response` on the predicted request path `/org/freedesktop/portal/desktop/request/<sender without ':' and with '.'→'_'>/<token>` before calling. Codes: 0 ok, 1 cancelled, 2 other.
3. `SelectSources` options: `types` = 2 (WINDOW, `u`), `multiple` = false, `persist_mode` = 2 (persistent), `restore_token` if one was given, and `cursor_mode` = HIDDEN (1) if offered, else METADATA (4), never EMBEDDED. An embedded cursor paints over strip pixels.
4. `Start` returns the streams and, maybe, a new `restore_token`. Tokens are single-use on every portal: the helper prints every new token, and prints `{"token":null}` when `Start` returned none. On Hyprland that happens unless the player ticks "Allow a restore token" in the picker (off by default).
5. `OpenPipeWireRemote` returns its descriptor through a `GUnixFDList`. Watch the session's `Closed` signal.
- GDBus runs on a `GMainLoop`; PipeWire runs in a `pw_thread_loop`.

**PipeWire (libpipewire-0.3)**
- `pw_context_connect_fd` with the portal's descriptor. Target the stream by its `pipewire-serial` property through `target.object` (written as the literal key, so it builds against PipeWire older than 0.3.64), else by node id.
- Stream flags `AUTOCONNECT | MAP_BUFFERS`.
- **EnumFormat:** raw video, no `SPA_FORMAT_VIDEO_modifier` (this is what gets shared memory instead of DMA-BUF). Formats: BGRx, BGRA, RGBx, RGBA, xRGB, xBGR, ARGB, ABGR, BGR, RGB, and the 10-bit packed xRGB_210LE, xBGR_210LE, RGBx_102LE, BGRx_102LE. Xdph offers exactly one format, whatever the compositor uses, so a shorter list fails on some setups. Framerate `0/1` with a `maxFramerate` range up to 360/1; Mutter needs one, and 50 ms blocks need at least about 40 fps.
- **In `param_changed`:** send `SPA_PARAM_Buffers` with `dataType` = MemFd | MemPtr, and `SPA_PARAM_Meta` for `SPA_META_Header` and `SPA_META_VideoCrop`. Crop metadata only arrives if requested.
- **Per buffer:** skip it when `chunk->size == 0` or the header is flagged corrupted. Honour stride and crop. Convert every format to BGRA, taking the top 8 bits of 10-bit channels; on/off cells survive that.

**Shared memory layout**
1. Header, 16 bytes: frame counter (u32), session number (u32), monotonic time of the last frame in ms (u64).
2. Live, on every frame: a top band of `topRows` rows (as macOS: enough to hold a title bar, `max(64, …) + 1`), the bottom row, the left column, the right column (each column `height` pixels).
3. Full snapshot, `height` rows, at most 5 times a second, for `readRect` and `readBox`.

Each write holds `flock(LOCK_EX | LOCK_NB)` on the lock file and skips the frame if the app holds the lock. The reader takes `LOCK_SH | LOCK_NB`, as on macOS.

**Messages on stdout, one JSON line each**
- `{"layout":{"width":…,"height":…,"topRows":…}}` on the first frame, and again after reallocating when the size changes.
- `{"token":"…"}` or `{"token":null}` after every `Start`.
- `{"state":"cancelled"|"refused"|"closed"|"unsupported"}` before exiting for those reasons. "Unsupported" covers a portal that is missing or too old, and buffers that are not shared memory.
- Diagnostics go to stderr, which the app logs. The helper exits when stdin closes.

**Build:** `scripts/linux-build.cjs` compiles it with `cc` and `pkg-config --cflags --libs libpipewire-0.3 gio-2.0 gio-unix-2.0` into `dist-native/twinmap-capture`. It does nothing on other platforms, as `mac-build.cjs` does on non-macOS. In `package.json`, `predev` runs both build scripts in turn (`node scripts/mac-build.cjs && node scripts/linux-build.cjs`), and a new `predist:linux` runs the Linux one. `predist:mac`, `postdist:mac` and `probe:mac` stay as they are.

### `app/src/main/capture-linux.ts`

Loaded by `capture.ts` when `process.platform === 'linux'`.

**Finding the game process**
- `findGameWindow()` scans `/proc/*` for processes of the current user whose `/proc/<pid>/comm` is `Wow.exe` (Wine sets the process name to the program's file name). It keeps those whose first command-line field (argv[0], not the whole command line, since launchers add arguments) contains `_forever_` followed by `Wow.exe`, accepting both `\` and `/`, case-insensitive. Returns the pid as the handle.
- `programOf(pid)` returns the **Linux** path of the program: the `Wow.exe` image mapped in `/proc/<pid>/maps`, resolved through `/proc/<pid>/root/` so Steam's pressure-vessel and Flatpak sandboxes work. That keeps the existing `findGameFolder` in `index.ts:64-70` working unchanged: it passes the path to `gameFolderFrom`, which walks up to the game folder.
- `findWindowOf(program)` does the same scan, testing the resolved Linux path. `findWindow(title)` returns null.
- `TWINMAP_CAPTURE_TEST_PROGRAM` works only in an unpackaged app, as on macOS. On Linux it names an exact argument of the test process's command line (the probe's or the strip window's script path), because those windows run in an Electron process like the app itself.

**Capture state**

`capture-linux.ts` keeps one state, published to `index.ts` and `link.ts`:

| State | Meaning |
|---|---|
| `idle` | No game running, or nothing started yet |
| `waiting` | Game running, nothing to restore, waiting for the player to choose the window |
| `picking` | Picker open, or restoring with a token |
| `running` | Frames arriving |
| `cancelled` / `refused` | The player closed the picker, or the portal said no. Waits for a click. |
| `unsupported` | No usable portal or PipeWire. Shown with what is missing. |

**Lifecycle**
- **Starting with a saved token** (decided by the contributor): automatic only where the game window can be proven to exist; everywhere else, one click per game session.
  - **Hyprland** (`HYPRLAND_INSTANCE_SIGNATURE` is set): once the game process runs, poll Hyprland's read-only IPC (the `j/clients` request on `$XDG_RUNTIME_DIR/hypr/<signature>/.socket.sock`, the same data as `hyprctl clients -j`) every second. Restore only when a mapped client with the game's pid exists. If the pid isn't reported for XWayland clients, match the window class xdph restores by instead (Wine uses the program name, `wow.exe`); verify which on the real game.
  - **Every other desktop:** state `waiting`, with a **Connect** button. A click starts the helper with the saved token, if any. With a valid token no picker appears; without one, the picker opens because the player asked for it.
  - Without a saved token, every desktop waits for the click.
- The helper runs while the game process lives. It is stopped when the game exits, on app quit (`stopCapture`, `index.ts:1112`), and when the player chooses another window.
- **Recovery runs on its own timer, not on reads.** `link.ts` stops reading while a window is minimized (`link.ts:118-135`), so a restart that waits for a read never happens. A 1-second timer checks helper health and restarts after an unexpected exit (after 3 s, as on macOS), but only with a token. It never opens a picker on its own.
- After any restart, the session number in the header changes.

**Reads**
- `readRow` takes all four edges from the live area, so they are never older than one frame. The top row is read at the content top (below).
- `readRect` and `readBox` come from the snapshot.
- **Content top:** on GNOME and KDE a window stream of an XWayland window may include its title bar, as on macOS. Reuse `contentTop` from `capture-darwin-frame.ts` on the live top band, with the same rescan cadence. Hyprland draws no decorations, so there the top is 0.
- `at` in a `readRect` result is in window coordinates. It is passed to `readHdr`, which returns null outside Windows.

**Trust**
- `showsOnly`, and `readRect` with `own = true`, return false/null until `link.ts` has decoded a valid strip block **in the current capture session**. A portal window has no proven tie to the game process, so the strip is the proof. `samples.ts` and portrait cuts then only use pixels from the game.
- `link.ts` (Linux only) reads the session number. On a change it resets the game state it decoded and the trust, so nothing from a previous window outlives a repick.

**`windowState(pid)`**
- `gone` once the process has exited.
- `minimized` only when a stream is running, has delivered at least one frame, and none for 2 seconds. Counting starts at the first frame of each stream, so the picker, start-up and renegotiation after a resize never count. Hyprland keeps sending frames for windows on hidden workspaces, so there it simply stays `open`.
- `open` otherwise.

### Settings and the token

- `Settings` and `readSettings` (`setup.ts:17-64`) get an optional `captureToken: string`, validated like the other fields. `readSettings` drops unknown fields, so this is required.
- `index.ts` owns the one in-memory settings object (`index.ts:338-340`). It gives `capture-linux.ts` a getter and a setter that go through that object and its existing write. A token written behind its back would be overwritten by the next settings change.
- Settings are read before capture is first allowed to start. At startup today, capture is checked before `createWindow` reads settings (`index.ts:1126-1144`).
- Every `{"token"}` line replaces the saved token; `{"token":null}` deletes it.

### Changes to existing flows

- **Startup (`index.ts:1126-1144`):** the automatic `requestCapture()` and its System Settings log line become macOS only. On Linux, startup never opens the picker.
- **Interface:** `requestCapture()` keeps its synchronous boolean, meaning "a request was started". The outcome arrives later through the capture state. New optional members: `captureState()` and `forgetCapture()`.
- **IPC:** a new handler, "choose the window", called only from the app's own window, never from LAN clients. It calls `forgetCapture()` if needed, then `requestCapture()`. The state is broadcast with the setup status and the link snapshot.
- **Setup status and link snapshot:** today both report `screenRecording` only on macOS (`index.ts:575`, `link.ts:153-161`). On Linux both get `linux: true` and the capture state. `shared/setup.ts` and `shared/link.ts` map each state to a line, with a button: **Connect** for `waiting` (it reuses a saved token, or opens the picker when there is none), and **Choose the window** for `cancelled`, `refused` and a token that did not restore. While the game runs on Linux, a **Choose another window** control always stays available, on the first-run play page (`FirstRun.svelte`) and in the map's status.
- **Wrong window hint:** if a session has delivered frames for 10 seconds without a valid block, not paused, the status suggests choosing another window. The timer resets on each new session and on resume.
- **Hyprland token hint:** when `Start` returned no token on Hyprland, the status says the window will be asked for again next time. It explains the "Allow a restore token" box in the picker, and the `screencopy:allow_token_by_default` option.
- **Addon protocol wording:** `createGame(process.platform === 'win32')` (`link.ts:63`) means "the app updates itself". On Linux it is true when running from an AppImage.
- **Folder discovery when the game starts later:** discovery runs once when the window is created (`index.ts:338-340`). On Linux, if no folder is known yet and the game process appears, discovery runs again.
- **All new text in all eight languages**, next to `screenRecording`, with key comments saying they are Linux only.

### Finding the game folder (`app/src/main/client-files.ts`)

`gameInstallPaths()` gets a Linux branch returning candidate paths for `gameFolderFrom` (`client-files.ts:70-83`), which walks each one up and checks `installedBuild` at every level:

1. **From the running game:** `programOf(pid)`, the resolved Linux path of `Wow.exe` from `/proc/<pid>/maps`. It needs no prefix or drive mapping.
2. **From Wine registries** of candidate prefixes: `InstallPath` under `Software\Wow6432Node\Blizzard Entertainment\World of Warcraft`, and under `Software\Blizzard Entertainment\World of Warcraft` for 32-bit prefixes, in `system.reg`.
   - Match key names case-insensitively: "Wow6432Node", "WOW6432Node" and "SOFTWARE" all occur.
   - Decode values exactly as Wine writes them: `\\`, `\"`, C escapes, octal below 32, and `\x` with variable-length hex for UTF-16 code units above 127.
   - Map the Windows path to `<prefix>/drive_c` for C:, or through `<prefix>/dosdevices/<letter>:` for other drives.
   - wineserver writes the file lazily, so it can be stale while the game runs; step 1 covers that case.
3. **Candidate prefixes:**
   - `$WINEPREFIX`, `~/.wine`
   - Lutris: `prefix:` in `~/.local/share/lutris/games/*.yml`, `~/.config/lutris/games/*.yml` (older versions), `~/.var/app/net.lutris.Lutris/data/lutris/games/*.yml`; and `~/Games/*`
   - Bottles: `~/.local/share/bottles/bottles/*`, `~/.var/app/com.usebottles.bottles/data/bottles/bottles/*`
   - Steam: `compatdata/*/pfx` in every library listed in `libraryfolders.vdf`, for `~/.local/share/Steam`, `~/.steam/steam` and `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`
   - Missing or unreadable folders and `/proc` entries are skipped; the "pick folder" dialog remains the fallback.

`registryInstallPath()` stays Windows only. The command-line matching, maps parsing, `system.reg` parsing, drive mapping, `libraryfolders.vdf` parsing and prefix discovery are pure functions with unit tests.

### Window, packaging and updates

- **Window (`index.ts:276-290`):** the window uses `titleBarStyle: 'hidden'` with `titleBarOverlay`, which Electron supports on Linux. The zoom handler that resizes the overlay (`index.ts:935`) covers Linux too. If the window controls are missing on a Wayland desktop (reported for GNOME), Linux falls back to a native frame. The application menu is hidden when packaged, as on Windows.
- **Always on top:** does nothing under Wayland, so the setting is hidden on Linux.
- **electron-builder:**
  - A `linux` section: `target: AppImage`, `category: Game`, `artifactName: Twinmap-${version}-x86_64.${ext}`, a desktop entry matching the app id `app.twinmap`.
  - The helper as a Linux-scoped extra resource (`resources/twinmap-capture`), keeping the global `nav` and `LICENSE.txt` resources.
  - `toolsets.appimage: "1.0.3"`: the static FUSE 3 runtime. The default runtime in electron-builder 26 needs FUSE 2, which current Arch and others don't install.
  - Script `dist:linux` = `electron-vite build && electron-builder --linux AppImage --x64 --publish never`.
- **Chromium sandbox:** on Ubuntu 24.04 and later, AppArmor blocks the user namespaces Chromium's sandbox needs, and Electron AppImages abort. electron-builder's AppRun turns the sandbox off only in that case (electron-builder PR #9590). The build checks that the produced AppRun contains this check.
- **Updates (`update.ts`):** the gate also allows Linux when `process.env.APPIMAGE` is set. electron-updater reads `latest-linux.yml`, which electron-builder writes even with `--publish never`. Check how the `--updated` relaunch logic behaves for an AppImage, and how a versioned file name behaves after an update. The README links the stable-name download.

### CI and releases

- **`ci.yml`:** a job `app-linux` on `ubuntu-22.04` (an older glibc, so the helper runs on more systems), gated by the same `changes` output as `app-mac`. Steps:
  1. Install `libpipewire-0.3-dev` and `libglib2.0-dev`.
  2. `npm ci`, `check`, `test`, `build`, `dist:linux`.
  3. Verify that the AppImage contains the helper, `nav` and `LICENSE.txt`.
  4. Verify that the helper is x86_64 and links only system libraries, and print its highest required `GLIBC_` version.
  5. Verify that the AppRun contains the sandbox check.

  It does not capture: hosted runners have no portal.
- **`release.yml`:** a job `linux` on `ubuntu-22.04` that needs the job creating the release. It derives `VERSION` from the tag and builds with `-c.extraMetadata.version="$VERSION"`, as the Windows job does (`release.yml:69-72`). It checks that file names and `latest-linux.yml` carry that version. It uploads `Twinmap-$VERSION-x86_64.AppImage`, a copy named `Twinmap-x86_64.AppImage`, and `latest-linux.yml` with `gh release upload --clobber`, so a failed run can be re-run without touching the Windows assets.
- **README:** a Linux download button and a "Linux" section covering:
  - the portal picker and the restore-token box on Hyprland
  - scaling: on XWayland, set `xwayland:force_zero_scaling` (Hyprland) or use scale 1 for the game's monitor, otherwise the game is upscaled and the strip blurs
  - on Hyprland, no window rounding for the game (`rounding 0`, or fullscreen), since rounded corners hide the start of the strip
  - that "always on top" is not available, and a compositor rule (Hyprland `pin`) does it instead
- **CHANGELOG:** an entry in the project's style.

### Tests

- **Unit tests (vitest), next to the existing ones:**
  - process matching
  - `/proc/<pid>/maps` parsing and root resolution
  - `system.reg` decoding and drive mapping
  - `libraryfolders.vdf` and prefix discovery against a fake home folder
  - validation of the helper's layout line
  - the `windowState` rules
  - the capture state machine: initial, restored, cancelled, refused, token not returned, helper exit and retry, repick, game exit
  - settings: a token rotating while other settings are written
- **The C helper:** built and link-checked in CI.
- **By hand with the real game:**
  - the strip decodes at full rate on all four edges, including pause and `/reload`
  - minimap reads match Windows
  - a repick to a wrong window is never trusted
  - restore across a game restart and an app restart
  - Hyprland once with `allow_token_by_default` off
  - fractional scale with and without `force_zero_scaling`

## Desktop coverage

Decided by the contributor. Before the pull request:

- **Hyprland:** full test with the real game (the by-hand list above).
- **GNOME and KDE:** in virtual machines, with a test window instead of the game. It shows recorded strips and is matched through `TWINMAP_CAPTURE_TEST_PROGRAM`. It proves the portal flow (picker, Connect, token restore, cancel), shared-memory buffers and the pixel format, title-bar handling in windowed mode, and the window controls under Wayland.

The README and the pull request say exactly that: tested with the game on Hyprland, and with recorded strips on GNOME and KDE. How the test window is built (a small page or script drawing strips from a `TWINMAP_REPLAY`-style file) is left to the builder.

## Open risks

- **Scaling detection.** A Hyprland window stream is always the composited, scaled image. The README states the requirement. Detecting a violation in the app needs a reference: either the addon reports its physical resolution, or the decoder notices cells wider than 1 pixel. The builder checks whether the addon already sends a usable size.
- **Title bars on GNOME and KDE** are handled by the content-top scan, but unverified until tested there.
- **AppImage updates** with versioned file names may break user shortcuts; verify, and prefer the stable name.

## Left to the builder

- Exact names of new settings fields, i18n keys, IPC channels and state values, following existing patterns.
- Layout of the new status lines and buttons in the existing setup and map components.
- Internal structure of the C helper, as long as it keeps the protocol above.
- Whether the shared-memory reading code is shared with `capture-darwin.ts`. Prefer sharing if it stays simple.

## Calls made during review (not decided by the contributor)

- Always on top hidden on Linux, with a Hyprland `pin` hint in the README.
- `findWindow(title)` returns null; title-based replay trials are unsupported on Linux.
- CI and release build on `ubuntu-22.04` for an older glibc.
- `toolsets.appimage: "1.0.3"` (FUSE 3 runtime) instead of the FUSE 2 default.
- Relying on electron-builder's AppRun sandbox check rather than turning the sandbox off always.
- The macOS title-bar scan (`contentTop`) reused for GNOME and KDE, instead of assuming content-only streams.
- Trust only after a strip block decodes in the current capture session.

## Changes made while planning

Findings from checking the plan against the code and the contributor's machine (WoW under umu / GE-Proton on Hyprland). The plan is authoritative where it differs from the sections above.

- **Finding the game process:** by argv0 alone (`…\_forever_\Wow.exe`, either slash, any case), not `comm`. Wine copies Windows thread names into `comm` (Battle.net shows `CrBrowserMain`).
- **The Wow.exe path:** under Proton, `/proc/<pid>/maps` holds no `Wow.exe` image, only DLLs from `_forever_`. The path comes from the first that exists of: the mapped image, `Wow.exe` beside mapped `_forever_` files, the prefix plus argv0, the working folder.
- **Hyprland auto-restore:** matches the client's pid only, with a plain-Wine `wow.exe` class fallback. Under Proton the class is `steam_app_battlenet`, which the Battle.net launcher shares.
- **Test windows:** `TWINMAP_CAPTURE_TEST_PROGRAM` is the script's absolute path. A command-line token resolved against the process's cwd matches it, because Chromium rewrites its command line into one space-joined string.
- **Shared memory:** a memfd (`memfd_create`), with the lock file as fallback. The helper only grows it, never shrinks, so an old mapping in the app never faults. The header is 24 bytes, adding width and height, and a reader ignores frames whose size differs from its layout.
- **Registry.Register("app.twinmap"):** fails without an installed desktop file. The helper logs it and continues; restore tokens still work.
- **A closed stream** (window recreated) goes to waiting, never to a retry. Only a helper crash while running retries, once, and only with a token.
- **Choose another window:** clears the saved token before connecting. It is always reachable in Settings while the game runs, and on the play page and the map whenever a hint is shown.
- **The AppImage:**
  - The desktop name is `app.twinmap.desktop` (`desktopName` plus `syncDesktopName`), giving the window class `app.twinmap`.
  - electron-builder 26.18's AppRun already turns the sandbox off only where `unshare -Ur true` fails, so no custom AppRun is needed.
  - The config folder is `~/.config/twinmap`.
- **The helper** compiles with `-std=c11 -D_GNU_SOURCE` and writes `target.object` as a literal, so it builds against PipeWire 0.3.48 on Ubuntu 22.04.
