# OrganizedJihad Userscript — Installation & Quick Start Guide

## Windows Setup Options

## One-Click GUI Setup (No CLI)

Preferred release flow for non-technical users:

1. Run `OrganizedJihad.Installer.exe` from the release bundle.
2. Select browser target (Opera GX included).
3. Click `Install Ecosystem`.
4. Wait for completion status in the installer window.

UX expectation:

- EXE path is UI-only and does not require command prompt interaction.
- CLI is only for users intentionally running install commands from terminal/PowerShell.

The GUI installer uses the same hardened install pipeline and runs first-run checks automatically.
At startup, the installer requests administrator privileges so full install steps can complete.

Additional GUI hardening behavior:

- Preflight validation blocks invalid install root/API URL inputs.
- Each run writes a timestamped installer log to `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs`.
- The installer window includes buttons to open the install folder and log folder directly.

If you are publishing this installer from source, generate the executable with:

```bash
dotnet publish installer-ui/OrganizedJihad.Installer.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o installer-ui/publish/win-x64
```

Output executable:

```text
installer-ui\publish\win-x64\OrganizedJihad.Installer.exe
```

## Fastest Windows Setup (Installer + Upgrade, CLI)

From the repository root, run:

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check
```

By default, the managed installer runs cross-platform and performs post-install health checks when requested.

Or double-click:

```text
Install-OrganizedJihad.cmd
```

This installer will:

- install bundled API/runtime-host payloads
- install userscript + setup guide assets
- open Tampermonkey extension install pages (including Opera GX bootstrap links)
- run optional health checks and diagnostics links

Use `--skip-tampermonkey-bootstrap` if you only want backend/userscript artifact updates.

Target specific browser bootstrap pages (example with Opera GX):

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --tampermonkey-browsers operaGX,chrome
```

Optional post-install health-check run from installer:

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check
```

One-command first-run diagnostics bundle:

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --first-run-diagnostics --run-install-health-check
```

This typically includes:

- `--run-install-health-check`
- optional diagnostics URL opens via installer flags

Open diagnostics entry points automatically after install:

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --open-userscript-diagnostics
```

This opens:

- Hero Wars web page (for userscript overlay diagnostics)
- API health URL (`/api/sync/health`)
- API docs URL (`/api/sync`)

## Prerequisites

- **Browser**: Chrome, Edge, Firefox, or any Chromium-based browser
- **TamperMonkey**: Browser extension for running userscripts
- **Hero Wars Account**: Web version at <https://www.hero-wars.com/> (Facebook, Google, or direct login)

### Opera GX Notes

- The installer supports `operaGX` in `--tampermonkey-browsers`.
- It opens Opera Add-ons pages and Tampermonkey install links for Chromium compatibility.
- If Opera GX is installed in the default location, the installer opens bootstrap links directly in Opera GX.

---

## Step 1: Install TamperMonkey

1. Go to your browser's extension store:
   - **Chrome**: <https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo>
   - **Firefox**: <https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/>
   - **Edge**: <https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd>
2. Click "Add to Browser" / "Install"
3. Confirm the permissions dialog
4. You should see the TamperMonkey icon in your browser toolbar (a black square with two dots)

---

## Step 2: Build the Userscript

You need Node.js 18+ and Yarn installed.

```powershell
# From the repository root
cd userscript

# Install dependencies (first time only)
yarn install

# Build the userscript bundle
yarn build
```

`yarn build` now also appends an automated daily session entry under `~docs/copilot-chats/`
using `userscript/scripts/session-log-autogen.mjs`.

This produces `userscript/dist/organized-jihad.user.js` — a single bundled JS file.

## Step 2.5: Run One-Command Install Health Check (Recommended)

From `userscript/`, run:

```powershell
yarn install:check
```

This checks key local API endpoints and prints `PASS` / `WARN` / `FAIL` status with next actions.

- `PASS` on required checks means the userscript should sync correctly.
- `WARN` means optional endpoints are unavailable; advanced views may show partial data.
- `FAIL` means required sync health endpoint is not reachable.

If your API is on a different host/port:

```powershell
node .\scripts\install-health-check.mjs --baseUrl http://localhost:5000
```

For automation / CI output:

```powershell
yarn install:check --json
```

Open troubleshooting URLs in your default browser while running checks:

```powershell
# Open only failed endpoints (default when --open has no value)
yarn install:check --open

# Open only required endpoints
yarn install:check --open required

# Open all checked endpoints
yarn install:check --open all
```

---

## Step 3: Install the Script in TamperMonkey

### Option A: File URL (Recommended for Development)

1. Click the TamperMonkey icon → **Dashboard**
2. Go to **Settings** tab → **Config mode**: set to **Beginner** or **Advanced**
3. Under **Security** → Make sure "Allow access to file URLs" is enabled (Chrome: `chrome://extensions` → TamperMonkey → "Allow access to file URLs")
4. Click the **Utilities** tab (or the `+` tab to create new script)
5. Click **Import from file** and select:
   ```
   userscript/dist/organized-jihad.user.js
   ```
6. TamperMonkey will show the script details → click **Install**

### Option B: Copy-Paste

1. Click the TamperMonkey icon → **Create a new script**
2. Delete all the template content
3. Open `userscript/dist/organized-jihad.user.js` in a text editor
4. Copy the **entire file contents** and paste into TamperMonkey editor
5. Press `Ctrl+S` to save
6. The script should now appear in your TamperMonkey dashboard as "OrganizedJihad - Hero Wars Tracker"

