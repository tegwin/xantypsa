#!/usr/bin/env bash
#
# Scan for credentials before they reach a commit.
#
# Written after GitGuardian found what a by-eye check had passed. The lesson
# was not "look harder": it was that the misses are never the obvious shapes.
# An `re_...` or `sk-...` is easy. What got through were LITERAL DEFAULTS -
# `MYSQL_PASSWORD=${MYSQL_PASSWORD:-email_parser_password}` and a banner
# printing the shipped login - because none of them look like a key.
#
#   scripts/secret-scan.sh            scan what is staged plus what is tracked
#   scripts/secret-scan.sh --all      scan the entire git history as well
#
# Exits non-zero on a finding, so it can be a pre-commit hook and mean it.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

FOUND=0
report() { printf '\n  %s\n' "$1"; FOUND=1; }

# Generated output and vendored code are not ours to police.
EXCLUDES=':(exclude)node_modules/**
:(exclude)site-docs/**
:(exclude)**/package-lock.json
:(exclude)scripts/secret-scan.sh'

files() { git ls-files -- . $EXCLUDES; }

echo "Secret scan"
echo "==========="

echo
echo "1. Provider keys and private keys"
HITS=$(files | xargs grep -nIE \
  '\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}|pdl_(sdbx|live)_apikey_[A-Za-z0-9]{10,}|\bsk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY' \
  2>/dev/null | grep -vE '\.\.\.|<|xxx|YOUR_|PASTE_')
[ -n "$HITS" ] && report "$HITS" || echo "   none"

# The one that actually got through. A baked-in fallback IS a credential.
echo
echo "2. Literal defaults (the miss that started this)"
HITS=$(files | xargs grep -nIE \
  ':-[^}]*(pass|secret|key|token|pwd)[^}]*\}|(environ\.get|getenv|_env)\([^)]*(PASSWORD|SECRET|KEY|TOKEN)[^)]*,[[:space:]]*['"'"'"][^'"'"'"]+['"'"'"]' \
  2>/dev/null | grep -viE "change-?this|:\?|PLACEHOLDER|default=''|default=\"\"|:-\}")
[ -n "$HITS" ] && report "$HITS" || echo "   none"

echo
# Tests are included on purpose. A literal in a test file looks exactly like a
# literal anywhere else to a scanner, and "it is only a test" is the reasoning
# that lets the next one through. Generate them: see test_credentials.py.
echo "3. Hardcoded passwords, and credentials printed to a user (tests included)"
HITS=$(files | xargs grep -nIE \
  '(password|passwd|pwd)[[:space:]]*[:=][[:space:]]*['"'"'"][^'"'"'"]{1,}['"'"'"]|Password:[[:space:]]+[A-Za-z0-9!@#$%^&*]{3,}' \
  2>/dev/null | grep -viE 'example|placeholder|Unchanged|form\.|request\.|\.get\(|%s|\{\{|None|type=|name=|label|VARCHAR|autocomplete|a_password|a_secret|deliberately|Password: *(string|number|boolean|any)\b')
[ -n "$HITS" ] && report "$HITS" || echo "   none"

echo
echo "4. Connection strings with credentials in them"
HITS=$(files | xargs grep -nIE \
  '(mysql|postgres|postgresql|mongodb|redis|amqp)(\+[a-z]+)?://[^:/[:space:]]+:[^@[:space:]]+@' \
  2>/dev/null | grep -viE 'user:password|USER:PASS|<|example' | grep -vE '[$][{]')
[ -n "$HITS" ] && report "$HITS" || echo "   none"

# A company domain beside the word "password" trips GitGuardian on its own,
# whether or not anything secret is nearby.
echo
echo "5. Company and internal domains"
# This repo is public, so the private domain list lives outside it. Put one
# regex per line in .secret-scan-domains (gitignored) to check your own.
DOMAINS_FILE="${SECRET_SCAN_DOMAINS:-.secret-scan-domains}"
if [ -s "$DOMAINS_FILE" ]; then
  HITS=$(files | xargs grep -nIEf "$DOMAINS_FILE" 2>/dev/null)
else
  HITS=""
  echo "   (no $DOMAINS_FILE - skipping the private domain check)"
fi
[ -n "$HITS" ] && report "$HITS" || echo "   none"

echo
echo "6. Files that should never be tracked"
HITS=$(git ls-files | grep -iE '(^|/)\.env$|\.pem$|\.p12$|\.pfx$|id_rsa|credentials\.json|secrets\.ya?ml')
[ -n "$HITS" ] && report "$HITS" || echo "   none"

if [ "${1:-}" = "--all" ]; then
  echo
  echo "7. The same shapes anywhere in history"
  HITS=$(git log --all -p --no-color 2>/dev/null | grep -E '^\+' \
    | grep -E 're_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}' \
    | sort -u | head -20)
  [ -n "$HITS" ] && report "$HITS" || echo "   none"
fi

echo
if [ "$FOUND" -ne 0 ]; then
  echo "FINDINGS ABOVE. Move them to .env and fail loud when unset."
  echo "A default is a credential. Never ship one."
  exit 1
fi

echo "Clean."
