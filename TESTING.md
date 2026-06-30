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

## After contests settle — reconcile (optional)

Scoring your results pulls the contest field from DraftKings, which runs **on your
machine** with your DK login. Ask Claude to "reconcile my contests" and the
`reconcile-contests` skill walks you through it (including grabbing your DK cookie
the first time). Building lineups does **not** need this.

## Getting help

Stuck or something looks wrong? Tell Claude what you saw — it can check your
sign-in (`bettor-help whoami`), your session, and your subscription, and guide you
from there.