### Option C: Watch Mode (Best for Development)

1. Build in watch mode: `yarn dev`
2. In TamperMonkey → Dashboard → Settings → set **Config mode** to **Advanced**
3. Under **Externals** → set **Update Interval** to **Always**
4. Create a new script with this content:

```javascript
// ==UserScript==
// @name         OrganizedJihad - Hero Wars Tracker (Dev)
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Development loader
// @match        https://i-heroes-fb.nextersglobal.com/*
// @match        https://i.hero-wars-fb.com/*
// @match        https://i-heroes-vk.nextersglobal.com/*
// @match        https://i-heroes-ok.nextersglobal.com/*
// @match        https://i-heroes-mm.nextersglobal.com/*
// @match        https://i-heroes-wb.nextersglobal.com/*
// @match        https://i-heroes-mg.nextersglobal.com/*
// @require      file:///C:/Users/me/source/repos/OrganizedJihad/userscript/dist/organized-jihad.user.js
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==
```

> **Note**: Update the `@require file:///` path to match your actual repo location.

5. Save. Now every time `yarn dev` rebuilds, the script auto-reloads on next page refresh.

---

## Step 4: Open Hero Wars and Verify

1. Navigate to <https://www.hero-wars.com/> and log in
2. Once the game loads (you see the game UI), open the browser **Developer Console**:
   - `F12` → **Console** tab
3. Look for these messages:

```
[OrganizedJihad] Hero Wars Tracker v3.0 Loaded
[OrganizedJihad] IndexedDB storage initialized
[OrganizedJihad] ✅ API Monitor initialized
[OrganizedJihad] Initializing tracker...
[OrganizedJihad] GameTracker initialized - monitoring Hero Wars API
[OrganizedJihad] ✅ Tracker ready — play the game normally
```

4. You should see a **yellow status badge** ("OJ: Listening...") in the bottom-right corner.
   - When API calls start, it turns **green** and shows the call count
   - Click the badge to open the full **overlay panel**
   - Press `Ctrl+Shift+H` to toggle it
5. Open **Settings** in the overlay and click **Run Health Check** under **First-Run Health Check**.
   - This validates API reachability, account detection, and whether initial snapshot/hero data has been captured.
   - Use quick actions there to **Open API Log**, **Open API Health URL**, and **Open API Docs URL** for fast troubleshooting.

---

## What You Should See

### Console Output
Every time the game makes an API call (which it does constantly — loading heroes, checking arena, etc.), you'll see log entries like:

```
[OrganizedJihad] Player snapshot saved: PlayerName Level 130
[OrganizedJihad] Tracked 45 heroes for player 12345
[OrganizedJihad] Arena battle tracked: Won vs OpponentName (Rank 342 → 338)
[OrganizedJihad] Chest opened: legendary - 5 drops
```

### Overlay Panel
A blue semi-transparent panel in the top-right with tabs:
- **Dashboard**: Shows tracked hero count, active goals, upcoming events
- **Heroes**: (will show hero table once data browser is implemented)
- **Settings**: Configuration options

### IndexedDB Data
To verify data is being stored:

1. Open DevTools → **Application** tab (Chrome) or **Storage** tab (Firefox)
2. Expand **IndexedDB** → **OrganizedJihad**
3. You should see 25+ object stores (snapshots, battles, heroes, titans, etc.)
4. Click on **snapshots** — you should see player snapshot records
5. Click on **heroes** — you should see hero roster snapshots

---

## Troubleshooting

### "Script doesn't seem to run"

- **Check @match**: The game loads inside an iframe. Make sure your TamperMonkey script's @match includes the iframe domains (the `i-heroes-*.nextersglobal.com` patterns).
- **Check DevTools frame selection**: In Chrome DevTools, there's a dropdown at the top of the Console that says "top". Change it to the game iframe (something like `i-heroes-fb.nextersglobal.com`) to see console output from the script.
- **Check TamperMonkey status**: Click the TamperMonkey icon — it should show "1 script running" on the game page. If it says 0, the @match pattern doesn't match.

### "No API calls being intercepted"

- The game might use a different API URL pattern. Check the Network tab in DevTools for requests to `*.nextersglobal.com/api/`.
- Make sure the script is running in the correct frame (iframe, not top-level).

### "Overlay doesn't appear"

- Press `Ctrl+Shift+H` to toggle visibility
- Check the console for any JavaScript errors
- The overlay might be behind the game's own UI — try scrolling or check `z-index`

### "IndexedDB errors"

- Clear the database: DevTools → Application → IndexedDB → right-click "OrganizedJihad" → Delete database
- Reload the page — the script will recreate all stores

---

## Development Workflow

```powershell
# Terminal 1: Watch mode (auto-rebuilds on file changes)
cd userscript
yarn dev

# Terminal 2: Run tests
yarn test

# Terminal 3: Lint
yarn lint
```

After making changes:
1. `yarn dev` auto-rebuilds the bundle
2. Refresh the game page in your browser
3. TamperMonkey loads the updated script
4. Check console for your changes

---

## Next Steps

Once you've confirmed the script is running and you can see console output:

1. **Browse your data**: Open DevTools → Application → IndexedDB → OrganizedJihad
2. **Play the game normally**: Every action (battles, upgrades, quests) is being recorded
3. **Check the overlay**: `Ctrl+Shift+H` to toggle the panel
4. **Watch for issues**: Check the GitHub issues (#23-#28) for planned improvements
