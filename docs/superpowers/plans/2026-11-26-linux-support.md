# Linux Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Linux x86_64 AppImage of the Twinmap app that reads the addon's strip off the WoW: Forever window (Wine/Proton) through xdg-desktop-portal ScreenCast and PipeWire.

**Architecture:**
- A C helper (`twinmap-capture`) opens a portal ScreenCast session for one window and receives raw shared-memory buffers from PipeWire. It writes the four edges (every frame) and a snapshot (at most 5 times a second) into a memfd shared with the app.
- `capture-linux.ts` implements the existing `Capture` interface over that memory. It adds a capture state machine, a restore token kept in the app's settings, a trust rule (a window counts as the game only after a strip decodes), and Hyprland-only automatic reconnect.
- Small Linux-gated changes in `index.ts`, `link.ts`, `shared/setup.ts`, `shared/link.ts` and the renderer show the state and the Connect / Choose another window buttons.

**Tech Stack:** Electron 45, electron-vite 6, Svelte 5, TypeScript 5.9 (strict, `verbatimModuleSyntax`), vitest 5 (no config, default `forks` pool), koffi 3.3.7, electron-builder 26.18 (AppImage, static runtime toolset 1.0.3), electron-updater 6.8, C11 + `_GNU_SOURCE` with libpipewire-0.3 (≥ 0.3.48) and GIO.

**Spec:** `docs/superpowers/specs/2026-11-26-linux-support-design.md`, including its section "Changes made while planning". Read the section a task names before starting.

## Facts from the contributor's machine (verified read-only)

Implementers rely on these; do not re-derive them.

| Fact | Value |
|---|---|
| System | Arch, Hyprland 0.56.2, xdg-desktop-portal 1.22.1, xdph 1.4.1, PipeWire 1.6.9, GLib 2.90, glibc 2.44 |
| AppImage runtime | fuse3 only (no fuse2); `unshare -Ur true` succeeds |
| How WoW runs | Under umu / GE-Proton (Steam), pid example 536112 |
| `/proc/<pid>/comm` | `Wow.exe` (but Wine copies Windows thread names into comm; Battle.net shows `CrBrowserMain`) |
| argv0 | `D:\Games\World of Warcraft\_forever_\Wow.exe -launcherlogin -uid wowf`, as one NUL field plus arguments, with about 200 trailing NULs. Under umu argv0 can start with lowercase `c:`. |
| `/proc/<pid>/maps` | About 4973 lines. **No `Wow.exe` image**, only DLLs, e.g. `/mnt/stuff/Games/World of Warcraft/_forever_/libxell.dll` |
| Prefix | environ `WINEPREFIX=/home/lkshrk/Games/battlenet/pfx/` (`pfx -> .`); `dosdevices/d: -> /mnt/stuff`; raw `e::`-style device links exist |
| cwd | `/mnt/stuff/Games/World of Warcraft/_forever_` |
| `system.reg` | `[Software\\Wow6432Node\\Blizzard Entertainment\\World of Warcraft]` with `"InstallPath"="D:\\Games\\World of Warcraft\\_forever_\\"`. An `...\\Uninstall\\World of Warcraft` key also exists. |
| Game folder (holds `.build.info`) | `/mnt/stuff/Games/World of Warcraft` |
| Hyprland socket | `$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket.sock`. `j/clients` returns JSON, then the server closes the connection. |
| WoW Hyprland client | `{"pid":536112,"class":"steam_app_battlenet","title":"World of Warcraft","mapped":true,"hidden":false,"xwayland":true}` |
| Battle.net client | **Same class** `steam_app_battlenet`, title `Battle.net`, a different pid |
| Contributor's xdph | `allow_token_by_default = true`; DP-1 at scale 1.25 with `xwayland:force_zero_scaling = true`; rounding 0 |
| Chromium's command line | Rewritten into one space-joined string (setproctitle). `npm run` passes scripts as **relative** paths. |
| `-std=c11` | Fails against PipeWire 1.6 headers; `-std=c11 -D_GNU_SOURCE` compiles cleanly |
| electron-builder 26.18 AppRun sandbox check | `if [ $HAVE_NO_SANDBOX -eq 0 ] && ! unshare -Ur true 2>/dev/null ; then NO_SANDBOX=(--no-sandbox)`. AppRun also exports `LD_LIBRARY_PATH="${APPDIR}/usr/lib..."`. |
| Packaged config folder | `~/.config/twinmap`: `app.name` is `twinmap`, since `productName` is not merged into the packaged package.json |

## Iterations

Each iteration ends with a product the contributor can run on Arch/Hyprland. The last task of each iteration is a manual check with exact steps.

| Iteration | Tasks | Testable product |
|---|---|---|
| 1. Runs on Linux, finds the game | 1–4 | App and AppImage start on Linux and find the game folder (Wine registry, live process). Status shows the game running, no picker. CI builds Linux. |
| 2. Helper captures, standalone | 5–8 | `npm run probe:linux` opens the picker and decodes a probe window's strip on every edge. `npm run probe:linux -- --game` does it on the real WoW. |
| 3. Live map | 9–12 | `npm run dev`, click **Connect**, pick WoW: the arrow moves. A wrong window is never trusted. |
| 4. Remembers and protects | 13–16 | The saved choice survives restarts, silent reconnect on Hyprland, Choose another window, hints. |
| 5. Release-ready AppImage | 17–19 | AppImage with helper, FUSE 3 runtime, sandbox check, self-update from a local feed, release job, README, CHANGELOG. |
| 6. GNOME and KDE | 20–22 | Title bars handled, strip test window, checklist passes in GNOME and KDE VMs. |

## Global Constraints

