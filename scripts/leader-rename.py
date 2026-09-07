#!/usr/bin/env python3
"""
One company, Phase 3b (v2.2976): the role word "master" becomes "leader" in user-facing copy.

Rewrites the word master / masters / Master / Masters / "master technician(s)" / "Master Technician(s)"
ONLY where it is the role name: never inside identifiers (master_technician, master_user_id,
masterUserId, pinAPMasterIds…), never in "Master Subcontract Agreement" / "master subcontract",
"master plumber" (the licence), "master secret", "master record", or "master key".

Usage: python3 scripts/leader-rename.py <file>... (edits in place; prints per-file counts)
"""
import re, sys

PROTECT_AFTER = r'(?!\s+(?:subcontract|Subcontract|plumber|Plumber|secret|record|key|copy|list|bath)\b)'
# a role-word boundary: no letter/underscore/digit on either side (keeps identifiers intact),
# and not immediately followed by a hyphen+digit (test fixture ids like master-1)
BEFORE = r'(?<![A-Za-z0-9_])'
AFTER = r'(?![A-Za-z0-9_]|-\d)'

RULES = [
    (re.compile(BEFORE + r'Master Technicians' + AFTER), 'Leaders'),
    (re.compile(BEFORE + r'Master Technician' + AFTER), 'Leader'),
    (re.compile(BEFORE + r'master technicians' + AFTER), 'leaders'),
    (re.compile(BEFORE + r'master technician' + AFTER), 'leader'),
    (re.compile(BEFORE + r'master techs' + AFTER), 'leaders'),
    (re.compile(BEFORE + r'master tech' + AFTER), 'leader'),
    (re.compile(BEFORE + r'Masters' + AFTER + PROTECT_AFTER), 'Leaders'),
    (re.compile(BEFORE + r'Master' + AFTER + PROTECT_AFTER), 'Leader'),
    (re.compile(BEFORE + r'masters' + AFTER + PROTECT_AFTER), 'leaders'),
    (re.compile(BEFORE + r'master' + AFTER + PROTECT_AFTER), 'leader'),
]

def rename(text: str) -> tuple[str, int]:
    total = 0
    for rx, rep in RULES:
        text, n = rx.subn(rep, text)
        total += n
    return text, total

if __name__ == '__main__':
    grand = 0
    for path in sys.argv[1:]:
        src = open(path).read()
        out, n = rename(src)
        if n:
            open(path, 'w').write(out)
            grand += n
            print(f'{n:4}  {path}')
    print('total replacements:', grand)
