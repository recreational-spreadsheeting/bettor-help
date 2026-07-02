#!/usr/bin/env bash
# PostToolUse hook — record that the user has completed bettor.help onboarding.
#
# Fires after a save_profile / build_lineups / mlb_generate_lineups tool call
# (the matcher in hooks.json scopes it), meaning the user has done the real
# first flow at least once. Writes a local marker so the SessionStart guidance
# (onboarding-check.sh) goes quiet. Idempotent; reads + ignores the hook payload
# on stdin. Never fails the tool call.

DIR="${HOME}/.config/bettor-help"
MARKER="${DIR}/.onboarded"

# Drain stdin (the PostToolUse payload) so the producer never blocks.
cat >/dev/null 2>&1 || true

mkdir -p "$DIR" 2>/dev/null || true
if [ ! -f "$MARKER" ]; then
  printf 'onboarded-at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)" \
    >"$MARKER" 2>/dev/null || true
fi
exit 0
