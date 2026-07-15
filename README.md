# MEAN Stack Training Plan — live tracker

A single-page training tracker hosted free on **GitHub Pages**, with each trainee's
progress stored free in a **Google Sheet** (via Google Apps Script).

- Clean grid: **6-Week Plan**, **Project Build**, **Final Project (5-day)**, **Resources**
- Click a **Status** chip to cycle `Not started → In progress → Done`
- Progress saves automatically per trainee
- Open a person's board with a link: `…/index.html?name=Ram Jangid`

Works immediately in **local mode** (progress saved in the browser). Add the Google
Sheet backend (below) to make progress central and survive across devices.

---

## Files
| File | What it is |
|------|-----------|
| `index.html` | The whole app. The only file GitHub Pages needs. |
| `Code.gs` | Google Apps Script backend (paste into a Sheet). |
| `README.md` | This guide. |

---

## Part A — Put it live on GitHub Pages (free)

Repo: `https://github.com/jitendrajangid-stack/MEAN-STACK-TRANING`

### Option 1 — Drag & drop (no git, easiest)
1. Open the repo on github.com → **Add file → Upload files**.
2. Drag in `index.html` (and `README.md`, `Code.gs` if you like). Commit.
3. Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` → `/root` → **Save**.
4. Wait ~1 min. Your site: `https://jitendrajangid-stack.github.io/MEAN-STACK-TRANING/`

### Option 2 — Push with git (use a FRESH token, then delete it)
> ⚠️ Never paste a token into chat/files. Generate a new one, use it once, revoke it.
```bash
cd mean-training-plan
git init
git add index.html README.md Code.gs
git commit -m "MEAN training plan tracker"
git branch -M main
git remote add origin https://github.com/jitendrajangid-stack/MEAN-STACK-TRANING.git
git push -u origin main   # username = jitendrajangid-stack, password = your fresh token
```
Then enable Pages as in Option 1, step 3.

---

## Part B — Store progress in a Google Sheet (free, ~10 min)

Do this in **your Google account** (the training owner's).

1. Go to <https://sheets.google.com> → **Blank spreadsheet**. Name it e.g. *MEAN Training Progress*.
2. Menu **Extensions → Apps Script**. Delete the sample code.
3. Paste the entire contents of **`Code.gs`** → click **Save** (💾).
4. Click **Deploy → New deployment**.
   - Gear ⚙️ → **Web app**.
   - **Execute as:** *Me*.
   - **Who has access:** *Anyone*.  ← required so the page can reach it.
   - **Deploy**. Approve the permissions prompt (choose your account → *Advanced* → *Go to project (unsafe)* → *Allow*; it's your own script).
5. Copy the **Web app URL** — it ends in `/exec`.
6. Open `index.html`, find near the top:
   ```js
   var API_URL = "";
   ```
   Paste your URL:
   ```js
   var API_URL = "https://script.google.com/macros/s/AKfy..../exec";
   ```
7. Re-upload / re-push `index.html`. Done — progress now saves to your Sheet.

A **Progress** tab appears in the Sheet with one row per trainee:
`Name | Done | InProgress | Left | Updated | Data(JSON)` — glance at it any time.

> Updating `Code.gs` later? In Apps Script: **Deploy → Manage deployments → ✏️ Edit
> → Version: New version → Deploy.** The `/exec` URL stays the same.

---

## Passwords (set in `Code.gs`, top of file — never in index.html)
- `ADMIN_PW` — yours (Jitendra). Opens the **Admin view** (all trainees) and can open any board.
- `USERS` — one line per trainee: `'Exact Name': 'their password'`. A dev can only open/update
  their own board. Add a dev by adding a line, then **redeploy** (new version).
- Current: admin `Jitendra@admin`; `Priyanshu Mishra` → `HSOE&5634N`. Change these anytime.
- Reality check: this protects the saved progress data (checked server-side). The training
  content itself is public (it's a static page) — that's expected.

## Tabs
6-Week Plan · Project Build · Final Project (5-day) · **Daily Log** · Resources.
The Daily Log (planned/actual hrs, what you learned, blockers, confidence 1–5) also saves
per trainee, alongside statuses.

## Sign-in & progression
- On load the page shows a **Sign in** box (name/email + password). Valid → their board opens;
  invalid → a clear "couldn't find that / contact the owner" message. A remembered session
  auto-opens via `?name=` (password cached in the browser); **Sign out** clears it.
- The identity field works with either a **name** (current `USERS`) or an **email** — no page
  change needed when you switch `USERS` keys to emails in `Code.gs`.
- **Sequential unlock:** each day's Status stays **🔒 Locked** until the previous day is marked
  **Done** (independently for Plan, Project Build, Final Project; the Daily Log row unlocks with
  its plan day). Un-marking an earlier day re-locks the later ones.

## Automated Apps Script deploy (clasp)
Deploy `Code.gs` from the terminal to the **same `/exec` URL** — no more copy-paste + Manage
deployments. Uses `clasp` (Apps Script CLI). Scoped to this repo via `.clasp.json` (this
script's id), like an SSH remote; auth is your Google account (one login).

One-time:
1. Turn on the Apps Script API: <https://script.google.com/home/usersettings>
2. `npx --yes @google/clasp@2 login`  (opens Google OAuth in your browser)
3. Get the **Script ID**: Apps Script editor → ⚙ Project Settings → *IDs*. Create `.clasp.json`
   (git-excluded) in this folder:
   ```json
   { "scriptId": "YOUR_SCRIPT_ID", "rootDir": ".", "fileExtension": "gs" }
   ```
4. Get the **web-app deployment id**: `npx @google/clasp@2 deployments` → copy the id of the
   web-app deployment (the one behind your `/exec` URL). Put it in `deploy-gs.sh` or export it:
   `export GS_DEPLOYMENT_ID=AKfyc...`

Then every deploy is just:
```bash
./deploy-gs.sh          # clasp push + clasp deploy -i <id>  → same /exec URL
```
Notes:
- `.claspignore` makes clasp push **only** `Code.gs` + `appsscript.json` (never the web app).
- First run: `npx @google/clasp@2 pull` once to fetch the real `appsscript.json` manifest, so
  the push doesn't change your web-app access settings (keep **Anyone / Execute as me**).
- `.clasprc.json` (auth) and `.clasp.json` (script id) are git-excluded — never published.
- `gcloud` is **not** used here — Apps Script deploys go through `clasp`, not the GCP CLI.

## Notes
- **Local mode** (`API_URL = ""`): fully usable, but progress is per-browser only.
- With the Sheet backend, `localStorage` is still used as an offline cache, so a
  dropped connection never loses a click — it syncs on the next save.
- Scheduling is progress-driven (no calendar dates); the Final Project unlocks on **31 Aug 2026**.
