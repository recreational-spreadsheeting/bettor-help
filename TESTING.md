# Testing bettor.help — First-Tester Setup Guide

Welcome, and thank you for testing **bettor.help**! This guide walks you through
everything from a blank computer to building your first daily-fantasy lineups. It is
written for two kinds of people:

- **Complete beginners on Windows** who have never opened a "terminal" before. Every
  step that touches the command line is spelled out.
- **Comfortable Mac users** who just want the exact commands.

Throughout this guide you will see **On Windows** and **On Mac** sub-sections. Follow the
one that matches your computer and skip the other.

---

## 1. What this is

**bettor.help** is a tool that builds optimized daily-fantasy sports (DFS) lineups for
you — right now for **MLB (baseball)** on **DraftKings**. You talk to it inside
**Claude Code** (Anthropic's AI assistant), and it does the heavy lifting: pulling the
day's games, projecting players, and assembling lineups based on *your* preferences. A
small companion program (the **bettor-help CLI**) runs on your own computer to handle the
parts that need your DraftKings login.

### What you'll need

Before you start, make sure you have (or can get) all four of these:

1. **Claude Code** — Anthropic's assistant, installed on your computer or used at
   [claude.ai](https://claude.ai). If you do not have it yet, install it from
   [claude.com/claude-code](https://www.claude.com/product/claude-code) and sign in. This
   guide assumes you can already open Claude Code and type messages to it.
2. **Node.js** — a free program that lets your computer run the bettor-help CLI. We
   install it in Step 2 below. (You do *not* need to know what it is — just install it.)
3. **A bettor.help subscription** — an account at [bettor.help](https://bettor.help) with
   an active subscription. **Anyone can install the plugin, but only a paid subscriber can
   actually build lineups.** If you try to build without a subscription, the tool will
   reply with `subscription_required`. Sign up first.
4. **A DraftKings account** — a normal DK account that you log into in your web browser.
   You will play your lineups there, and one optional step (reconcile, Step 6) reads your
   DK login so it can pull contest results.

---

## 2. Install Node.js

Node.js is the engine that runs the bettor-help CLI. You install it once.

### On Windows

1. Open your web browser and go to **[nodejs.org](https://nodejs.org)**.
2. Click the big button labeled **"LTS"** (it will say something like *"20.x.x LTS —
   Recommended For Most Users"*). This downloads an installer file
   (`node-vXX.X.X-x64.msi`) to your **Downloads** folder.
   > **Important:** bettor-help requires Node version **20 or newer**. The "LTS" button
   > always gives you a recent enough version, so just use that.
3. Double-click the downloaded `.msi` file to start the installer.
4. Click **Next** through the screens. **Accept the license**, keep the default install
   location, and **leave every checkbox at its default** — in particular, make sure
   *"Add to PATH"* stays checked (it is by default). PATH is just a list your computer
   uses to find programs; leaving this checked is what lets you type `node` later.
5. Click **Install**. Windows may pop up a box asking *"Do you want to allow this app to
   make changes to your device?"* — click **Yes**.
6. When it finishes, click **Finish**.
7. **Now open a terminal so you can check it worked.** The terminal (also called
   "PowerShell") is a window where you type commands. To open it:
   - Click the **Start** menu (Windows logo, bottom-left).
   - Type **`PowerShell`**.
   - Click **Windows PowerShell** in the results.
   - A dark window with a blinking cursor appears. This is your terminal.
   > **Why a *new* terminal?** Installing Node updates your PATH, but windows that were
   > already open won't see the change. Always open a fresh PowerShell window *after*
   > installing.
8. In that PowerShell window, type the following and press **Enter**:
   ```powershell
   node --version
   ```
   You should see something like `v20.11.1`. If you see a version number that starts with
   `v20` or higher, Node is installed correctly. (If you instead see a red error like
   *"node is not recognized"*, see **Troubleshooting** at the bottom.)

### On Mac

1. The easiest route is **[Homebrew](https://brew.sh)** (a package manager for Mac). Open
   **Terminal** (press `Cmd + Space`, type `Terminal`, press Enter), then run:
   ```zsh
   brew install node
   ```
   If you do not have Homebrew, install it first with the one-line command on
   [brew.sh](https://brew.sh), then run the line above.
2. **No Homebrew, no problem** — alternatively download the **LTS** installer (`.pkg`)
   from [nodejs.org](https://nodejs.org) and double-click it.
3. Verify it worked. In Terminal, run:
   ```zsh
   node --version
   ```
   You should see `v20.x.x` or higher. bettor-help requires Node **20 or newer**.

---

## 3. Install the plugin (inside Claude Code)

The "plugin" is what teaches Claude Code about bettor.help. You install it by typing a few
commands **into the Claude Code chat box itself** — these are not terminal commands. Type
each line into Claude Code and press Enter, one at a time.

```text
/plugin marketplace add recreational-spreadsheeting/bettor-help
/plugin install bettor-help@bettor-help
/plugin install bettor-help-mlb@bettor-help
/reload-plugins
```

What each line does:

1. **`/plugin marketplace add …`** — tells Claude Code where to find bettor.help's
   plugins (a public "marketplace").
2. **`/plugin install bettor-help@bettor-help`** — installs the core plugin (connection,
   profiles, results).
3. **`/plugin install bettor-help-mlb@bettor-help`** — installs the MLB (baseball)
   sport pack.
4. **`/reload-plugins`** — reloads Claude Code so the new commands become available.

**What success looks like:** after `/reload-plugins`, you can type `/` in Claude Code and
see bettor-help skills in the list (such as `onboarding-connect`, `profiles`, and
`mlb-build`). If they do not appear, run `/reload-plugins` again (see Troubleshooting).

> **Bleeding-edge testing channel (optional):** there is also a `-dev` channel
> (`bettor-help-dev@bettor-help` and `bettor-help-mlb-dev@bettor-help`) that points at our
> dev test environment instead of production. **Use the regular (non-`-dev`) plugins above
> unless we specifically ask you to test the dev channel.**

---

## 4. Install and sign in to the CLI

The **CLI** ("command-line interface") is the small companion program that runs on your
own computer. It handles signing in and, later, reading your DraftKings results. You
install it from the terminal using `npm`, a tool that came with Node.js in Step 2.

### Install it

Run this in your terminal (**PowerShell** on Windows, **Terminal** on Mac):

```powershell
npm install -g @bettor-help/cli
```

The `-g` means "install globally" so you can run it from anywhere. This downloads a few
files and finishes in under a minute.

> **On Windows — if you later get "bettor-help is not recognized":** this is a PATH
> issue. Close PowerShell and open a **new** PowerShell window, then try again. See
> Troubleshooting if it persists.

### Sign in

Now connect the CLI to your bettor.help account:

```powershell
bettor-help login
```

Here's what happens:

1. The CLI starts a tiny temporary web server on your own computer at
   **`http://localhost:8766/callback`** and opens your **web browser** automatically.
   (`localhost` just means "this computer." Port `8766` is fixed — the CLI always uses it.)
2. **On Windows, the very first time, Windows Firewall may pop up** a box titled *"Windows
   Defender Firewall has blocked some features of this app."* This is expected — the CLI
   needs to receive the sign-in response on your own machine. Click **Allow access**
   (allowing it on **Private networks** is sufficient).
3. In the browser, sign in to your bettor.help account (this uses **Clerk**, our sign-in
   provider). If you are not a subscriber yet, sign up here.
4. When sign-in succeeds, the browser shows a **"Signed in — Bettor Help"** page with your
   email and a note to close the tab and return to the terminal.
5. Back in your terminal you'll see a confirmation. You're signed in.

**Verify it worked** (optional):

```powershell
bettor-help whoami
```

This prints the account you're signed in as.

> **Where your login is stored:** the CLI saves a sign-in token at
> `~/.config/bettor-help/token.json` on Mac, or
> `C:\Users\<YourUsername>\.config\bettor-help\token.json` on Windows. You don't need to
> touch this file — `bettor-help login` and `bettor-help logout` manage it for you.

---

## 5. First run — connect, pick MLB, and create your first profile

Everything from here happens **inside Claude Code** by chatting with it. The plugin
provides "skills" — guided walkthroughs — that you trigger by name.

1. **Connect.** In Claude Code, type:
   ```text
   /onboarding-connect
   ```
   This checks that the CLI is installed and you're signed in, then starts a sport
   session. When asked which sport, choose **MLB**.

2. **Create your first profile.** A **profile** is *your* saved set of lineup preferences
   — bettor.help has **no prebuilt "cash" or "GPP" profiles**; every profile is yours to
   create. In Claude Code, type:
   ```text
   /profiles
   ```
   and follow the walkthrough. It will help you create and name a profile and explain each
   setting as you go. (This guide deliberately does **not** duplicate those settings — let
   the in-app walkthrough teach them, since they evolve.)

   > Tip: the `profiles` walkthrough can also seed a new profile from a starter template so
   > you have a working starting point to tweak.

---

## 6. The daily loop — build, enter, reconcile, results

Once you're set up, your everyday routine is four steps. Each is a Claude Code skill you
trigger by name; just chat with Claude and follow along.

> **Your daily working files live under `~/bettor-help/<date>/`.** On **CLI 0.1.3+** you can
> create or open today's folder in one step with `bettor-help day` (add `--open` to open it
> in your file browser). Claude also does this for you as it builds — no habit required.

### a) Build your lineups

```text
/mlb-build
```

This walks through the day's slates (groups of games), confirms which contest you're
building for, asks which **profile** to use, and produces lineups. **Review the lineups**
it shows you — check the players, salary, and that everyone is a confirmed starter — then
tell Claude to **save your entries** when you're happy. (Under the hood this calls a tool
named `save_entries`.)

### b) Enter on DraftKings

Take the saved lineups and enter them in your contests on **DraftKings** as you normally
would.

### c) Reconcile after contests settle

After your contests finish, **reconcile** pulls the full contest field from DraftKings so
bettor.help can score how you did. This is the **one step that needs your DraftKings
login**, because it reads contest data while logged in as you.

**First, connect your DraftKings session.** A "cookie" here is the small piece of text
your browser uses to stay logged in to DraftKings. The CLI can capture and maintain it for
you — you sign in to DK once and it handles the rest.

**The easy way — `bettor-help cookie --login` (CLI 0.1.4+).** Run this in your terminal:

```powershell
bettor-help cookie --login
```

This opens Chrome, you sign in to DraftKings **once**, and the CLI captures your session.
After that it **silently refreshes the cookie whenever it goes stale**, so you shouldn't
need to think about it again. Check the status anytime with:

```powershell
bettor-help cookie --check
```

> **Manual fallback (no Chrome installed, or `--login` unavailable): `bettor-help cookie`**
> walks you through pasting the `Cookie` header from your browser's developer tools. To
> grab it: log in to **[draftkings.com](https://www.draftkings.com)**, open **Developer
> Tools** (press **F12**, or right-click → **Inspect**), go to the **Network** tab, refresh
> the page, click any request to `draftkings.com`, and copy the entire **`Cookie:`** value
> (everything after `Cookie: `) when prompted. Not comfortable with developer tools? Ask
> Claude during the `reconcile-contests` walkthrough and it will guide you through it.
>
> The cookie ultimately lives at `~/.config/bettor-help/dk_cookie_header.txt` on Mac, or
> `C:\Users\<YourUsername>\.config\bettor-help\dk_cookie_header.txt` on Windows — but with
> `cookie --login` you never have to edit that file by hand.

> **If reconcile later says your cookie is expired** or that DK redirected to login, just
> re-run `bettor-help cookie --login` (or the manual `bettor-help cookie`) to refresh it.
> With `--login` this is usually handled automatically.

4. **Run reconcile.** Either trigger the skill in Claude Code:
   ```text
   /reconcile-contests
   ```
   or run it directly from your terminal (replace the date with the contest date):
   ```powershell
   bettor-help reconcile --sport mlb --date 2026-06-28
   ```

### d) See your results

```text
/dfs-results
```

This reports how your lineups did, including dollar ROI (return on investment). Result
scoring uses DraftKings' public payout data and does **not** require the cookie — the
cookie is only for the reconcile step that fetches the contest field.

---

## Using claude.ai instead of Claude Code (alternative)

You can also use bettor.help at **[claude.ai](https://claude.ai)** (including Claude
Cowork) instead of the Claude Code app:

- Add the bettor.help **MCP connector** using the URL **`https://mcp.bettor.help`** and
  sign in with your bettor.help account.
- You can **build lineups** this way **without installing the local CLI**.
- **However, the reconcile step (Step 6c) still needs the local CLI and DraftKings
  cookie**, because pulling the DK contest field runs on your own computer. So even on
  claude.ai, install the CLI (Steps 2 & 4) if you want results reconciled.

We recommend **Claude Code as the primary surface** for testing.

---

## 7. Troubleshooting

### Start with the doctor

Before digging into a specific error, run the built-in self-check — on **CLI 0.1.3+**:

```powershell
bettor-help doctor       # env self-check: node / login / cookie / MCP / home
```

It prints a ✓/✗ for each check with a fix hint. Paste its output to Claude (or into
`#bettor-help`) and it can usually take it from there.

### "command not found" / "bettor-help is not recognized" / "node is not recognized"

The program is installed but your terminal can't find it yet — almost always a PATH issue.

- **First fix (both OSes):** close your terminal completely and open a **brand-new**
  window, then try again. Newly installed programs are only visible in terminals opened
  *after* the install.
- **On Windows:** confirm Node installed with `node --version`. If *that* fails too,
  re-run the Node.js installer from Step 2 and make sure **"Add to PATH"** is checked.
- **On Mac:** if `npm install -g` succeeded but `bettor-help` isn't found, your npm global
  folder may not be on PATH. Run `npm config get prefix` to see the folder; with Homebrew
  Node this is usually already on PATH, so opening a fresh Terminal normally fixes it.

### The browser didn't open during `bettor-help login`

The CLI prints a sign-in URL in the terminal — copy it and paste it into your browser
manually. After signing in, return to the terminal.

### "Port 8766 is already in use"

The CLI must use port **8766** for sign-in (it's fixed). Another program is using it.

- **On Mac/Linux**, find it with:
  ```zsh
  lsof -nP -iTCP:8766
  ```
  then close that program and run `bettor-help login` again.
- **On Windows**, find it with:
  ```powershell
  Get-NetTCPConnection -LocalPort 8766
  ```
  then close the owning program (or restart your computer) and try again.

### `subscription_required` when building

You're signed in, but your account doesn't have an **active subscription**. Builds are
subscriber-only. Subscribe at [bettor.help](https://bettor.help), then try again. (You can
confirm which account you're signed in as with `bettor-help whoami`.)

### Plugin commands don't show up in Claude Code

Run `/reload-plugins` again. If they still don't appear, re-run the install commands from
Step 3 in order, then `/reload-plugins` once more. Make sure you typed
`bettor-help@bettor-help` (the part after `@` is the marketplace name and is required).

### Windows Firewall blocked the sign-in

If you dismissed the firewall prompt, sign-in may hang. Re-run `bettor-help login` and
click **Allow access** when the prompt reappears (Private networks is enough).

### DK cookie expired during reconcile

Reconcile says your cookie is expired or that DK redirected to login? Re-run
`bettor-help cookie --login` to refresh your session (or the manual `bettor-help cookie`).
Cookies expire regularly — this is normal, and with `--login` the CLI usually refreshes
them for you automatically.

---

## 8. Getting help

You're an early tester, so **bug reports and rough edges are exactly what we want.** When
something doesn't work:

- **Open an issue** on the GitHub repo:
  [github.com/recreational-spreadsheeting/bettor-help/issues](https://github.com/recreational-spreadsheeting/bettor-help/issues).
- Include: your **operating system** (Windows/Mac), which **step** you were on, the exact
  **command or skill** you ran, and the **full error message** (copy-paste or screenshot).
- For sign-in or build problems, note whether `bettor-help whoami` shows you signed in and
  whether your account has an active subscription.

Thanks for helping us test bettor.help!
