#!/bin/bash
# Builds mockup.html (punch list #217, Show it, don't say it) from parts/: the parts in name order, with prototypes.json
# and picks.json injected into the page's script where it says /*MANIFEST*/null and /*PICKS*/null. Edit a part, never
# the built page, then run this and commit both. FRAGMENT_OUT=<file> also writes the body-only fragment the claude.ai
# copy is published from.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp)"
cat "$DIR"/parts/*.html > "$TMP"
node -e '
const fs = require("fs");
const [manifest, picks, page] = process.argv.slice(1);
let s = fs.readFileSync(page, "utf8");
for (const [slot, file] of [["/*MANIFEST*/null", manifest], ["/*PICKS*/null", picks]]) {
  if (!s.includes(slot)) { console.error("the page has no " + slot + " slot"); process.exit(1); }
  const json = fs.readFileSync(file, "utf8").trim();
  JSON.parse(json);
  s = s.replace(slot, () => json);
}
fs.writeFileSync(page, s);
' "$DIR/prototypes.json" "$DIR/picks.json" "$TMP"
{
  printf '%s\n' '<!doctype html>' '<html lang="en" data-theme="light">' '<head>' '<meta charset="utf-8">' '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' "<title>Show it, don't say it</title>" '</head>' '<body>'
  cat "$TMP"
  printf '%s\n' '</body>' '</html>'
} > "$DIR/mockup.html"
if [ -n "$FRAGMENT_OUT" ]; then cp "$TMP" "$FRAGMENT_OUT"; fi
rm -f "$TMP"
echo "built $DIR/mockup.html ($(wc -c < "$DIR/mockup.html" | tr -d ' ') bytes)"
