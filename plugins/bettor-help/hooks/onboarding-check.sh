#!/usr/bin/env bash
# SessionStart hook — proactive onboarding for new bettor.help users.
#
# If this machine has NOT completed onboarding (no marker file), print
# getting-started guidance to stdout, which Claude Code injects as session
# context so the assistant proactively walks the user through the first flow
# (sign-in → MLB session → first profile → first build). Once onboarded, the
# marker exists and this hook stays silent (no nagging).
#
# The marker is written by mark-onboarded.sh (PostToolUse) the first time the
# user saves a profile or builds lineups — i.e. "onboarded" means they actually
# completed the loop once, not merely signed in.

MARKER="${HOME}/.config/bettor-help/.onboarded"

# Already onboarded → say nothing.
if [ -f "$MARKER" ]; then
  exit 0
fi

cat <<'GUIDE'
[bettor.help onboarding] This user has NOT completed bettor.help onboarding on
this machine yet (no first profile or build). Assume they may be new to Claude
Code AND to DFS tooling — be warm, concrete, and go one step at a time. Without
waiting for them to ask, proactively offer to get them started, then guide them:

  1. Confirm sign-in: run `bettor-help whoami`. If not signed in, `bettor-help login`.
  2. Start the sport session: call start_sport_session(sport="mlb") — MLB is the
     most built-out sport.
  3. Create their first profile. Profiles are user-owned (there are no preset
     profiles); the `profiles` skill explains the knobs. Keep the first one simple.
  4. Build their first lineups with build_lineups, then walk through the result.

Lean on the onboarding-connect skill for the full flow and the
sport-session-orchestrator to route to build / results / reconcile. After they
save a profile or build once, this guidance stops appearing automatically.
GUIDE