- **Comments:** almost none, at most one short line each. No banners, no step narration, no references to tasks or PRs, no TODOs. Every subagent brief includes this rule.
- **Windows and macOS must not change.** Every new branch is gated on `process.platform === 'linux'`, or on a member only `capture-linux` implements (optional `Capture` members whose wrappers return null or no-op elsewhere).
- **Frames:** raw RGB, unscaled. Never YUV, never chroma subsampling.
- **Timing:** `READ_EVERY = 15` ms; blocks stay up 50 ms. All four edges are fresh on every frame.
- **Shared memory:** read with `mmap` + `memcpy` through koffi, never `koffi.view` (Electron's V8 memory cage). The helper only ever grows the memory, so an old mapping never faults (SIGBUS).
- **Time across processes:** the helper uses `CLOCK_MONOTONIC`. In Node that is `process.hrtime.bigint() / 1_000_000n`. Never `performance.now()` or `Date.now()` against helper times.
- **Picker:** never opens without a click, except on Hyprland when its IPC shows a mapped client with the game's pid and a token is saved. Retries never open it.
- **Trust:** pixels count as the game's only after a strip block decoded in the current capture session.
- **Libraries:** the AppImage does not bundle libpipewire or GIO. The helper is spawned with `LD_LIBRARY_PATH` (and `GSETTINGS_SCHEMA_DIR`) removed from its environment.
- **Build compatibility:** the helper compiles on Ubuntu 22.04 (PipeWire 0.3.48, glibc 2.35). Write `"target.object"` as a literal, never `PW_KEY_TARGET_OBJECT`.
- **Translations:** every new user-facing string goes into all eight languages (`en`, `fr`, `es-ES`, `es-MX`, `de`, `ru`, `ko`, `zh`) with the same `{names}`, enforced by `i18n.test.ts:140`.
  - No en or em dashes (`:157`).
  - No hand-written English in `.svelte` markup, or in the scripts of `link.ts`/`setup.ts` (`:179`, `:201`).
  - Translator comments go only in `en`, above the key.
- **IPC:** new window-only IPC uses plain `ipcMain.handle`, never `asks()` (LAN phones can reach `asks()` calls). Each one needs its `ipcMain.removeHandler` line in the close handler (`index.ts:1095-1108`). A new renderer call needs four edits: `preload/index.ts`, `renderer/src/twinmap.d.ts`, `renderer/src/web.ts` (stub `() => Promise.resolve()` in the "stays on the computer" block near `:83`), and the main handler.
- **Tests:** vitest, co-located `*.test.ts`, flat `test('long sentence', …)`, no mocks.
  - Use real temp folders: `mkdtempSync(join(tmpdir(), 'twinmap-<area>-'))`.
  - Linux-only tests: `test.skipIf(process.platform !== 'linux')`. Tests that need symlinks or `/`-rooted paths: `test.skipIf(process.platform === 'win32')`. CI runs `npm test` on Windows and macOS too.
  - vitest strips types, so a type-only change fails in `npm run check`, not in `npm test`. Verification steps say which.
- **Type imports:** use `import type`.
- **Commits:** plain sentences in the repository's style. No AI attribution, no `Co-authored-by`, no session links.
- **Checks:** run from `app/`. `npm run check` and `npm test` must pass at every commit.

## Review Focus

1. **The game recreates its window** (fullscreen toggle, resolution change). The stream ends (`closed`) or resizes (new `layout`).
   - A resize relayouts in place.
   - `closed` goes to `waiting`, never a retry. On Hyprland, `autoRestore` then reconnects silently; elsewhere it shows Connect.
   - No stale game state, and no picker.
   - Pinned in Task 9 (table rows) and Task 11 (new session resets the link).
2. **Several matching processes** (a stale WoW, launcher children): prefer a pid with anything mapped from a `_forever_` folder, else the lowest pid. Best effort; `gameFolderFrom` checks `.build.info`. Pinned in Task 2.
3. **Non-ASCII install path in `system.reg`** (`\x` escapes with variable-length hex, octal): expect the exact Unix path. Pinned in Task 1.
4. **The game exits and restarts while the app runs:** helper stopped, state `idle` then `waiting`, last position kept (as on Windows), token reused only by the auto-start rule. Pinned in Tasks 9 and 11.
5. **Helper missing, PipeWire or portal unavailable, or DMA-BUF only:** state `unsupported` with a line saying what is missing, never a crash or retry loop. Pinned in Task 9 (`spawnError`, `state:unsupported`) and Task 7 (stream ERROR before the first frame).

---

## Iteration 1: Runs on Linux, finds the game

### Task 1: Wine prefixes and the game's registry entry

**Files:**
- Create: `app/src/main/wine-prefixes.ts`
- Test: `app/src/main/wine-prefixes.test.ts`

**Interfaces:**
- Produces:
  - `decodeRegString(raw: string): string`: the inside of a quoted `system.reg` string or key name
  - `regValue(systemReg: string, keyPath: string, name: string): string | null`
  - `windowsToUnix(prefix: string, winPath: string): string | null`
  - `steamLibraries(vdf: string): string[]`
  - `lutrisPrefix(yml: string): string | null`
  - `candidatePrefixes(home: string, env: Record<string, string | undefined>): string[]`
  - `wineInstallPaths(home = homedir(), env: Record<string, string | undefined> = process.env): string[]`. The defaults are read at call time.
  - `WOW_KEYS = ['Software\\Wow6432Node\\Blizzard Entertainment\\World of Warcraft', 'Software\\Blizzard Entertainment\\World of Warcraft']`

**Rules:**
- **Key lines:** match `/^\[(.*)\](?:\s+\d+)?\s*$/`. Decode the name with `decodeRegString` and compare the **whole** path case-insensitively. Values follow until the next key line. Skip `#…` lines and `@=` lines.
- **`decodeRegString`:** handles `\\`, `\"`, the escapes `\a \b \t \n \v \f \r \e` (`\e` = 0x1b), octal `\N`…`\NNN`, and `\x` with 1–4 hex digits as one UTF-16 code unit. Wine writes `\x%04x` and `\%03o` only when the next character is a hex or octal digit, otherwise the short form.
- **`windowsToUnix`:** lowercase the drive letter. `c:` maps to `<prefix>/drive_c`; other letters map through `realpathSync(<prefix>/dosdevices/<l>:)`. Build the result with `join`, so there is no trailing slash. Return null for UNC paths (`\\server`), a missing letter, and `x::` raw device links.
- **`candidatePrefixes` order:**
  1. `env.WINEPREFIX`
  2. `~/.wine`
  3. Lutris `prefix:` from `~/.local/share/lutris/games/*.yml`, `~/.config/lutris/games/*.yml`, `~/.var/app/net.lutris.Lutris/data/lutris/games/*.yml`
  4. `~/Games/*`
  5. `~/.local/share/bottles/bottles/*`, `~/.var/app/com.usebottles.bottles/data/bottles/bottles/*`
  6. Steam `compatdata/*/pfx` for every library in `libraryfolders.vdf`, under `~/.local/share/Steam`, `~/.steam/steam` and `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`

  Keep existing folders only. Deduplicate by `realpathSync`, but return the first spelling as written.
- **`lutrisPrefix` regex:** `/^\s+prefix:\s*['"]?(.*?)['"]?\s*$/m`.
- **`steamLibraries` regex:** `/^\s*"path"\s+"((?:[^"\\]|\\.)*)"/gm`, then unescape `\\`.
- **`wineInstallPaths`:** for each prefix, the first `InstallPath` under `WOW_KEYS`, mapped. Every read sits in try/catch.

- [ ] **Step 1: Write the failing tests.** The string-only ones run unguarded; the folder ones use `test.skipIf(process.platform === 'win32')`.

```ts
test('registry strings decode as Wine writes them', () => {
  expect(decodeRegString('C:\\\\Program Files (x86)\\\\World of Warcraft\\\\')).toBe('C:\\Program Files (x86)\\World of Warcraft\\')
  expect(decodeRegString('a\\"b\\tc')).toBe('a"b\tc')
  expect(decodeRegString('\\x9b4f\\x5f8f')).toBe('\u9b4f\u5f8f')
  expect(decodeRegString('caf\\x00e9a')).toBe('caf\u00e9a')
  expect(decodeRegString('caf\\xe9z')).toBe('caf\u00e9z')
  expect(decodeRegString('C:\\\\Spiele\\\\W\\xf6W')).toBe('C:\\Spiele\\WöW')
  expect(decodeRegString('x\\1y\\e')).toBe('x\u0001y\u001b')
})
test('a value is read under its whole key whatever the case of the key path', () => {
  const reg = 'WINE REGISTRY Version 2\n\n[Software\\\\Wow6432Node\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\World of Warcraft] 1\n"InstallPath"="wrong"\n\n[Software\\\\WOW6432Node\\\\Blizzard Entertainment\\\\World of Warcraft] 1700000000\n#time=1d9\n@="x"\n"InstallPath"="C:\\\\Games\\\\World of Warcraft\\\\"\n"Other"="x"\n\n[Software\\\\Other] 1\n"InstallPath"="wrong"\n'
  expect(regValue(reg, WOW_KEYS[0]!, 'InstallPath')).toBe('C:\\Games\\World of Warcraft\\')
  expect(regValue(reg, 'Software\\Missing', 'InstallPath')).toBeNull()
})
test('Steam libraries are read from libraryfolders.vdf', () => {
  expect(steamLibraries('"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"/a/Steam"\n\t\t"apps"\n\t\t{\n\t\t\t"1"\t\t"2"\n\t\t}\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"/b/Lib"\n\t}\n}\n')).toEqual(['/a/Steam', '/b/Lib'])
})
test('a Lutris game config names its prefix, quoted or not', () => {
  expect(lutrisPrefix('game:\n  exe: drive_c/x.exe\n  prefix: /home/p/Games/battlenet\nwine:\n  version: x\n')).toBe('/home/p/Games/battlenet')
  expect(lutrisPrefix("game:\n  prefix: '/home/p/flat'\n")).toBe('/home/p/flat')
  expect(lutrisPrefix('game:\n  exe: x\n')).toBeNull()
})
```

  Folder tests (skip on win32):
  - **`'C: maps to drive_c and other letters through dosdevices, lowercase'`**
    - Setup: `prefix` and `other` from mkdtemp; `mkdirSync(join(prefix,'drive_c'))`; `mkdirSync(join(prefix,'dosdevices'))`; `symlinkSync(other, join(prefix,'dosdevices','d:'))`.
    - `windowsToUnix(prefix,'C:\\Games\\World of Warcraft\\')` gives `join(prefix,'drive_c','Games','World of Warcraft')`.
    - `windowsToUnix(prefix,'D:\\Games\\World of Warcraft\\_forever_\\')` gives `join(realpathSync(other),'Games','World of Warcraft','_forever_')`.
    - `'Q:\\x'` and `'\\\\srv\\share'` give null.
  - **`'candidate prefixes cover Wine, Lutris, Bottles and Steam in their usual places, skipping missing ones'`**
    - Fake `home` contents:
      - `custom/`, passed as `WINEPREFIX`
      - `.wine/`
      - `.local/share/lutris/games/bnet.yml` = `` `game:\n  exe: x.exe\n  prefix: ${home}/Games/bnet\n` ``
      - `.config/lutris/games/old.yml` pointing to `${home}/old`
      - `.var/app/net.lutris.Lutris/data/lutris/games/f.yml` = `` `game:\n  prefix: '${home}/flat'\n` ``
      - `.local/share/lutris/games/gone.yml` pointing to `${home}/missing`
      - `Games/bnet/`, plus `symlinkSync('.', join(home,'Games','bnet','pfx'))`
      - `old/`, `flat/`
      - `.local/share/bottles/bottles/b1/`, `.var/app/com.usebottles.bottles/data/bottles/bottles/b2/`
      - `.local/share/Steam/steamapps/libraryfolders.vdf` listing `${home}/.local/share/Steam` and `${home}/lib2`
      - `lib2/steamapps/compatdata/123/pfx/`, and `lib2/steamapps/compatdata/456/` with no `pfx`
      - `symlinkSync(join(home,'.local/share/Steam'), join(home,'.steam','steam'))`
    - Expect exactly `['custom', '.wine', 'Games/bnet', 'old', 'flat', 'b1 path', 'b2 path', 'lib2/steamapps/compatdata/123/pfx']`, each joined onto `home`.
  - **`'install paths come from each prefix registry, mapped to Unix paths, 64- and 32-bit keys'`**
    - Prefix A's `system.reg` = `'WINE REGISTRY Version 2\n;; All keys relative to REGISTRY\\\\Machine\n\n[Software\\\\Wow6432Node\\\\Blizzard Entertainment\\\\World of Warcraft] 1793952817\n#time=1dd6dc6b97868a2\n"InstallPath"="C:\\\\Games\\\\World of Warcraft\\\\_forever_\\\\"\n'` gives `join(A,'drive_c','Games','World of Warcraft','_forever_')`.
    - Prefix B with only the 32-bit key is found too.
    - Call `wineInstallPaths(home, { WINEPREFIX: A })`, with B as `home/.wine`.
- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/main/wine-prefixes.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** per the rules above.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/wine-prefixes.ts app/src/main/wine-prefixes.test.ts && git commit -m "Find WoW installs in Wine, Lutris, Bottles and Steam prefixes"`

### Task 2: Wine process discovery

**Files:**
- Create: `app/src/main/wine-process.ts`
- Test: `app/src/main/wine-process.test.ts`

**Interfaces:**
- Consumes: Task 1 `windowsToUnix`.
- Produces (`proc` defaults to `'/proc'`, `uid` to `process.getuid?.() ?? -1`):
  - `findPid(match: (pid: number, cmdline: string) => boolean, proc?, uid?): number | null`: the lowest pid owned by `uid` (first `Uid:` field of `status`), not a zombie (`State:\tZ`), whose `cmdline` satisfies `match`
  - `argv0(cmdline: string): string`: the first field after splitting on `\0`
  - `isForeverArgv0(argv0: string): boolean`: `/[\\/]_forever_[\\/]wow\.exe$/i`
  - `mapsPaths(maps: string): string[]`: pathnames, using `/^\S+\s+\S+\s+\S+\s+\S+\s+\d+\s+(.+)$/` per line (paths contain spaces), with a trailing ` (deleted)` stripped
  - `wowImageFromMaps(maps: string): string | null`: the first path matching `/[\\/]_forever_[\\/]wow\.exe$/i`
  - `foreverFolderFromMaps(maps: string): string | null`: the `…/_forever_` folder of the first path containing `/_forever_/`
  - `findForeverPid(proc?, uid?): number | null`: pids where `isForeverArgv0(argv0(cmdline))` holds (no `comm` filter). Prefer those whose maps give a `foreverFolderFromMaps`; take the lowest pid of the preferred set, else of all.
  - `programPath(pid: number, proc?): string | null`: the first existing candidate, else the best guess, else null:
    1. `wowImageFromMaps` image, if it exists on the host
    2. that image under `<proc>/<pid>/root`, if it exists
    3. `join(foreverFolderFromMaps, 'Wow.exe')`, if it exists
    4. `windowsToUnix(processPrefix ?? '~/.wine', argv0)`, if it exists
    5. `join(processCwd, 'Wow.exe')`, if it exists
    6. otherwise the first non-null of these candidates
  - `processPrefix(pid: number, proc?): string | null`: `WINEPREFIX` from `environ`
  - `processCwd(pid: number, proc?): string | null`: `readlinkSync(<proc>/<pid>/cwd)`
  - `matchesTestProgram(cmdline: string, marker: string, cwd: string): boolean`: split on `/[\0 ]+/`; false if any token starts with `--type=`; true if some token `t` gives `resolve(cwd, t) === marker`
  - Every read sits in try/catch and skips the pid on error.

- [ ] **Step 1: Write the failing tests.** String-only tests run unguarded; fake-proc tests use `test.skipIf(process.platform === 'win32')`. Fixture helper:

```ts
const UID = 1000
const FOREVER = 'D:\\Games\\World of Warcraft\\_forever_\\Wow.exe'
type Fake = { uid?: number; state?: string; argv?: string[]; maps?: string; environ?: string; cwd?: string }
function fakeProc(pids: Record<number, Fake>): string {
  const proc = mkdtempSync(join(tmpdir(), 'twinmap-proc-'))
  mkdirSync(join(proc, 'self'))
  for (const [pid, p] of Object.entries(pids)) {
    const dir = join(proc, pid)
    mkdirSync(join(dir, 'root'), { recursive: true })
    if (p.uid !== undefined) writeFileSync(join(dir, 'status'), `Name:\tx\nState:\t${p.state ?? 'S (sleeping)'}\nUid:\t${p.uid}\t${p.uid}\t${p.uid}\t${p.uid}\n`)
    if (p.argv) writeFileSync(join(dir, 'cmdline'), p.argv.join('\0') + '\0'.repeat(200))
    if (p.maps !== undefined) writeFileSync(join(dir, 'maps'), p.maps)
    if (p.environ !== undefined) writeFileSync(join(dir, 'environ'), p.environ)
    if (p.cwd !== undefined) symlinkSync(p.cwd, join(dir, 'cwd'))
  }
  return proc
}
```

  Tests:
  - **Strings:**
    - `isForeverArgv0`:
      - true for `FOREVER`
      - true for `'c:\\x\\_forever_\\wow.exe'`
      - true for `'/home/p/Games/wow/drive_c/World of Warcraft/_forever_/WOW.EXE'`
      - false for `_retail_`
      - false for a `.bak` suffix
    - `mapsPaths('140000000-140001000 r--p 00000000 08:02 99 /g/World of Warcraft/_forever_/libxell.dll\n7f00-7f10 r-xp 0 0 0 /usr/lib/x.so (deleted)\n7f10-7f20 rw-p 0 0 0\n')` gives `['/g/World of Warcraft/_forever_/libxell.dll', '/usr/lib/x.so']`.
    - `foreverFolderFromMaps` of the same maps gives `'/g/World of Warcraft/_forever_'`.
    - `wowImageFromMaps` of it gives null.
    - `matchesTestProgram`:

```ts
expect(matchesTestProgram('/e/electron scripts/strip-window.cjs\0', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(true)
expect(matchesTestProgram('electron\0/x/app/scripts/strip-window.cjs\0', '/x/app/scripts/strip-window.cjs', '/')).toBe(true)
expect(matchesTestProgram('/e/electron scripts/strip-window.cjs.bak', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(false)
expect(matchesTestProgram('/e/electron --type=renderer scripts/strip-window.cjs', '/x/app/scripts/strip-window.cjs', '/x/app')).toBe(false)
```

  - **`'the Forever process of this user is found by argv0, launcher arguments ignored'`:** `{200: {uid: UID, argv: [FOREVER, '-launcherlogin', '-uid', 'wowf'], maps: ''}}` gives `findForeverPid(proc, UID) === 200`.
  - **`'processes of other users, other clients, other programs and zombies are skipped'`:** these pids together give null:
    - 300: uid 1001, `FOREVER`
    - 301: `C:\\World of Warcraft\\_retail_\\Wow.exe`
    - 302: argv `['/usr/bin/wine64-preloader', FOREVER]`
    - 303: `FOREVER + '.bak'`
    - 304: `state: 'Z (zombie)'` with `FOREVER`
  - **`'a process with files mapped from _forever_ wins over one without'` (Review Focus 2):**
    - pid 100: argv `FOREVER`, maps `'7f00-7f10 r-xp 0 0 0 /usr/lib/libc.so.6\n'`
    - pid 300: argv `FOREVER`, maps `'140000000-140001000 r--p 00000000 08:02 99 /g/World of Warcraft/_forever_/libxell.dll\n'`
    - Together they give 300; pid 100 alone gives 100.
  - **`'programPath finds Wow.exe beside mapped _forever_ files, as under Proton'`:** create `game = join(tmp,'World of Warcraft','_forever_','Wow.exe')` and map a dll from its folder. Expect `game`.
  - **`'programPath falls back to the prefix and argv0, then the working folder'`:**
    - Case 1: `environ` = `'A=1\0WINEPREFIX=<prefix>/\0'`, a prefix with `drive_c/World of Warcraft/_forever_/Wow.exe`, argv0 `C:\\World of Warcraft\\_forever_\\Wow.exe`, no maps. Expect that file.
    - Case 2: no environ, `cwd` symlink to a folder holding `Wow.exe`. Expect `join(cwd,'Wow.exe')`.
  - **`'programPath prefers the host path over the process root, and reports a guess when nothing exists'`:**
    - A mapped `Wow.exe` that exists on the host gives that path, not the `root/` one.
    - One existing only under `<proc>/300/root/nowhere/_forever_/Wow.exe` gives the root path.
    - A mapped `/gone/_forever_/Wow.exe` gives `/gone/_forever_/Wow.exe`.
    - No maps, argv0 or cwd gives null.
  - **`'unreadable or vanished proc entries are skipped'`:** an empty folder `400`, `self`, and a pid with `status` but no `cmdline` give null, without throwing.
- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/main/wine-process.test.ts`.
- [ ] **Step 3: Implement** per the Interfaces block.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/wine-process.* && git commit -m "Find the Forever client among Wine processes"`

### Task 3: A Linux capture backend that finds the game, and Linux paths in the app

**Files:**
- Create: `app/src/main/capture-linux.ts` (the process half only)
- Modify: `app/src/main/capture.ts:24-29`
- Modify: `app/src/main/client-files.ts:101-104`
- Modify: `app/src/main/index.ts:575`, `:934-935`, `:1139`
- Modify: `app/src/shared/setup.ts`: after line 10, and line 118
- Modify: `app/src/renderer/src/Settings.svelte:106`
- Test: `app/src/main/client-files.test.ts`, `app/src/main/setup.test.ts`

**Interfaces:**
- Consumes: Task 1 `wineInstallPaths`; Task 2 `findPid`, `findForeverPid`, `programPath`, `matchesTestProgram`, `processCwd`, `argv0`.
- Produces:
  - `capture-linux.ts` exports:
    - `findGameWindow(): number | null`: in an unpackaged app with `TWINMAP_CAPTURE_TEST_PROGRAM` set, `findPid((pid, c) => matchesTestProgram(c, marker, processCwd(pid) ?? '/'))`; otherwise `findForeverPid()`
    - `programOf(pid): string | null`: `programPath(pid)`
    - `findWindowOf(re: RegExp): number | null`: `findPid` over pids whose argv0 ends in `.exe`, then `re.test(programOf(pid) ?? '')`
    - `findWindow(): null`
    - `windowState(pid): 'gone' | 'open'`: `existsSync('/proc/' + pid)`, cheap, since it runs every 15 ms
    - `readRow`, `readRect`, `readBox`: return null
    - `showsOnly`: returns false
    - `captureAllowed`, `requestCapture`: not exported yet
  - `SetupStatus.linux?: true` with the doc `/** The desktop app is on Linux. */`

- [ ] **Step 1: Write the failing tests.**
  - In `client-files.test.ts` (imports `mkdirSync`, `mkdtempSync`, `symlinkSync`, `writeFileSync`). `os.homedir()` reads `$HOME` per call under the default `forks` pool:

```ts
test.skipIf(process.platform !== 'linux')('on Linux the install paths are the Wine ones', () => {
  const client = fakeClient([], 2), home = mkdtempSync(join(tmpdir(), 'twinmap-home-')), prefix = join(home, '.wine')
  mkdirSync(join(prefix, 'dosdevices'), { recursive: true })
  symlinkSync('/', join(prefix, 'dosdevices', 'z:'))
  const win = 'Z:' + client.replaceAll('/', '\\\\') + '\\\\_forever_\\\\'
  writeFileSync(join(prefix, 'system.reg'), `WINE REGISTRY Version 2\n\n[Software\\\\Wow6432Node\\\\Blizzard Entertainment\\\\World of Warcraft] 1\n"InstallPath"="${win}"\n`)
  const saved = { HOME: process.env.HOME, WINEPREFIX: process.env.WINEPREFIX }
  process.env.HOME = home
  delete process.env.WINEPREFIX
  try {
    expect(gameFolderFrom(gameInstallPaths())).toBe(client)
  } finally {
    process.env.HOME = saved.HOME
    if (saved.WINEPREFIX === undefined) delete process.env.WINEPREFIX
    else process.env.WINEPREFIX = saved.WINEPREFIX
  }
})
```

  - In `setup.test.ts`:

```ts
test('the Linux play page behaves as on Windows when no capture state is given', () => {
  const setup: SetupStatus = { gameFolder: '/WoW', addon: '0.1.0', questie: false, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }
  for (const link of [null, CLOSED, CONNECTED, { ...CLOSED, kind: 'lost' } as LinkStatus]) {
    expect(setupPages({ ...setup, linux: true }, READY, link)[4]).toEqual(setupPages(setup, READY, link)[4])
  }
})
test('on Linux the addon page gives the folder with forward slashes, as on macOS', () => {
  const setup: SetupStatus = { linux: true, gameFolder: '/WoW', addon: null, questie: false, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }
  expect(setupPages(setup, READY, null).find((p) => p.id === 'addon')?.lines[1]).toBe(t('app.firstRun.addon.howToMac'))
})
```

- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/main/client-files.test.ts src/main/setup.test.ts && npm run check`. Expected: the client-files test and the howTo test fail. The `linux` key fails only in `npm run check`.
- [ ] **Step 3: Implement the backend switch and paths.**
  - `capture.ts`: after line 27, add `if (process.platform === 'linux') capture = await import('./capture-linux')`.
  - `client-files.ts`: add `import { wineInstallPaths } from './wine-prefixes'`, and insert `if (process.platform === 'linux') return wineInstallPaths()` before line 102.
- [ ] **Step 4: Implement the main-process changes in `index.ts`.**
  - `:575`: after the darwin spread, add `...(process.platform === 'linux' ? { linux: true as const } : {}),`.
  - `:934-935`: the condition becomes `process.platform === 'win32' || process.platform === 'linux'`, and the line-934 comment becomes `// The title bar overlay does not exist on macOS; the call throws there.`. Line 936 stays as is.
  - `:1139`: `if (process.platform === 'darwin' && !captureAllowed()) {`.
- [ ] **Step 5: Implement the shared and renderer changes.**
  - `shared/setup.ts`: the `linux` field. Line 118 becomes `setup.mac || setup.linux`.
  - `Settings.svelte:106`: wrap the onTop label in `{#if !setup.linux}…{/if}`.
- [ ] **Step 6: Run the checks.** Run `cd app && npm test && npm run check`. Expected: PASS, 0 errors.
- [ ] **Step 7: Commit.** `git add app/src/main/capture-linux.ts && git commit -am "Linux finds the game and its folder; startup never asks for capture there"`

### Task 4: First AppImage, CI job, iteration-1 check

**Files:**
- Modify: `app/package.json`: top-level `desktopName`, scripts, `build.linux`, `build.toolsets`
- Create: `app/scripts/linux-build.cjs`: exits 0 off Linux, and does nothing yet on Linux
- Create: `app/scripts/check-appimage.cjs`
- Modify: `.github/workflows/ci.yml`: new job `app-linux`

**Interfaces:**
- Produces:
  - `npm run dist:linux`, output `app/dist/Twinmap-0.0.0-x86_64.AppImage`
  - `node scripts/check-appimage.cjs <AppImage> [--helper]`: prints one line per missing item and exits 1, else prints `ok`. Task 17 extends `--helper`.

- [ ] **Step 1: Add the config.**
  - Top level of `package.json`: `"desktopName": "app.twinmap.desktop"`. Electron reads it only on Linux; it gives the Wayland app id and `StartupWMClass` `app.twinmap`.
  - `"predev": "node scripts/mac-build.cjs && node scripts/linux-build.cjs"`
  - `"predist:linux": "node scripts/linux-build.cjs"`
  - `"dist:linux": "electron-vite build && electron-builder --linux AppImage --x64 --publish never"`
  - `build.linux`: `{ "target": "AppImage", "category": "Game", "artifactName": "Twinmap-${version}-x86_64.${ext}", "syncDesktopName": true }`
  - `build.toolsets`: `{ "appimage": "1.0.3" }`
- [ ] **Step 2: Write `check-appimage.cjs`.**
  1. `execFileSync(path.resolve(argv[2]), ['--appimage-extract'], { cwd: <mkdtemp>, stdio: 'ignore' })`.
  2. Assert these exist: `squashfs-root/resources/nav/`, `squashfs-root/resources/LICENSE.txt`, `squashfs-root/resources/app-update.yml`.
  3. Assert `squashfs-root/AppRun` contains both `unshare -Ur true` and `--no-sandbox`.
  4. Assert `squashfs-root/app.twinmap.desktop` contains `StartupWMClass=app.twinmap`.
  5. `rmSync` the temp folder in `finally`.
  6. With `--helper`, assert `squashfs-root/resources/twinmap-capture`:
     - bytes 0–3 are `7f454c46`, byte 4 is `2`, and the u16le at offset 18 is `0x3e`
     - `mode & 0o111` is non-zero
- [ ] **Step 3: Build and check locally.** Run `cd app && npm run dist:linux && node scripts/check-appimage.cjs dist/Twinmap-0.0.0-x86_64.AppImage`. Expected: `ok`.
- [ ] **Step 4: Check the icon.** Look at `squashfs-root/.DirIcon` (extract by hand once). If it is Electron's default icon, add `app/build/icons/512x512.png`, made from the existing logo (`docs/images/logo-*.svg` or `site/assets`), and rebuild.
- [ ] **Step 5: Add the CI job.** `app-linux` on `ubuntu-22.04`, `needs: changes`, `if: needs.changes.outputs.app == 'true'`, `defaults.run.working-directory: app`. Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with node 24, `cache: npm`, `cache-dependency-path: app/package-lock.json`
  3. `sudo apt-get update && sudo apt-get install -y libpipewire-0.3-dev libglib2.0-dev`
  4. `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run dist:linux`
  5. `node scripts/check-appimage.cjs dist/Twinmap-0.0.0-x86_64.AppImage`
  6. `actions/upload-artifact@v4` with `{ name: Twinmap-linux, path: app/dist/*.AppImage, retention-days: 7 }`
- [ ] **Step 6: Commit.** `git add app/package.json app/scripts/linux-build.cjs app/scripts/check-appimage.cjs .github/workflows/ci.yml && git commit -m "Build a Linux AppImage, in CI too"` (add the icon if Step 4 created one).
- [ ] **Step 7: Iteration-1 manual check** on the contributor's machine:
  1. **With WoW running,** run `cd app && npm run dev`. Expected:
     - The setup game page shows `/mnt/stuff/Games/World of Warcraft`.
     - The status word is "Connecting", then "Link lost" after 25 s.
     - The play page says `app.firstRun.play.silent` ("…nothing comes from the addon yet").
     - No picker appears.
  2. **With WoW closed,** restart Twinmap. Expected: "Game not running", and the folder is still found (from the registry and the `D:` link).
  3. **The AppImage:** run `./dist/Twinmap-0.0.0-x86_64.AppImage`. Expected: it starts with only `fuse3`. `ls -d ~/.config/[Tt]winmap` shows the config folder.
  4. **The window class:** run `hyprctl clients -j | jq -r '.[]|select(.title=="Twinmap").class'`. Expected: `app.twinmap`.

---

## Iteration 2: Helper captures, standalone

### Task 5: Frame layout and helper messages (TypeScript side of the protocol)

**Files:**
- Create: `app/src/main/capture-linux-frame.ts`
- Test: `app/src/main/capture-linux-frame.test.ts`

**Interfaces:**
- Produces:
  - `HEADER_BYTES = 24`, `TOP_ROWS = 129`
  - `type FrameLayout = { width: number; height: number; topRows: number; top: number; bottom: number; left: number; right: number; snapshot: number; length: number }`
  - `frameLayout(width: number, height: number, topRows: number): FrameLayout | null`. Null unless:
    - width and height are integers from 1 to 16384
    - `topRows === Math.min(height, TOP_ROWS)`
    - the length is a safe integer
  - `type HelperMessage = { layout: { width: number; height: number; topRows: number } } | { token: string | null } | { state: 'cancelled' | 'refused' | 'closed' | 'unsupported'; why?: string }`
  - `parseHelperLine(line: string): HelperMessage | null`:
    - a layout must pass `frameLayout`
    - a token must be null or match `/^[\x21-\x7e]{1,512}$/`
    - `why` must be a string if present
  - `inFrame(layout: { width: number; height: number }, x: number, y: number, width: number, height: number): boolean`: integers only, wholly inside, width and height ≥ 1
  - `readHeader(b: Buffer): { frames: number; session: number; lastFrameMs: number; width: number; height: number }`

**Layout (byte-exact on both sides, little-endian):**
1. **Header, 24 bytes:**
   - 0–3: frame counter (u32)
   - 4–7: session (u32)
   - 8–15: last frame time in ms (u64, `CLOCK_MONOTONIC`)
   - 16–19: width (u32)
   - 20–23: height (u32)
2. **`top`:** `topRows × width × 4`, BGRA
3. **`bottom`:** `width × 4`
4. **`left`:** `height × 4`, column 0 from top to bottom
5. **`right`:** `height × 4`
6. **`snapshot`:** `height × width × 4`

A reader holding `LOCK_SH` returns nothing unless the header's width and height equal its current layout.

- [ ] **Step 1: Write the failing tests.**

```ts
test('the layout puts header, top band, bottom row, both columns and the snapshot in that order', () => {
  expect(frameLayout(4, 3, 3)).toEqual({ width: 4, height: 3, topRows: 3, top: 24, bottom: 72, left: 88, right: 100, snapshot: 112, length: 160 })
  expect(frameLayout(1920, 1080, 129)).toEqual({ width: 1920, height: 1080, topRows: 129, top: 24, bottom: 990744, left: 998424, right: 1002744, snapshot: 1007064, length: 9301464 })
  expect(frameLayout(100, 50, 50)).not.toBeNull()
})
test('a layout whose band does not match the height, or with bad numbers, is refused', () => {
  for (const [w, h, t] of [[1920, 1080, 128], [100, 50, 129], [0, 10, 10], [1.5, 10, 10], [16385, 10, 10]]) expect(frameLayout(w!, h!, t!)).toBeNull()
})
test('helper lines parse into messages and anything else is ignored', () => {
  expect(parseHelperLine('{"layout":{"width":1920,"height":1080,"topRows":129}}')).toEqual({ layout: { width: 1920, height: 1080, topRows: 129 } })
  expect(parseHelperLine('{"token":null}')).toEqual({ token: null })
  expect(parseHelperLine('{"token":"4f0c2a8e-6a51-4c43-9b7e-1d2f3a4b5c6d"}')).toEqual({ token: '4f0c2a8e-6a51-4c43-9b7e-1d2f3a4b5c6d' })
  expect(parseHelperLine('{"state":"unsupported","why":"no ScreenCast portal"}')).toEqual({ state: 'unsupported', why: 'no ScreenCast portal' })
  for (const bad of ['{"layout":{"width":1920,"height":1080,"topRows":128}}', '{"token":""}', '{"state":"exploded"}', 'not json']) expect(parseHelperLine(bad)).toBeNull()
})
test('a rectangle is in the frame only when wholly inside it', () => {
  const l = { width: 4, height: 3 }
  expect(inFrame(l, 0, 0, 4, 3)).toBe(true)
  expect(inFrame(l, 1, 1, 3, 2)).toBe(true)
  for (const r of [[1, 0, 4, 1], [0, 3, 1, 1], [-1, 0, 1, 1], [0, 0, 0, 1], [0.5, 0, 1, 1]]) expect(inFrame(l, r[0]!, r[1]!, r[2]!, r[3]!)).toBe(false)
})
test('the header reads little-endian counters, session, time and size', () => {
  const b = Buffer.alloc(24); b.writeUInt32LE(7, 0); b.writeUInt32LE(2, 4); b.writeBigUInt64LE(123456789n, 8); b.writeUInt32LE(1920, 16); b.writeUInt32LE(1080, 20)
  expect(readHeader(b)).toEqual({ frames: 7, session: 2, lastFrameMs: 123456789, width: 1920, height: 1080 })
})
```

- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/main/capture-linux-frame.test.ts`.
- [ ] **Step 3: Implement** the exports.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/capture-linux-frame.* && git commit -m "Shared frame layout and messages of the Linux capture helper"`

### Task 6: Pixel conversion in C, with its own test

**Files:**
- Create: `app/native/convert.h`, `app/native/convert.c`, `app/native/convert-test.c`
- Modify: `app/scripts/linux-build.cjs`: `test` mode
- Create: `app/scripts/linux-build.test.ts`

**Interfaces:**
- Produces:
  - `enum tm_format { TM_BGRX, TM_BGRA, TM_RGBX, TM_RGBA, TM_XRGB, TM_XBGR, TM_ARGB, TM_ABGR, TM_BGR, TM_RGB, TM_XRGB_210LE, TM_XBGR_210LE, TM_RGBX_102LE, TM_BGRX_102LE };`
  - `int tm_bytes_per_pixel(enum tm_format f);`
  - `void tm_convert(enum tm_format f, const uint8_t *src, uint8_t *dst_bgra, int pixels);`: B, G, R, then 255 always
  - `void tm_column(enum tm_format f, const uint8_t *src, int stride, int x, int height, uint8_t *dst_bgra);`
  - `node scripts/linux-build.cjs test`:
    1. compiles `convert.c` + `convert-test.c` with `cc -std=c11 -D_GNU_SOURCE -Wall -Wextra -Werror` into a `mkdtemp` folder
    2. runs the binary and forwards its exit status
    3. removes the folder in `finally`

**Byte layouts (memory order):**

| Format | Layout | Bytes per pixel |
|---|---|---|
| BGRx, BGRA | `B G R x/A` | 4 |
| RGBx, RGBA | `R G B x/A` | 4 |
| xRGB, ARGB | `x/A R G B` | 4 |
| xBGR, ABGR | `x/A B G R` | 4 |
| BGR | `B G R` | 3 |
| RGB | `R G B` | 3 |

The 10-bit formats are one little-endian u32, `w = p[0] | p[1]<<8 | p[2]<<16 | (uint32_t)p[3]<<24`. Each channel is `(w >> shift) & 0x3ff`, then `>> 2`:

| Format | Word |
|---|---|
| xRGB_210LE | `x<<30 \| R<<20 \| G<<10 \| B` |
| xBGR_210LE | `x<<30 \| B<<20 \| G<<10 \| R` |
| RGBx_102LE | `R<<22 \| G<<12 \| B<<2 \| x` |
| BGRx_102LE | `B<<22 \| G<<12 \| R<<2 \| x` |

- [ ] **Step 1: Write `convert-test.c`.**
  - For every format, encode the eight colours `v = 0..7` (R = v&4, G = v&2, B = v&1, full scale) and assert the output `[B,G,R,255]` with 255/0 levels.
  - Encode 10-bit words byte by byte.
  - Fill x/A with `0x00` and `0x7f` (10-bit: x = 3 and 0), and assert alpha is 255 anyway.
  - Add a mid-level case: 10-bit 512 gives 128.
  - Use a width of 3 for 3-byte formats.
  - `tm_column`: on a 3×4 BGRx image with stride 16 (x = 0 and x = 2), and on BGR with stride 12.
  - Print `ok` and return 0.
- [ ] **Step 2: Write `linux-build.test.ts`.** `test.skipIf(process.platform !== 'linux')('the pixel conversion of the helper passes its test', …)` runs `execFileSync('node', ['scripts/linux-build.cjs', 'test'])` and expects stdout to contain `ok`.
- [ ] **Step 3: Run it and see it fail.** Run `cd app && npx vitest run scripts/linux-build.test.ts`.
- [ ] **Step 4: Implement `convert.c`,** starting with `#define _GNU_SOURCE`.
- [ ] **Step 5: Run it again.** Expected: PASS.
- [ ] **Step 6: Commit.** `git add app/native/convert.* app/native/convert-test.c app/scripts/linux-build.* && git commit -m "Pixel formats of PipeWire streams to BGRA, tested"`

### Task 7: The capture helper

**Files:**
- Create: `app/native/capture-linux.c`
- Modify: `app/scripts/linux-build.cjs`: the default mode builds the helper

**Interfaces:**
- Consumes: Task 5 layout and messages (byte-exact); Task 6 functions.
- Produces: `app/dist-native/twinmap-capture`.
  - Invocation: `twinmap-capture <frameFd> <session>`. fd 3 is the lock file; `<frameFd>` is 3 (fallback) or 4 (memfd).
  - The first stdin line is exactly `{}` or `{"token":"T"}`, with T matching `[\x21-\x7e]{1,512}`. Anything else goes to stderr and exits 2.
  - Stdin EOF ends the helper: close pending `Request`s and the `Session`, then exit 0 without a state line.
  - Stdout lines are exactly the Task 5 `HelperMessage` shapes.

**Function outline** (signatures only; the implementer writes the bodies):

```c
#define _GNU_SOURCE
enum { HEADER_BYTES = 24, TOP_ROWS = 129, SNAPSHOT_MS = 200, MAX_SIDE = 16384 };
struct layout { int width, height, top_rows; size_t top, bottom, left, right, snapshot, length; };
static bool layout_for(int width, int height, struct layout *out);
static void json_put_string(FILE *out, const char *s);
static void say_layout(const struct layout *l);
static void say_token(const char *token_or_null);
static void say_state(struct app *a, const char *state, const char *why);
static uint64_t now_ms(void);
static bool parse_first_line(const char *line, char **token_out);
static gboolean on_stdin(GIOChannel *ch, GIOCondition cond, gpointer data);
static char *request_path(GDBusConnection *c, const char *token);
static char *session_path(GDBusConnection *c, const char *token);
static guint watch_response(struct app *a, const char *path, GDBusSignalCallback cb);
static void portal_register(struct app *a);
static bool portal_uint_property(struct app *a, const char *name, guint32 *out);
static void portal_create_session(struct app *a);
static void portal_select_sources(struct app *a);
static void portal_start(struct app *a);
static int portal_open_remote(struct app *a);
static bool response_ok(struct app *a, GVariant *params, GVariant **results);
static void portal_close(struct app *a);
static bool pw_start(struct app *a, int fd, guint32 node_id, guint64 serial, bool has_serial);
static const struct spa_pod *enum_format(struct spa_pod_builder *b);
static void on_param_changed(void *data, uint32_t id, const struct spa_pod *param);
static void on_state_changed(void *data, enum pw_stream_state old, enum pw_stream_state state, const char *error);
static void on_process(void *data);
static void pw_stop(struct app *a);
static bool tm_format_of(uint32_t spa_format, enum tm_format *out);
static bool frame_relayout(struct app *a, int width, int height);
static void frame_write(struct app *a, const uint8_t *src, int stride, int x0, int y0);
int main(int argc, char **argv);
```

**D-Bus calls.** All go to destination `org.freedesktop.portal.Desktop`, object `/org/freedesktop/portal/desktop`. Subscribe to `Response` before each call. Tokens are `twinmap_<pid>_<n>`.

| Step | Call | Parameters | Notes |
|---|---|---|---|
| 1 | `org.freedesktop.host.portal.Registry.Register` | `(sa{sv})` `"app.twinmap", {}` | Call first. On any error, log to stderr and continue: it fails without an installed `app.twinmap.desktop`, and tokens still work. |
| 2 | `Properties.Get` | `("org.freedesktop.portal.ScreenCast", "version" / "AvailableCursorModes" / "AvailableSourceTypes")` | `(v)` holding `u`. Unsupported if the interface is missing, `version < 4`, or `AvailableSourceTypes & 2 == 0`. |
| 3 | `CreateSession` | `(a{sv})` `handle_token`, `session_handle_token` | Read `session_handle` from the results with `g_variant_lookup_value(results, "session_handle", NULL)`, then `g_variant_get_string`: it is `s` or `o`. |
| 4 | `SelectSources` | `(oa{sv})` `handle_token`, `types` u = 2, `multiple` b = false, `persist_mode` u = 2, `cursor_mode` u, `restore_token` s if given | `cursor_mode`: 1 if `mask & 1`, else 4 if `mask & 4`, else omitted; never 2 |
| 5 | `Start` | `(osa{sv})` session, `""`, `{handle_token}` | The results hold `streams` `a(ua{sv})` (take `[0]`: node id, props `pipewire-serial` t) and an optional `restore_token`. Print `{"token":…}` or `{"token":null}`. |
| 6 | `OpenPipeWireRemote` | `g_dbus_connection_call_with_unix_fd_list_sync(…, "(oa{sv})", G_VARIANT_TYPE("(h)"), …, &out_list, …)` | fd = `g_unix_fd_list_get(out_list, i, &err)` |
| — | `Session.Closed` signal | `(a{sv})` | prints `closed`, then exits |

- **Request path:** `/org/freedesktop/portal/desktop/request/<unique name without ':' and '.'→'_'>/<token>`. If the returned handle differs from the predicted path, resubscribe on the returned path.
- **Response codes:** 1 prints `{"state":"cancelled"}`; any other non-zero code prints `{"state":"refused"}`, then exits 0.

**PipeWire:**
- Use a `pw_thread_loop` with `pw_context_connect_fd`.
- **Target:** with a serial, set `"target.object" = "%" G_GUINT64_FORMAT` and connect with `PW_ID_ANY`; else connect with the node id as `target_id`.
- **Flags:** `AUTOCONNECT | MAP_BUFFERS`, never `RT_PROCESS`, so `process` and `param_changed` share one thread.
- **EnumFormat:**

```c
spa_pod_builder_add_object(b, SPA_TYPE_OBJECT_Format, SPA_PARAM_EnumFormat,
  SPA_FORMAT_mediaType, SPA_POD_Id(SPA_MEDIA_TYPE_video),
  SPA_FORMAT_mediaSubtype, SPA_POD_Id(SPA_MEDIA_SUBTYPE_raw),
  SPA_FORMAT_VIDEO_format, SPA_POD_CHOICE_ENUM_Id(15, SPA_VIDEO_FORMAT_BGRx, SPA_VIDEO_FORMAT_BGRx, SPA_VIDEO_FORMAT_BGRA, SPA_VIDEO_FORMAT_RGBx, SPA_VIDEO_FORMAT_RGBA, SPA_VIDEO_FORMAT_xRGB, SPA_VIDEO_FORMAT_xBGR, SPA_VIDEO_FORMAT_ARGB, SPA_VIDEO_FORMAT_ABGR, SPA_VIDEO_FORMAT_BGR, SPA_VIDEO_FORMAT_RGB, SPA_VIDEO_FORMAT_xRGB_210LE, SPA_VIDEO_FORMAT_xBGR_210LE, SPA_VIDEO_FORMAT_RGBx_102LE, SPA_VIDEO_FORMAT_BGRx_102LE),
  SPA_FORMAT_VIDEO_size, SPA_POD_CHOICE_RANGE_Rectangle(&SPA_RECTANGLE(1920,1080), &SPA_RECTANGLE(1,1), &SPA_RECTANGLE(16384,16384)),
  SPA_FORMAT_VIDEO_framerate, SPA_POD_Fraction(&SPA_FRACTION(0,1)),
  SPA_FORMAT_VIDEO_maxFramerate, SPA_POD_CHOICE_RANGE_Fraction(&SPA_FRACTION(360,1), &SPA_FRACTION(0,1), &SPA_FRACTION(360,1)));
```

  No `SPA_FORMAT_VIDEO_modifier`: that is what makes the producer use shared memory.
- **`on_param_changed`** (for `SPA_PARAM_Format`):
  1. `spa_format_video_raw_parse`, then `tm_format_of`.
  2. `pw_stream_update_params` with three pods:
     - `SPA_PARAM_Buffers`, `SPA_PARAM_BUFFERS_dataType = SPA_POD_CHOICE_FLAGS_Int((1<<SPA_DATA_MemFd)|(1<<SPA_DATA_MemPtr))`
     - `SPA_PARAM_Meta` for `SPA_META_Header` (size `sizeof(struct spa_meta_header)`)
     - `SPA_PARAM_Meta` for `SPA_META_VideoCrop` (size `sizeof(struct spa_meta_region)`)
- **`on_state_changed`:**
  - `ERROR` before the first frame prints `unsupported` with why = the error string.
  - `ERROR` or `UNCONNECTED` after streaming prints `closed`.
- **First buffer:** if `datas[0].type == SPA_DATA_DmaBuf` or `data == NULL`, print unsupported `"only DMA-BUF buffers"`.
- **Per buffer:** drain the queue and keep the newest buffer. Skip it if:
  - `chunk->size == 0`
  - `chunk->flags & SPA_CHUNK_FLAG_CORRUPTED`
  - the header is flagged `SPA_META_HEADER_FLAG_CORRUPTED`
  - `offset + stride*(y0+h) > maxsize`
- **Source pixels:** source = `(uint8_t*)d->data + d->chunk->offset`; stride = `chunk->stride ?: bpp*format_width`. The size is the VideoCrop region when `spa_meta_region_is_valid`, else the format size, capped at 16384.

**Frame writer (protocol):**
- A size change sets `relayout_pending`.
- **Relayout**, only under `flock(3, LOCK_EX|LOCK_NB)`, retried on the next buffer if the lock is busy:
  1. `ftruncate(fd, max(current_size, new_length))`: grow only, never shrink
  2. `munmap`, then `mmap(new_length)`
  3. write the frame, including the snapshot
  4. unlock, then print `{"layout":…}`
- **Normal frame**, under `LOCK_EX|LOCK_NB` (skip the frame if busy):
  1. Write the top band, bottom row, left and right columns.
  2. Write the snapshot when ≥ `SNAPSHOT_MS` have passed.
  3. Write the header: counter + 1, session from argv, `now_ms()` (`CLOCK_MONOTONIC`), width, height.
  4. Unlock.
- `_Static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "le")`. Header fields are written with `memcpy`.

**Process hygiene:**
- `setvbuf(stdout, NULL, _IOLBF, 0)` and `signal(SIGPIPE, SIG_IGN)`.
- Every string goes through `json_put_string`, which escapes `"`, `\` and control characters.
- An `atomic_flag` makes sure exactly one terminal state is printed, from either thread.
- **Threads:** the main thread owns GDBus and the `GMainLoop`. From the PipeWire thread, use only `g_idle_add` and `g_main_loop_quit`.
- **Shutdown order:** `pw_thread_loop_stop`, `pw_stream_destroy`, `pw_core_disconnect`, `pw_context_destroy`, `pw_thread_loop_destroy`, then `Session.Close`.

- [ ] **Step 1: Write the `linux-build.cjs` default mode.**
  1. Exit 0 off Linux.
  2. Run `execFileSync('pkg-config', ['--cflags', '--libs', 'libpipewire-0.3', 'gio-2.0', 'gio-unix-2.0'])` and split the output on whitespace, with no shell.
  3. On failure, print `Install the PipeWire and GLib development files (pipewire, glib2 on Arch; libpipewire-0.3-dev, libglib2.0-dev on Debian/Ubuntu)` and exit 1.
  4. Run `cc -std=c11 -D_GNU_SOURCE -O2 -Wall -Wextra -Werror native/capture-linux.c native/convert.c <flags> -o dist-native/twinmap-capture`, creating `dist-native` first.
- [ ] **Step 2: Implement the portal part**, per the D-Bus table.
- [ ] **Step 3: Implement the PipeWire part.**
- [ ] **Step 4: Implement the frame writer.**
- [ ] **Step 5: Build.** Run `cd app && node scripts/linux-build.cjs`. Expected: `dist-native/twinmap-capture` exists, with no warnings.
- [ ] **Step 6: Check the stdin rule.** Run `echo 'garbage' | ./dist-native/twinmap-capture 3 1 3>/tmp/twinmap-lock; echo $?`. Expected: exit 2, with a message on stderr.
- [ ] **Step 7: Commit.** `git add app/native/capture-linux.c app/scripts/linux-build.cjs && git commit -m "Linux capture helper: one window through the ScreenCast portal and PipeWire"`

### Task 8: Reading the helper's frames, and `probe:linux`

**Files:**
- Modify: `app/src/main/capture-linux.ts`
- Create: `app/scripts/capture-linux.cjs`
- Modify: `app/package.json`: `"probe:linux": "node scripts/linux-build.cjs && electron scripts/capture-linux.cjs"`

**Interfaces:**
- Consumes: Task 5 (`frameLayout`, `parseHelperLine`, `inFrame`, `readHeader`, `HEADER_BYTES`); Task 7 (the binary and its protocol).
- Produces, in `capture-linux.ts`:
  - `requestCapture(): boolean`: in this task, spawns the helper with `{}` if none runs, and returns whether it did
  - `stopCapture(): void`: ends stdin and sends SIGTERM if the helper hasn't closed after 2 s
  - `readRow(pid, edge)`, `readRect(pid, x, y, w, h, own?)`, `readBox(pid, x, y, size)`, `showsOnly(pid, x, y, size)` (in this task, `inFrame`; Task 11 adds trust)
  - `frameInfo(): { session: number; frames: number; lastFrameMs: number; width: number; height: number } | null`
  - `currentSession(): number | null`: the live child's session, or null

- [ ] **Step 1: Implement the spawn and the mapping.**
  - **koffi on `koffi.load('libc.so.6')`:**
    - `int memfd_create(const char *name, unsigned int flags)` with `MFD_CLOEXEC = 1`
    - `uintptr_t mmap(void *address, size_t length, int protection, int flags, int fd, int64_t offset)`
    - `int munmap(uintptr_t address, size_t length)`
    - `void * memcpy(void *destination, uintptr_t source, size_t length)`
    - `int flock(int fd, int operation)`
    - Constants: `PROT_READ = 1`, `MAP_SHARED = 1`, `LOCK_SH = 1`, `LOCK_EX = 2`, `LOCK_NB = 4`, `LOCK_UN = 8`; `MAP_FAILED` is `0xffff_ffff_ffff_ffffn`.
  - **Lock file:** opened twice (`'wx+'` for the app, `'r+'` for the helper as `writer`), then unlinked, as `capture-darwin.ts:209-216`. The memfd falls back to the lock file if `memfd_create` fails.
  - **Spawn:** `spawn(helper, [memfd === undefined ? '3' : '4', String(session)], { stdio: ['pipe','pipe','pipe', writer, memfd ?? 'ignore'], env })`, where `const { LD_LIBRARY_PATH: _l, GSETTINGS_SCHEMA_DIR: _g, ...env } = process.env`. Close `writer` in the parent afterwards.
  - Add `child.stdin.on('error', () => {})`.
  - **Messages:** parse stdout with `parseHelperLine` on **every** line (`on`, not `once`). On `layout`: check `fstatSync(frameFd).size >= layout.length`, `munmap` the old mapping, `mmap` the new length. JS is single-threaded, so the swap needs no lock.
  - Drop lines and exits from a child that is not the current one.
  - Log stderr through a `problem()` like darwin's.
  - **Do not copy** darwin's `IDLE_AFTER`, `deadline` or `retryCapture`: on Linux a restart can open the picker. An unexpected `close` just clears state; Task 9 owns restarts.
  - **Helper path:** `app.isPackaged ? join(process.resourcesPath, 'twinmap-capture') : join(app.getAppPath(), 'dist-native', 'twinmap-capture')`.
  - `session` is a module counter, incremented per spawn.
- [ ] **Step 2: Implement the reads.**
  - All reads happen under `flock(LOCK_SH|LOCK_NB)`. Return null if the lock is busy, or if the header's width and height differ from the current layout.
  - `readRow`: top uses band row 0, bottom the bottom row, left and right their columns. Each column is a `Buffer` of `height × 4` bytes.
  - `readRect` and `readBox` come from the snapshot, giving RGB as `capture-darwin.ts:309-323`, with `at` in window coordinates.
  - `frameInfo` uses `readHeader`.
- [ ] **Step 3: Write `scripts/capture-linux.cjs`**, mirroring `scripts/capture-mac.cjs`: the same `registerHooks` loader, `app.setAppPath(join(__dirname,'..'))`, a temp profile for `userData`/`sessionData`/`logs`, and the canvas with the `narrow[0]` strip on row 0, last row `#00ff00`, fill `#804020`. Differences:
  - It sets `TWINMAP_CAPTURE_TEST_PROGRAM = realpathSync(__filename)` before polling.
  - The window is `new BrowserWindow({ title: 'Twinmap probe ' + process.pid, frame: false, width: 900, height: 160, useContentSize: true })`. The page animates one pixel at (450,80) with `requestAnimationFrame`, so producers that only send changed frames keep sending.
  - It calls `requestCapture()` once and prints `Pick the window titled "<title>" in the picker`.
  - **Assertions:**
    1. Within 60 s, `decodeRow(readRow(id,'top')).kind === 'block'`, then print `decoded block`.
    2. `frameInfo()`: `session === 1`, `frames > 0`, and `Number(process.hrtime.bigint() / 1_000_000n) - lastFrameMs` within `[0, 2000]`.
    3. 120 reads, 15 ms apart: print median and p95; assert p95 < 5 ms and at least one non-null read. Assert the frame delta over the loop is ≥ 40 fps × the elapsed time.
    4. Bottom row at `(bottom.length >> 3) * 4` is `[0,255,0]`.
    5. `readRect(id,8,8,1,1,true).rgb` is `[128,64,32]`, polled up to 1 s.
    6. `left.length === right.length === 4 * frameInfo().height`. Left pixel y = 1 is `[32,64,128,255]`; the last left pixel is `[0,255,0,255]`.
    7. `showsOnly(id,8,8,1) === true`; `showsOnly(id,-1,0,1) === false`.
    8. After `stopCapture()`, the child's `close` comes within 2 s.
  - **With `--game`:** no canvas and no test marker. It asks the user to pick the WoW window and prints the decoded block kinds seen over 10 s for each of the four edges.
- [ ] **Step 4: Run the probe.** Run `cd app && npm run probe:linux` and pick the probe window. Expected: all assertions pass, exit 0.
- [ ] **Step 5: Run `npm run check` and `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit.** `git add app/src/main/capture-linux.ts app/scripts/capture-linux.cjs app/package.json && git commit -m "Read the Linux helper's frames; probe:linux"`
- [ ] **Step 7: Iteration-2 manual check.**
  1. With WoW running (strip on the top edge), run `npm run probe:linux -- --game` and pick WoW. Expected: `block` readings on the top edge within 10 s.
  2. Move the strip to each other edge in the addon's options and repeat. Expected: blocks on that edge.
  3. Resize the WoW window during a run. Expected: no crash, and blocks resume (grow-only relayout).

---

## Iteration 3: Live map

### Task 9: Capture state machine

**Files:**
- Modify: `app/src/shared/link.ts`: types only, near `LinkSnapshot`
- Create: `app/src/main/capture-linux-state.ts`
- Test: `app/src/main/capture-linux-state.test.ts`
- Modify: `app/src/main/capture-linux.ts`

**Interfaces:**
- Produces, in `shared/link.ts`:
  - `export type CaptureState = 'idle' | 'waiting' | 'picking' | 'running' | 'cancelled' | 'refused' | 'unsupported'`
  - `export type CaptureHint = 'wrong-window' | 'not-remembered'`
  - `export interface CaptureView { state: CaptureState; why?: string; hint?: CaptureHint }`
- Produces, in `capture-linux-state.ts`:
  - `type CaptureEvent = { kind: 'game'; running: boolean } | { kind: 'connect' } | { kind: 'autoRestore' } | { kind: 'helper'; message: HelperMessage } | { kind: 'exit'; expected: boolean } | { kind: 'spawnError'; why: string } | { kind: 'forget' }`
  - `type Capturing = { state: CaptureState; why?: string; helper: boolean; retryAt: number | null }`
  - `initialCapturing(): Capturing`: `{ state: 'idle', helper: false, retryAt: null }`
  - `stepCapture(c: Capturing, e: CaptureEvent, now: number, hasToken: boolean): Capturing`. An event not in the table returns `c` itself, the same reference. Any state change builds a fresh object without `why` (except into `unsupported`).
  - `RETRY_AFTER = 3000`
  - `minimizedNow(firstFrameSeen: boolean, lastFrameMs: number, nowMs: number): boolean`
- Produces, in `capture-linux.ts`:
  - `captureState(): CaptureView`
  - `forgetCapture(): void`
  - `requestCapture(): boolean`: runs one `tick()` first (a synchronous `/proc` scan feeding `game`), then `connect`; returns `state === 'picking'`

**Transitions** (`now` = `Date.now()`):

| From | Event | To | `helper` / `retryAt` |
|---|---|---|---|
| any but `idle` | `game false` | `idle` | false / null |
| `idle` | `game true` | `waiting` | false / null |
| `waiting`, `cancelled`, `refused` | `connect` | `picking` | true / null |
| `waiting`, with a token | `autoRestore` | `picking` | true / null |
| `picking` | `layout` | `running` | unchanged |
| `running` | `layout` (resize) | `c` | — |
| `picking`, `running` | `state:cancelled` / `state:refused` | `cancelled` / `refused` | false / null |
| `picking`, `running` | `state:closed` | `waiting` | false / null |
| any | `state:unsupported`, `spawnError` | `unsupported` + why | false / null |
| `running` | `exit expected:false`, with a token | `picking` | true / `now + RETRY_AFTER` |
| `running` | `exit expected:false`, no token | `waiting` | false / null |
| `picking` | `exit expected:false` | `waiting` | false / null |
| any but `idle` | `forget` | `waiting` | false / null |

Everything else returns `c`. Invariant: no `exit` result keeps `helper: true` with `retryAt: null`.

- [ ] **Step 1: Write the failing tests.** Helper: `const at = (state: CaptureState, extra = {}) => ({ ...initialCapturing(), state, ...extra })`.
  - `stepCapture(initialCapturing(), {kind:'game',running:true}, 0, false)` toEqual `{state:'waiting',helper:false,retryAt:null}`.
  - `'a closed stream waits for Connect even with a token'` (Review Focus 1): `stepCapture(at('running',{helper:true}), {kind:'helper',message:{state:'closed'}}, 5000, true)` toEqual `{state:'waiting',helper:false,retryAt:null}`.
  - `'a crashed helper retries once with a token and waits without one'`:
    - `stepCapture(at('running',{helper:true}), {kind:'exit',expected:false}, 5000, true)` toEqual `{state:'picking',helper:true,retryAt:8000}`
    - with `false` as the token argument, `.state` is `'waiting'`
    - `stepCapture(at('picking',{helper:true,retryAt:8000}), {kind:'exit',expected:false}, 9000, true).state` is `'waiting'`
  - `'auto restore needs a token and the waiting state'`: `stepCapture(at('waiting'), {kind:'autoRestore'}, 0, false)` toBe the same object; with `true`, `.state` is `'picking'`.
  - `stepCapture(at('idle'), {kind:'connect'}, 0, true)` toBe the same object.
  - `'a helper that cannot start stays unsupported with its reason until the game goes'` (Review Focus 5):
    - `spawnError` with `why: 'spawn /x/twinmap-capture ENOENT'` gives `{state:'unsupported',why:'spawn /x/twinmap-capture ENOENT',helper:false,retryAt:null}`
    - `connect` then gives the same object
    - `game false` gives `idle` without `why`
  - `'the game exiting stops the helper and starting again waits'` (Review Focus 4).
  - `forget` from running gives waiting with `helper` false; from idle, the same object.
  - `minimizedNow(false, 0, 10_000) === false`, `minimizedNow(true, 1000, 2999) === false`, `minimizedNow(true, 1000, 3000) === true`.
- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/main/capture-linux-state.test.ts`.
- [ ] **Step 3: Implement `stepCapture` and `minimizedNow`.**
- [ ] **Step 4: Wire it into `capture-linux.ts`.**
  - **Timer:** a module-level `setInterval(tick, 1000).unref()`, started at module load. `tick` feeds `game` from `findGameWindow() !== null` (keep the pid and only rescan when `/proc/<pid>` is gone), then reconciles.
  - **Reconcile after every step:**
    - `!c.helper && child` → `stopHelper()`.
    - `c.helper && !child && (c.retryAt === null || now >= c.retryAt) && !stopped` → spawn. `hasToken` comes from the token store (Task 13; false until then).
  - **Feed:** helper messages; `exit` from the child's `'close'` event (`expected` when the app ended it); and any synchronous failure before or at `spawn` (lock file, memfd, ENOENT) as `spawnError` with `error.message`.
  - **`stopCapture()` is terminal:** it runs `clearInterval`, sets `stopped = true`, then `stopHelper()`. It is called only from the window `closed` handler (`index.ts:1112`). The internal `stopHelper()` stays separate.
  - **`windowState(pid)`:**
    - `'gone'` if `/proc/<pid>` is missing
    - `'minimized'` only if the state is `running`, `frameInfo()` is non-null, and `minimizedNow(info.frames > 0, info.lastFrameMs, Number(process.hrtime.bigint() / 1_000_000n))`
    - else `'open'`
  - `captureAllowed()` is `state === 'running'`. All its callers are darwin-gated.
- [ ] **Step 5: Run `npm test`, `npm run check` and `npm run probe:linux`.** Expected: PASS. The probe still works, because `requestCapture` ticks first.
- [ ] **Step 6: Commit.** `git add app/src/main/capture-linux-state.* && git commit -am "Linux capture states; retries never open the picker"`

### Task 10: Show the state and the Connect button

**Files:**
- Modify: `app/src/main/capture.ts`: optional `captureState?(): CaptureView`, `forgetCapture?(): void`; wrappers
- Modify: `app/src/shared/link.ts`: `LinkSnapshot.capture?`, `LinkStatus.kind` adds `'connect'`, `linkStatus` after line 44
- Modify: `app/src/main/link.ts:160`
- Modify: `app/src/shared/setup.ts`: `SetupStatus.capture?`, `Page.action` (`:75`), play page (after `:144`)
- Modify: `app/src/main/index.ts:575`, a new handler near `:882`, `removeHandler` after `:1107`
- Modify: `app/src/preload/index.ts:91`, `app/src/renderer/src/twinmap.d.ts:39`, `app/src/renderer/src/web.ts:83`
- Modify: `app/src/renderer/src/FirstRun.svelte:85`, `app/src/renderer/src/App.svelte:539-540`
- Modify: all eight `app/src/shared/i18n/<lang>/app.ts`
- Test: `app/src/shared/link.test.ts`, `app/src/main/setup.test.ts`

**Interfaces:**
- Consumes: Task 9 `CaptureView`, `captureState()`, `requestCapture()`.
- Produces:
  - `capture.ts`: `export const captureState = (): CaptureView | null => capture?.captureState?.() ?? null` and `export const forgetCapture = (): void => capture?.forgetCapture?.()`
  - `LinkSnapshot.capture?: CaptureView` and `SetupStatus.capture?: CaptureView`, each with the doc "Present only on Linux."
  - `Page.action` adds `'connect' | 'choose-window'`
  - `window.twinmap.connectCapture(): Promise<void>`
  - **i18n**, with comments only in `en`:
    - `app.link`:
      - `// Linux only: in the top row until the game window is chosen. Short.` `noWindow: 'Window not chosen'`
      - `// Linux only: on the map and the play page, followed by the button map.connect or map.chooseWindow.` `connectLine: 'Twinmap needs to see the World of Warcraft window. Click Connect and choose it.'` and `chooseAgainLine: 'Twinmap could not see the game window. Choose it again.'`
      - `// Linux only: {why} is what is missing, in English as the system said it.` `unsupportedLine: 'Twinmap cannot read windows on this desktop: {why}'`
    - `app.map`: `// Linux only: buttons after link.connectLine and link.chooseAgainLine: short.` `connect: 'Connect'` and `chooseWindow: 'Choose another window'`
    - `app.firstRun`, under "Buttons on the pages: short.": `// Linux only.` `connect: 'Connect'` and `chooseWindow: 'Choose another window'`

- [ ] **Step 1: Write the failing tests** in `link.test.ts`, reusing `link`, `heard`, `NOW`.

```ts
test('on Linux a game waiting for the window asks to connect, after pause, closed and minimized', () => {
  const waiting = { ...link('open', heard(1000)), capture: { state: 'waiting' as const } }
  expect(linkStatus(waiting, NOW)).toEqual({ kind: 'connect', word: t('app.link.noWindow'), tone: 'objective', line: t('app.link.connectLine') })
  for (const game of ['closed', 'minimized'] as const) expect(linkStatus({ ...waiting, game }, NOW)).toEqual(linkStatus(link(game, heard(1000)), NOW))
  expect(linkStatus({ ...waiting, paused: true }, NOW).kind).toBe('paused')
})
```

  More tests:
  - `cancelled` and `refused` give `line: t('app.link.chooseAgainLine')`.
  - `{ state: 'unsupported', why: 'no ScreenCast portal' }` gives `{ kind: 'lost', word: 'Link lost', tone: 'objective', line: t('app.link.unsupportedLine', { why: 'no ScreenCast portal' }) }`.
  - `picking` gives `kind: 'waiting'`, `word: t('app.link.connecting')`, `tone: 'dim'`.
  - `running` and `idle` give the same result as without `capture`, for `heard(1000)`, `{}` and the protocol state.
  - `setup.test.ts`, with `setup: SetupStatus = { linux: true, gameFolder: '/home/p/Games/wow/drive_c/World of Warcraft', addon: '0.1.0', questie: false, shortestPath: false, done: false, version: '0.1.0', onTop: false, participate: false }`:
    - `capture: {state:'waiting'}` with link `{kind:'connect', word:t('app.link.noWindow'), tone:'objective', line:t('app.link.connectLine')}`: page `[4]` toMatchObject `{ state:'problem', lines:[t('app.link.connectLine')], action:'connect' }`.
    - `cancelled` and `refused` give `action: 'choose-window'`.
    - `unsupported` with its line gives `{ state: 'problem', lines: [line] }`.
    - Running with `CONNECTED` toEqual the page without `capture`.
- [ ] **Step 2: Run them and see them fail.** Run `cd app && npx vitest run src/shared/link.test.ts src/main/setup.test.ts`.
- [ ] **Step 3: Implement `linkStatus`.** Insert after line 44 (minimized), before line 45 (screenRecording):

```ts
const capturing = link.capture?.state
if (capturing === 'waiting' || capturing === 'cancelled' || capturing === 'refused')
  return { kind: 'connect', word: t('app.link.noWindow'), tone: 'objective', line: t(capturing === 'waiting' ? 'app.link.connectLine' : 'app.link.chooseAgainLine') }
if (capturing === 'unsupported') return { kind: 'lost', word: t('app.link.lost'), tone: 'objective', line: t('app.link.unsupportedLine', { why: link.capture!.why ?? '' }) }
if (capturing === 'picking') return { kind: 'waiting', word: t('app.link.connecting'), tone: 'dim' }
```

- [ ] **Step 4: Implement the play page.** After the `screenRecording` branch (`shared/setup.ts:144`):

```ts
: link?.kind === 'connect'
  ? { state: 'problem', lines: [link.line ?? link.word], action: setup.capture?.state === 'waiting' ? 'connect' : 'choose-window' }
  : setup.capture?.state === 'unsupported' && link?.line
    ? { state: 'problem', lines: [link.line] }
```

- [ ] **Step 5: Wire main.**
  - `link.ts:160` snapshot: `...((c) => (c ? { capture: c } : {}))(captureState())`.
  - `index.ts:575`: the same spread after the darwin spread.
  - Handler near `set-on-top`:

```ts
ipcMain.handle('connect-capture', () => {
  if (process.platform !== 'linux') return
  requestCapture()
  setup = lookSetup()
})
```

  - Add `ipcMain.removeHandler('connect-capture')` after `:1107`.
- [ ] **Step 6: Bridge.**
  - `preload`: `connectCapture: (): Promise<void> => ipcRenderer.invoke('connect-capture'),`
  - `twinmap.d.ts`: `connectCapture: () => Promise<void>`
  - `web.ts`: `connectCapture: () => Promise.resolve(),`
- [ ] **Step 7: Renderer.**
  - `FirstRun.svelte`, after the `retry` branch:

```svelte
{:else if page.action === 'connect' || page.action === 'choose-window'}
  <button class="btn" onclick={() => window.twinmap.connectCapture()}>{page.action === 'connect' ? t('app.firstRun.connect') : t('app.firstRun.chooseWindow')}</button>
```

  - `App.svelte`, between the paused branch and `status?.line`. Import `inApp` if it isn't imported yet. Phones get setup and link too, so gate on `inApp`:

```svelte
{:else if status?.kind === 'connect' && inApp && mapReady}
  <p class="map-note with-button" role="status" in:fly={drop(8)} out:fade={gone}>{status.line} <button class="btn" onclick={() => window.twinmap.connectCapture()}>{link?.capture?.state === 'waiting' ? t('app.map.connect') : t('app.map.chooseWindow')}</button></p>
```

- [ ] **Step 8: Add the keys to all eight languages.** Translate naturally, with no dashes and `{why}` kept.
- [ ] **Step 9: Run `npm test` and `npm run check`.** Expected: PASS, including i18n parity and the hand-written-English scans.
- [ ] **Step 10: Commit.** `git commit -am "Linux shows the capture state with a Connect button"`

### Task 11: Trust only a window that showed a strip

**Files:**
- Create: `app/src/main/capture-trust.ts`
- Test: `app/src/main/capture-trust.test.ts`
- Modify: `app/src/main/capture.ts`: optional `captureSession?(): number | null` and `trustCapture?(session: number): void`, with wrappers
- Modify: `app/src/main/capture-linux.ts`
- Modify: `app/src/main/link.ts:63`, the top of the tick (after the replay branch, `:111`), and after `:146`

**Interfaces:**
- Consumes: Task 8 `currentSession()`.
- Produces:
  - `createTrust(): { trusted(session: number | null): boolean; decoded(session: number): void }`: trust holds for exactly one session
  - `capture.ts` wrappers:
    - `export const captureSession = (): number | null => capture?.captureSession?.() ?? null`
    - `export const trustCapture = (session: number): void => capture?.trustCapture?.(session)`
  - In `capture-linux.ts`, these return false/null unless `trust.trusted(currentSession())`:
    - `showsOnly`, used by samples through `lookInside`'s `own`
    - `readRect(…, own = true)`, used by the portrait `cut()`
    - `readBox`
  - `trustCapture` also records `lastBlockMs = Date.now()`, for Task 15.

- [ ] **Step 1: Write the failing tests.**

```ts
test('nothing is trusted until a block decodes in the session', () => { const t = createTrust(); expect(t.trusted(1)).toBe(false); t.decoded(1); expect(t.trusted(1)).toBe(true) })
test('a new session is not trusted for what the old one showed', () => { const t = createTrust(); t.decoded(1); expect(t.trusted(2)).toBe(false); expect(t.trusted(null)).toBe(false) })
test('trust holds one session only', () => { const t = createTrust(); t.decoded(1); t.decoded(2); expect(t.trusted(1)).toBe(false); expect(t.trusted(2)).toBe(true) })
```

- [ ] **Step 2: Run them and see them fail.** Then implement `createTrust` and the backend gating.
- [ ] **Step 3: Wire it into `link.ts`.**
  - `:63`: `const updates = process.platform === 'win32'` and `let game = createGame(updates)`. The closures read `game` at call time.
  - At the top of the tick, after the replay branch:

```ts
const session = captureSession()
if (session !== null && session !== lastSession) {
  if (lastSession !== null) forgetGame()
  resumedAt = now
  lastSession = session
}
```

    `forgetGame()` runs `game = createGame(updates); found = null; drew = undefined; stretch = 1; edgeSeenAt = 0`. Leave `said` and `inside` alone: a fresh game has no `pos`, so `inside.look` reports null, which ends samples and boss runs. `resumedAt = now` shows "Connecting" rather than "Link lost" for a fresh session (`shared/link.ts:52`).
  - After `:146`: `if (reading.kind === 'block' && session !== null) trustCapture(session)`.
  - Windows and macOS are unchanged: `captureSession()` is null there.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/capture-trust.* && git commit -am "Linux trusts a picked window only after it showed a strip"`

### Task 12: Iteration-3 manual check

- [ ] **Step 1:** Run `cd app && npm run dev` with WoW running. Expected: the top row says "Window not chosen", and the map note shows the connect line with **Connect**.
- [ ] **Step 2:** Click **Connect** and pick WoW. Expected: "Connecting" (not "Link lost"), then Connected; the arrow moves while walking.
- [ ] **Step 3:** Enter a dungeon. Expected: the minimap position works.
- [ ] **Step 4:** Restart the app, click Connect, and pick a terminal window. Expected: never Connected, no minimap sample in the log, no old position shown.
- [ ] **Step 5:** Close WoW. Expected: "Game not running", and the last position is kept. Start WoW again. Expected: "Window not chosen".
- [ ] **Step 6:** Record the findings. Fix any defect in a new task before iteration 4.

---

## Iteration 4: Remembers and protects

### Task 13: Restore token in settings

**Files:**
- Modify: `app/src/main/setup.ts:17-64`
- Modify: `app/src/main/capture.ts`: optional `useTokenStore?(store: TokenStore): void`, type `TokenStore`, wrapper
- Modify: `app/src/main/capture-linux.ts`
- Modify: `app/src/main/index.ts:339`
- Test: `app/src/main/setup.test.ts`

**Interfaces:**
- Produces:
  - `Settings.captureToken?: string` with the doc `/** Linux only: the portal's restore token for the game window, replaced at every connect. */`
  - `isCaptureToken(s: unknown): s is string`: a string matching `/^[\x21-\x7e]{1,512}$/`
  - `type TokenStore = { get(): string | undefined; set(token: string | null): void }`
  - `useTokenStore(store: TokenStore): void`, exported from `capture.ts` as a wrapper
- **Rules:**
  - `readSettings` adds `captureToken` to the destructure (`:48`) and keeps it with `...(isCaptureToken(captureToken) ? { captureToken } : {}),`.
  - `setupStatus` builds its object explicitly, so the token never reaches `SetupStatus` or phones.
  - `hasToken` is `store?.get() !== undefined`. Spawning without a store is allowed (the probe), with `{}`.
  - `forgetCapture()` calls `store?.set(null)` **before** feeding `forget`. Otherwise "Choose another window" restores the same window.
  - Every `{"token"}` message calls `set` with that value; `null` deletes the token.

- [ ] **Step 1: Write the failing tests.**
  - `'the capture token is kept when it is a plain string and dropped otherwise'`:
    - `writeSettings(file, { captureToken: 'a1b2-c3' })` and `'4f0c2a8e-6a51-4c43-9b7e-1d2f3a4b5c6d'` are kept.
    - Raw JSON files with `''`, `'x y'`, `'é'`, `'x'.repeat(600)` and `5` each give `readSettings(file)` toEqual `{}`.
  - `'a token rotating between other settings writes survives both'`:
    1. Write `{ onTop: true }`.
    2. Set the token on the same object and write.
    3. Set `zoom: 1.25` and write.
    4. `readSettings` gives all three.
- [ ] **Step 2: Run them and see them fail.** Then implement the `readSettings` field.
- [ ] **Step 3: Wire it.** In `index.ts`, right after `const settings = readSettings(settingsFile)` (`:339`), before `startLink` and the first `lookSetup()`:

```ts
useTokenStore({
  get: () => settings.captureToken,
  set: (token) => {
    if (token && isCaptureToken(token)) settings.captureToken = token
    else delete settings.captureToken
    writeSettings(settingsFile, settings)
  },
})
```

  `capture-linux.ts` writes `{"token": get()}` (or `{}`) as the first stdin line on spawn.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Linux remembers the chosen window in the settings"`

### Task 14: Silent reconnect on Hyprland

**Files:**
- Create: `app/src/main/hyprland.ts`
- Test: `app/src/main/hyprland.test.ts`
- Modify: `app/src/main/capture-linux.ts`

**Interfaces:**
- Produces:
  - `hyprlandSocket(env: Record<string, string | undefined>): string | null`
  - `clientsShowGame(json: string, pid: number): boolean`. True when the JSON is an array with an entry where `mapped === true`, `hidden !== true`, and either `pid === pid` or (fallback for plain Wine) `class` matches `/^wow\.exe$/i`. Never match `steam_app_*`: the Battle.net launcher shares that class. Parse errors give false.
  - `askClients(socket: string, timeoutMs = 500): Promise<string | null>`: `net.connect`, write `j/clients`, collect until `end`; null on error or timeout.

- [ ] **Step 1: Write the failing tests.**

```ts
const WOW = { pid: 536112, class: 'steam_app_battlenet', title: 'World of Warcraft', mapped: true, hidden: false, xwayland: true }
const LAUNCHER = { pid: 2962409, class: 'steam_app_battlenet', title: 'Battle.net', mapped: true, hidden: false, xwayland: true }
test('the Hyprland socket comes from the runtime folder and the instance', () => {
  expect(hyprlandSocket({ XDG_RUNTIME_DIR: '/run/user/1000', HYPRLAND_INSTANCE_SIGNATURE: 'efb50993_1764_1234' })).toBe('/run/user/1000/hypr/efb50993_1764_1234/.socket.sock')
  expect(hyprlandSocket({ XDG_RUNTIME_DIR: '/run/user/1000' })).toBeNull()
})
test('the game window is recognised by its pid, never by the launcher it shares a class with', () => {
  expect(clientsShowGame(JSON.stringify([LAUNCHER, WOW]), 536112)).toBe(true)
  expect(clientsShowGame(JSON.stringify([LAUNCHER]), 536112)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ ...WOW, mapped: false }]), 536112)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ ...WOW, hidden: true }]), 536112)).toBe(false)
  expect(clientsShowGame(JSON.stringify([{ pid: 7, class: 'wow.exe', mapped: true }]), 42)).toBe(true)
  expect(clientsShowGame(JSON.stringify([{ pid: 7, class: 'kitty', mapped: true }]), 42)).toBe(false)
  expect(clientsShowGame('{}', 1)).toBe(false)
  expect(clientsShowGame('not json', 1)).toBe(false)
})
```

  `askClients` tests (`test.skipIf(process.platform === 'win32')`):
  - A server on `join(mkdtempSync(join(tmpdir(), 'twinmap-hypr-')), 's.sock')` keeps what it receives and replies `socket.end('[]')`. Expect `'[]'`, and the received text `'j/clients'`.
  - A server that never answers, with `timeoutMs = 50`, gives null.
  - A missing path gives null.
- [ ] **Step 2: Run them and see them fail.** Then implement.
- [ ] **Step 3: Wire it into `tick()`.** If `state === 'waiting' && hasToken && socket && pid !== null && !asking`:

```ts
asking = true
askClients(socket).then((json) => {
  asking = false
  if (json && clientsShowGame(json, pid)) step({ kind: 'autoRestore' })
})
```

  The step is a no-op if the state changed meanwhile.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/hyprland.* && git commit -am "On Hyprland, reconnect to the game window by itself once it exists"`

### Task 15: Choose another window, and the hints

**Files:**
- Modify: `app/src/main/capture-linux-state.ts`: `hintOf`
- Modify: `app/src/main/capture.ts`: optional `notePaused?(on: boolean): void` and wrapper
- Modify: `app/src/main/capture-linux.ts`, `app/src/main/link.ts` (`pause` at `:172`), `app/src/shared/link.ts`, `app/src/shared/setup.ts`
- Modify: `app/src/main/index.ts`: `ipcMain.handle('choose-capture-window')` and its `removeHandler`
- Modify: preload, `twinmap.d.ts`, `web.ts`
- Modify: `FirstRun.svelte`, `App.svelte`, `Settings.svelte` (inside `{#if inApp}` after line 106)
- Modify: all eight i18n `app.ts` and `settings.ts`
- Test: `capture-linux-state.test.ts`, `link.test.ts`, `setup.test.ts`

**Interfaces:**
- Produces:
  - `hintOf(h: { running: boolean; sessionStartMs: number; lastBlockMs: number | null; paused: boolean; nowMs: number; hyprland: boolean; tokenReturned: boolean | null }): CaptureHint | null`:
    - `'wrong-window'` when running, not paused, `lastBlockMs === null || lastBlockMs < sessionStartMs`, and `nowMs - sessionStartMs >= 10_000`
    - else `'not-remembered'` when running, `hyprland`, and `tokenReturned === false`
    - else null
  - `captureState()` adds `hint`. `capture-linux` computes it with:
    - `sessionStartMs = Math.max(spawnedAt, resumedMs)`, where `notePaused(false)` after `true` sets `resumedMs = Date.now()`
    - `lastBlockMs` from `trustCapture`
    - `tokenReturned` from the last `{"token"}` message
    - `hyprland = hyprlandSocket(process.env) !== null`
    - All times use `Date.now()`.
  - `link.ts` `pause(on)` calls `notePaused(on)`.
  - `window.twinmap.chooseCaptureWindow(): Promise<void>`. Main:

```ts
ipcMain.handle('choose-capture-window', () => {
  if (process.platform !== 'linux') return
  forgetCapture()
  requestCapture()
  setup = lookSetup()
})
```

  - **i18n:**
    - `app.link.wrongWindowLine`: `'No strip in this window for 10 seconds. If it is not World of Warcraft, choose another window.'`
    - `app.link.notRememberedLine`, with the comment `// Linux only, Hyprland: "Allow a restore token" is the picker's label, keep it in English.`: `'Twinmap will ask for the window again next time. Tick "Allow a restore token" in the picker, or set screencopy:allow_token_by_default.'`
    - `settings.window`: `// Linux only: the window Twinmap reads, followed on the same line by the button chooseWindow.` `gameWindow: 'Game window'`, then `// A button: short.` `chooseWindow: 'Choose another window'`
- **`linkStatus` placement.** With `const hinted = hint === 'wrong-window' ? t('app.link.wrongWindowLine') : hint === 'not-remembered' ? t('app.link.notRememberedLine') : undefined`:
  - `lost` gets `line: hinted ?? t('app.link.lostLine')`.
  - Both `waiting` returns get `...(hinted && { line: hinted })`.
  - `connected` and `combat` get `line ?? hinted`.
- **Choose another window is always reachable while the game runs** (spec). It shows:
  - in Settings whenever `setup.capture` exists and its state isn't `idle`
  - on the play page as `action: 'choose-window'` whenever the capture is running with a hint
  - on the map as a `with-button` note whenever the capture is running with a hint and a line
- **Play page:** `return [game, map, addon, extras, setup.capture?.state === 'running' && setup.capture.hint ? { ...play, action: 'choose-window' } : play]`.
- **FirstRun:** `choose-window` now calls `chooseCaptureWindow()`.
- **App.svelte:** use `link?.capture` (refreshed every 50 ms). Add the note `{:else if link?.capture?.state === 'running' && link.capture.hint && status?.line && inApp && mapReady}` with `t('app.map.chooseWindow')`.
- **Settings.svelte:**

```svelte
{#if setup.capture && setup.capture.state !== 'idle'}<div class="line"><span>{t('settings.window.gameWindow')}</span><button class="btn" onclick={() => window.twinmap.chooseCaptureWindow()}>{t('settings.window.chooseWindow')}</button></div>{/if}
```

- [ ] **Step 1: Write the failing tests.**
  - `hintOf({ running: true, sessionStartMs: 0, lastBlockMs: null, paused: false, nowMs: 9_999, hyprland: false, tokenReturned: true })` gives null; with `nowMs: 10_000` it gives `'wrong-window'`.
  - `lastBlockMs: 500` gives null.
  - `paused: true` gives null.
  - `hyprland: true, tokenReturned: false, lastBlockMs: 500, nowMs: 10_000` gives `'not-remembered'`.
  - `linkStatus({ ...link('open', {}, 600), capture: { state: 'running', hint: 'wrong-window' } }, NOW)` toMatchObject `{ kind: 'lost', line: t('app.link.wrongWindowLine') }`.
  - The play page with a running capture and a hint has `action: 'choose-window'`.
- [ ] **Step 2: Run them and see them fail.** Then implement `hintOf`, the shared mapping and the plumbing.
- [ ] **Step 3: Implement** IPC, bridge, renderer and i18n.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Linux: choose another window, and say when the window is wrong or not remembered"`

### Task 16: Iteration-4 manual check

- [ ] Connect, quit, then start again with WoW running. Expected on Hyprland: Connected without a picker or a click.
- [ ] With Battle.net open and WoW starting, expected: no picker before the WoW window appears, then a silent reconnect.
- [ ] Set `screencopy:allow_token_by_default = false` in `~/.config/hypr/xdph.conf`, restart xdph (`systemctl --user restart xdg-desktop-portal-hyprland`), connect without ticking the box. Expected: the not-remembered hint. Restore the option afterwards.
- [ ] Restart WoW. Expected: silent reconnect on Hyprland.
- [ ] Connect to a wrong window. Expected after 10 s: the wrong-window hint with the button. The button opens the picker; picking WoW connects.
- [ ] Pause for 15 s, then resume, on a wrong window. Expected: no hint until 10 s after the resume.
- [ ] Toggle WoW between fullscreen and windowed. Expected: reconnects (Review Focus 1).
- [ ] Settings shows "Game window: Choose another window" while WoW runs.

---

## Iteration 5: Release-ready AppImage

### Task 17: Package the helper

**Files:**
- Modify: `app/package.json`: `build.linux.extraResources: [{ "from": "dist-native/twinmap-capture", "to": "twinmap-capture" }]` (merged with the global `nav` and `LICENSE.txt`)
- Modify: `app/scripts/check-appimage.cjs`: `--helper` adds the library checks
- Modify: `.github/workflows/ci.yml`: `app-linux` checks with `--helper`

**Interfaces:**
- Consumes: Task 4 `check-appimage.cjs`; Task 8 helper path when packaged.
- **`--helper` additions:**
  - Run `objdump -T` on the helper, print the highest `GLIBC_x.y`, and fail above 2.35.
  - Run `ldd` with `env: { LD_LIBRARY_PATH: '<tmp>/squashfs-root/usr/lib' }`, and fail if the output contains `squashfs-root` or `not found`.

- [ ] **Step 1: Add the config and the checks.** The CI step becomes `node scripts/check-appimage.cjs dist/Twinmap-0.0.0-x86_64.AppImage --helper`.
- [ ] **Step 2: Build and check locally.** Run `cd app && npm run dist:linux && node scripts/check-appimage.cjs dist/Twinmap-0.0.0-x86_64.AppImage --helper`. Expected: `ok`. The local glibc limit fails on Arch (2.44 builds), so locally run it with `TWINMAP_GLIBC_MAX=2.99` read by the script. CI uses the default 2.35.
- [ ] **Step 3: Run the AppImage and connect to WoW.** Expected: Connected.
- [ ] **Step 4: Commit.** `git commit -am "Ship the capture helper in the AppImage; the AppRun keeps electron-builder's userns sandbox check (unshare -Ur true)"`

### Task 18: Self-update

**Files:**
- Create: `app/src/main/update-gate.ts`, test `app/src/main/update-gate.test.ts`
- Modify: `app/src/main/update.ts:27`
- Modify: `app/src/main/link.ts` (the `updates` constant from Task 11)

**Interfaces:**
- Produces:
  - `selfUpdates(platform: NodeJS.Platform, env: Record<string, string | undefined>): boolean`: `platform === 'win32' || (platform === 'linux' && !!env.APPIMAGE)`
  - `justUpdated(argv: string[], env: Record<string, string | undefined>): boolean`: `argv.includes('--updated') || env.APPIMAGE_SILENT_INSTALL === 'true'`
  - `canReplace(env: Record<string, string | undefined>): boolean`: true unless `env.APPIMAGE` is set and its folder is not writable (`accessSync(dirname, W_OK)` throws)
- `update.ts:27`: `if (!selfUpdates(process.platform, process.env) || !app.isPackaged || justUpdated(process.argv, process.env) || !canReplace(process.env)) return open()`
- `link.ts`: `const updates = selfUpdates(process.platform, process.env)`

- [ ] **Step 1: Write the failing tests.**
  - `selfUpdates`:
    - `('win32', {})` true
    - `('win32', {APPIMAGE:'/x'})` true
    - `('linux', {APPIMAGE:'/x.AppImage'})` true
    - `('linux', {APPIMAGE:''})` false
    - `('linux', {})` false
    - `('darwin', {})` false
  - `justUpdated`:
    - `(['--updated'], {})` true
    - `([], {APPIMAGE_SILENT_INSTALL:'true'})` true
    - `([], {})` false
  - `canReplace` (skip on win32): a writable temp folder is true; `{}` is true; a folder with mode `0o555` is false (skip when running as root).
- [ ] **Step 2: Run them and see them fail.** Then implement and wire it in.
- [ ] **Step 3: Check updates by hand.** Run from copies outside `dist/`, because the update deletes the file that was run:

```bash
cd app
npm run dist:linux -- -c.extraMetadata.version=0.0.1
mkdir -p ~/tm-upd && cp dist/Twinmap-0.0.1-x86_64.AppImage ~/tm-upd/ && cp dist/Twinmap-0.0.1-x86_64.AppImage ~/tm-upd/Twinmap-x86_64.AppImage
npm run dist:linux -- -c.extraMetadata.version=0.0.2
(cd dist && python3 -m http.server 8080)
TWINMAP_UPDATES=http://localhost:8080 ~/tm-upd/Twinmap-x86_64.AppImage
TWINMAP_UPDATES=http://localhost:8080 ~/tm-upd/Twinmap-0.0.1-x86_64.AppImage
```

  Expected:
  - The stable name is replaced in place.
  - The versioned file becomes `Twinmap-0.0.2-x86_64.AppImage`, and the 0.0.1 file is gone.
  - The restarted app doesn't check again.
  - A logged "Cannot download differentially" is expected, because Python's server ignores Range requests.
  - No "port taken" line from the brief overlap of old and new app.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add app/src/main/update-gate.* && git commit -am "The Linux AppImage updates itself"`

### Task 19: Release job, README, CHANGELOG

**Files:**
- Modify: `.github/workflows/release.yml`: new job `linux`
- Modify: `README.md`: a download button before `</p>` at line 19, and `## Linux` right before `## What it does` (line 74)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the job.**

```yaml
  linux:
    needs: release
    runs-on: ubuntu-22.04
    defaults: { run: { working-directory: app } }
    env: { GH_TOKEN: ${{ github.token }} }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: app/package-lock.json }
      - run: sudo apt-get update && sudo apt-get install -y libpipewire-0.3-dev libglib2.0-dev
      - run: npm ci
      - name: Build the AppImage
        run: |
          echo "VERSION=${GITHUB_REF_NAME#v}" >> "$GITHUB_ENV"
          npm run dist:linux -- -c.extraMetadata.version="${GITHUB_REF_NAME#v}"
      - name: Check it
        run: |
          test -f "dist/Twinmap-$VERSION-x86_64.AppImage"
          grep -qx "version: $VERSION" dist/latest-linux.yml
          grep -q "url: Twinmap-$VERSION-x86_64.AppImage" dist/latest-linux.yml
          node scripts/check-appimage.cjs "dist/Twinmap-$VERSION-x86_64.AppImage" --helper
      - name: Attach it to the release
        run: |
          cp "dist/Twinmap-$VERSION-x86_64.AppImage" dist/Twinmap-x86_64.AppImage
          gh release upload "$GITHUB_REF_NAME" "dist/Twinmap-$VERSION-x86_64.AppImage" dist/Twinmap-x86_64.AppImage dist/latest-linux.yml --clobber
```

- [ ] **Step 2: Add the README button**, after an `&nbsp;&nbsp;`:

```html
<a href="https://github.com/catubba/twinmap-forever/releases/latest/download/Twinmap-x86_64.AppImage"><img src="https://img.shields.io/badge/2._The_app-Download_for_Linux-1f6feb?style=for-the-badge&amp;logo=linux&amp;logoColor=white" alt="2. The app: download for Linux" height="44"></a>
```

- [ ] **Step 3: Write the README `## Linux` section**, modelled on `## macOS`:
  - requirements: x86_64, a desktop with PipeWire and xdg-desktop-portal, WoW under Wine, Proton, Lutris, Bottles or Steam
  - download, `chmod +x`, keep the name `Twinmap-x86_64.AppImage` (a versioned name is replaced by the next versioned name)
  - Connect and the picker; on Hyprland, tick "Allow a restore token" or set `screencopy:allow_token_by_default`
  - scaling: `xwayland:force_zero_scaling` or scale 1; on Hyprland, no rounding for the game window
  - "always on top" through a compositor rule
  - updates itself when started as an AppImage
  - not on Linux: HDR
  - tested: the real game on Hyprland; recorded strips on GNOME and KDE (filled in from Task 22)
- [ ] **Step 4: Add the CHANGELOG entry.** A `## Unreleased` section with `### New` and one bullet in the house style: "**Twinmap on Linux.** …". `shared/news.ts:61` and the release `awk` ignore a non-version heading.
- [ ] **Step 5: Validate the workflow.** Run `cd app && node -e "require('js-yaml').load(require('fs').readFileSync('../.github/workflows/release.yml','utf8'))"`. Expected: no error.
- [ ] **Step 6: Commit.** `git commit -am "Linux AppImage in releases; README and CHANGELOG"`
- [ ] **Step 7: Write the PR notes** (for later; do not post):
  - The README button 404s until the first release with Linux files.
  - After a failed Linux upload, use "Re-run failed jobs", never "Re-run all jobs".
  - Linux apps see a 404 for `latest-linux.yml` between the release and the upload, and open as they are.
- [ ] **Step 8: Iteration-5 manual check.**
  1. Delete `~/.config/twinmap`.
  2. Run the locally built AppImage with only `fuse3`.
  3. Go through first run with WoW. Expected: the folder is found, Connect works, and the arrow moves.

---

## Iteration 6: GNOME and KDE

### Task 20: Title bars, and the window frame on GNOME

**Files:**
- Modify: `app/src/main/capture-linux-frame.ts`: `contentTopOf`
- Modify: `app/src/main/capture-linux.ts`
- Modify: `app/src/main/index.ts:277-289`, `:935`
- Test: `app/src/main/capture-linux-frame.test.ts`

**Interfaces:**
- Consumes: `contentTop(frame: { height; scale; titleBar }, row: (y) => Buffer): { top; confirmed }` from `capture-darwin-frame.ts:31`.
- Produces:
  - `contentTopOf(rows: number, row: (y: number) => Buffer): { top: number; confirmed: boolean }`: `contentTop({ height: rows, scale: 2, titleBar: 0 }, row)`. `scale: 2` makes it scan up to row 128.
  - **Per session in `capture-linux.ts`:** `top`, `confirmed`, `nextScan`. Reset all three on every `layout` and every new session. While unconfirmed, rescan the band every 150 ms. While unconfirmed, a left or right read scans its column with `contentTopOf(Math.min(height, TOP_ROWS), (y) => column.subarray(y * 4))`. A confirmed hit from any edge sets `top`.
  - **Reads honour `top`:**
    - `readRow('top')` reads band row `top`.
    - `readRect`/`readBox` add `top` to y.
    - Columns are sliced from `top`.
    - `inFrame` uses `height - top`.

- [ ] **Step 1: Write the failing test.**

```ts
test('a title bar above the content is skipped', () => {
  const strip = Buffer.from(Array.from(fixtures.narrow[0]!, Number).flatMap((v) => [v & 1 ? 255 : 0, v & 2 ? 255 : 0, v & 4 ? 255 : 0, 255]))
  const bar = Buffer.alloc(strip.length, 0xeb), blank = Buffer.alloc(strip.length)
  expect(contentTopOf(TOP_ROWS, (y) => y < 30 ? bar : y === 30 ? strip : blank)).toEqual({ top: 30, confirmed: true })
  expect(contentTopOf(TOP_ROWS, (y) => y === 0 ? strip : blank)).toEqual({ top: 0, confirmed: true })
  expect(contentTopOf(TOP_ROWS, (y) => y === 128 ? strip : blank)).toEqual({ top: 128, confirmed: true })
  expect(contentTopOf(TOP_ROWS, () => bar)).toEqual({ top: 0, confirmed: false })
  expect(contentTopOf(40, (y) => y === 39 ? strip : blank)).toEqual({ top: 39, confirmed: true })
})
```

- [ ] **Step 2: Run it and see it fail.** Then implement `contentTopOf` and the reads.
- [ ] **Step 3: Native frame on GNOME.** In `index.ts`:

```ts
const nativeFrame = process.platform === 'linux' && /GNOME/i.test(process.env.XDG_CURRENT_DESKTOP ?? '')
```

  - In the window options: `...(nativeFrame ? {} : { titleBarStyle: 'hidden' as const, titleBarOverlay: { color: '#00000000', symbolColor: WINDOW.symbols, height: WINDOW.top } })`.
  - In `showZoom`: `if (process.platform === 'win32' || (process.platform === 'linux' && !nativeFrame))`.
  - Task 22 decides whether `nativeFrame` stays.
- [ ] **Step 4: Run `npm test` and `npm run check`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "Linux: skip a window title bar in the stream; native frame on GNOME"`

### Task 21: Strip test window

**Files:**
- Create: `app/scripts/strip-window.cjs`
- Modify: `app/package.json`: `"strip-window": "electron --ozone-platform=x11 scripts/strip-window.cjs"`. It runs under X11, as Wine does, so GNOME and KDE draw a server-side title bar.

**Interfaces:**
- Produces: `npm run strip-window -- [--edge top|bottom|left|right] [--strips <file>]`. It prints `TWINMAP_CAPTURE_TEST_PROGRAM=<realpathSync(__filename)>`, which Task 3's `matchesTestProgram` resolves against the window's cwd.
  - `--strips`: a JSON array of cell strings (one fixture key's shape). The default is `src/shared/strips.fixture.json` key `session`. Every fixture decodes within 1280×720 (it needs at most 352 cells).

- [ ] **Step 1: Implement**, copying from `capture-mac.cjs`:
  - `app.setAppPath(join(__dirname, '..'))`, and a temp profile for `userData`, `sessionData` and `logs`.
  - `Menu.setApplicationMenu(null)`.
  - `new BrowserWindow({ title: 'Twinmap strip window', width: 1280, height: 720, useContentSize: true, backgroundColor: '#804020' })`.
  - The canvas is `innerWidth*devicePixelRatio` × `innerHeight*devicePixelRatio`, with `{ alpha: false }`, redrawn on `resize`.
  - Pixels are `[v&4?255:0, v&2?255:0, v&1?255:0, 255]`. Edges:
    - top: a 1-row image at y 0
    - bottom: at `h-1`
    - left: a 1×h image at x 0
    - right: at `w-1`
  - Draw `min(cells.length, w or h)` cells, and move to the next strip every 50 ms.
- [ ] **Step 2: Run it against the app on Hyprland.**
  1. Run `npm run strip-window -- --edge top`.
  2. In another terminal, run `TWINMAP_CAPTURE_TEST_PROGRAM=<printed path> npm run dev`.
  3. Connect and pick the strip window.
  4. Expected: the status leaves "Window not chosen", and blocks decode. Repeat for each `--edge`.
- [ ] **Step 3: Commit.** `git add app/scripts/strip-window.cjs && git commit -am "A window that draws recorded strips, for desktops without the game"`

### Task 22: GNOME and KDE check

- [ ] **Step 1: VMs.** Use virt-manager or GNOME Boxes with virtio-gpu, 3D acceleration off first (this forces the shared-memory path), then on once.
  - **GNOME:** Ubuntu 26.04 LTS desktop. It also exercises the AppArmor userns limit.
  - **KDE:** Fedora KDE Plasma (Plasma 6, Wayland).
  - **Packages:**
    - Ubuntu: `sudo apt update && sudo apt install -y git curl build-essential pkg-config libpipewire-0.3-dev libglib2.0-dev`
    - Fedora: `sudo dnf install -y git gcc make pkgconf-pkg-config pipewire-devel glib2-devel`
    - Node 24 via nvm or fnm on both; distro Node is too old.
  - Clone the branch, then run `cd app && npm ci`.
- [ ] **Step 2: Preflight in each VM.**
  - `echo $XDG_SESSION_TYPE $XDG_CURRENT_DESKTOP` prints `wayland …`.
  - `systemctl --user is-active pipewire wireplumber xdg-desktop-portal` shows all three active.
  - `busctl --user get-property org.freedesktop.portal.Desktop /org/freedesktop/portal/desktop org.freedesktop.portal.ScreenCast version` is 4 or more.
  - The same call for `AvailableSourceTypes` has bit 2 set.
- [ ] **Step 3: Checklist per desktop.** Record pass or fail and the values in the PR notes draft:
  - The picker opens on Connect only. Record whether it has a remember option, and whether it must be ticked.
  - Cancel shows "Choose the window".
  - Blocks decode on all four edges of the strip window (`--edge`), with its server-side title bar. Record the `top` found.
  - KWin or Mutter side borders: if left or right fail, add a fix task (a column offset scan).
  - An app restart with a token gives `waiting` with no picker, and one Connect restores it.
  - Closing the strip window gives "Window not chosen".
  - At 125 % fractional scale decoding fails. That confirms the README requirement; it is not a bug.
  - p95 from `npm run probe:linux` (pick the probe window): record it, don't gate on it.
  - Window controls show; minimize, maximize and close work; dragging by the top row works. If GNOME's overlay controls work, remove `nativeFrame` (Task 20).
  - **AppImage (the CI artifact from Task 4, not a local build):**
    - Ubuntu: `sysctl kernel.apparmor_restrict_unprivileged_userns` is 1, the AppImage starts, and `tr '\0' ' ' < /proc/$(pgrep -o -f squashfs-root)/cmdline` contains `--no-sandbox`.
    - Fedora: it starts without `--no-sandbox`.
- [ ] **Step 4: Fix failures.** For each failure, add a fix task here, then repeat the checklist.
- [ ] **Step 5: Commit** any fixes, and fill in the README "tested" line (Task 19).
