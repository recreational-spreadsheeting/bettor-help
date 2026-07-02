# Testing bettor.help — tester setup

Getting started is **three commands**. You don't need to know anything about
plugins or DFS — once you launch, bettor.help greets you and walks you through
your first lineups.

## Prerequisites

- **Node.js 20 or newer.** Check with `node --version`.
  - **Mac:** `brew install node` (or download from [nodejs.org](https://nodejs.org)).
  - **Windows:** download the LTS installer from [nodejs.org](https://nodejs.org) and
    make sure **"Add to PATH"** is checked. Open a **new** terminal afterward.
- **[Claude Code](https://claude.ai/code)** installed.

## Setup (one time)

```
npm install -g @bettor-help/cli
bettor-help start
```

`bettor-help start`:
- creates a `~/bettor-help` workspace,
- enables the bettor.help plugins **just for that folder** (your global Claude
  Code config is untouched),
- opens a browser to sign in.

Then open Claude Code in that workspace:

```
cd ~/bettor-help && claude
```

> **Windows:** the home folder is `C:\Users\<you>\bettor-help`; `cd %USERPROFILE%\bettor-help` then `claude`.

## First run

When Claude Code opens in `~/bettor-help`, it connects to bettor.help and — because
you're new — **proactively offers to get you started**. Just follow along: it
confirms you're signed in, starts an MLB session, helps you create your first
profile, and builds your first lineups. If you'd rather kick it off yourself, say:

> help me build an MLB lineup

## Each day — open today's folder

Your working files live under `~/bettor-help/<date>/`. On **CLI 0.1.3+** you can create
or open today's folder in one step:

```
bettor-help day          # create/print today's folder
bettor-help day --open    # and open it in your file browser
```

Claude also does this for you as it builds — no habit required.

## After contests settle — reconcile (optional)

Scoring your results pulls the contest field from DraftKings, which runs **on your
machine** with your DK login. Ask Claude to "reconcile my contests" and the
`reconcile-contests` skill walks you through it. The first time you'll need a fresh DK
cookie — on **CLI 0.1.3+** run `bettor-help cookie` for a guided paste (and
`bettor-help cookie --check` to confirm it's still fresh). Building lineups does **not**
need this.

## Getting help

Stuck or something looks wrong? **Start with the doctor** — on **CLI 0.1.3+**:

```
bettor-help doctor       # env self-check: node / login / cookie / MCP / home
```

It prints a ✓/✗ for each check with a fix hint. Paste its output to Claude (or into
`#bettor-help`) and it can take it from there — it can also check your sign-in, your
session, and your subscription and guide you from there.
