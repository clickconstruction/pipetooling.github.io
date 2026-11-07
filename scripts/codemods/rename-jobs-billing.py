#!/usr/bin/env python3
"""Punch list #261, call 3: the tab *Jobs & billing* becomes *Jobs, bills and liens* everywhere a person reads it.
Runs from the repo root. Skips history (release notes, their archive, recent-features fragments, to-dos) and code identifiers.
Re-run on a fresh main instead of hand-resolving a rebase conflict (CLAUDE.md → Mechanical sweeps merge alone)."""
import os, re, sys
ROOT = os.getcwd()
NEW = 'Jobs, bills and liens'
SKIP_DIRS = ('node_modules', '.git', 'dist', 'docs/recent-features', 'src/content/releaseNotes', 'to-dos', '.claude', 'supabase/archive')
SKIP_FILES = ('docs/RECENT_FEATURES.md', 'src/content/releaseNotes.ts', 'src/content/releaseNotesArchive.ts')
EXT = ('.ts', '.tsx', '.md', '.css', '.html', '.mjs', '.js', '.json')
# Order matters: the possessive first, then the plain name, then the aria/plain-words spelling.
RULES = [
  (re.compile(r"Jobs &(?:amp;)? billing[’']s"), NEW + '’'),
  (re.compile(r"Jobs &(?:amp;)? billing"), NEW),
  (re.compile(r"Jobs and billing"), NEW),
  (re.compile(r"jobs and billing"), NEW.lower()),
]
changed = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    rel = os.path.relpath(dirpath, ROOT)
    if rel == '.': rel = ''
    if any(rel == d or rel.startswith(d + '/') for d in SKIP_DIRS):
        dirnames[:] = []
        continue
    for fn in filenames:
        if not fn.endswith(EXT): continue
        p = os.path.join(rel, fn) if rel else fn
        if p in SKIP_FILES: continue
        with open(os.path.join(ROOT, p), encoding='utf-8') as f: s = f.read()
        out = s
        for rx, to in RULES: out = rx.sub(to, out)
        if out != s:
            with open(os.path.join(ROOT, p), 'w', encoding='utf-8') as f: f.write(out)
            changed.append(p)
print(f'{len(changed)} files')
for p in sorted(changed): print(' ', p)
