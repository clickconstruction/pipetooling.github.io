#!/usr/bin/env python3
"""
The bid-picker sweep (v2.4034; punch list #21 / the Pricing map's step 11): the eleven-line
search row above the bid picker, copied into nine Bids tabs, becomes <BidPickerSearchRow />.

    python3 scripts/bid-picker-search-row-sweep.py

Run from the repo root on fresh main. Re-runnable: a tab already swept is left alone. It stops
without writing anything if a tab's row is not the exact shape it expects. On a rebase
conflict in one of the nine tabs, take main's version of the tab and run this again — the
script is the source of truth (CLAUDE.md → mechanical sweeps merge alone).
"""
import re, sys, pathlib

TABS = {
  'BidsPricingTab': True, 'BidsLaborTab': True, 'BidsCountsTab': True, 'BidsTakeoffTab': True,
  'BidsCoverLetterTab': True, 'BidsSubmittalsTab': True,
  'BidRfiTab': False, 'BidChangeOrderTab': False, 'BidLienReleaseTab': False,
}
WITH_NUMBER = 'Search bids (bid #, project name, or GC/Builder)...'
WITHOUT = 'Search bids (project name or GC/Builder)...'
ROW_DIV = "<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>"

# <div …> <input type="text" placeholder=… value={Q} onChange={(e) => SET(e.target.value)} style={{…}} /> <BidPickerSortToggle /> <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} /> </div>
ROW = re.compile(
  r'(?P<indent>[ \t]*)' + re.escape(ROW_DIV) + r'\s*'
  r'<input\s+type="text"\s+placeholder="(?P<placeholder>[^"]+)"\s+value=\{(?P<q>\w+)\}\s+onChange=\{\(e\) => (?P<set>\w+)\(e\.target\.value\)\}\s+'
  r"style=\{\{ flex: 1, (?P<minw>minWidth: 200, )?padding: '0\.5rem', border: '1px solid var\(--border-strong\)', borderRadius: 4, boxSizing: 'border-box' \}\}\s*/>\s*"
  r'<BidPickerSortToggle />\s*'
  r'<MyBidsToggle active=\{onlyMyBids\} onChange=\{setOnlyMyBids\} />\s*'
  r'</div>'
)

out = {}
for tab, with_number in TABS.items():
  path = pathlib.Path('src/components/bids') / f'{tab}.tsx'
  s = path.read_text()
  if '<BidPickerSearchRow' in s:
    print(f'{tab}: already swept'); continue
  m = list(ROW.finditer(s))
  if len(m) != 1:
    sys.exit(f'{tab}: expected one picker row, found {len(m)} — nothing written')
  m = m[0]
  want = WITH_NUMBER if with_number else WITHOUT
  if m['placeholder'] != want:
    sys.exit(f'{tab}: placeholder is {m["placeholder"]!r}, expected {want!r} — nothing written')
  if bool(m['minw']) == with_number:
    sys.exit(f'{tab}: the box\'s minWidth does not match its kind — nothing written')
  if s.count('<BidPickerSortToggle') != 1 or s.count('<MyBidsToggle') != 1:
    sys.exit(f'{tab}: a toggle is drawn somewhere else too — nothing written')
  paper = '' if with_number else ' searchesBidNumber={false}'
  row = f"{m['indent']}<BidPickerSearchRow query={{{m['q']}}} onQueryChange={{{m['set']}}} onlyMyBids={{onlyMyBids}} onOnlyMyBidsChange={{setOnlyMyBids}}{paper} />"
  s = s[:m.start()] + row + s[m.end():]
  # imports: the two toggles leave, the row arrives where the first of them stood
  lines = s.split('\n')
  imp_sort = "import { BidPickerSortToggle } from './BidPickerSortToggle'"
  imp_mine = "import { MyBidsToggle } from './MyBidsToggle'"
  if lines.count(imp_sort) != 1 or lines.count(imp_mine) != 1:
    sys.exit(f'{tab}: the toggles\' imports are not the two lines expected — nothing written')
  first = min(lines.index(imp_sort), lines.index(imp_mine))
  lines[first] = "import { BidPickerSearchRow } from './BidPickerSearchRow'"
  lines = [l for i, l in enumerate(lines) if i == first or l not in (imp_sort, imp_mine)]
  out[path] = ('\n'.join(lines), m['q'])

for path, (text, q) in out.items():
  path.write_text(text)
  print(f'{path.stem}: swept ({q})')
print(f'{len(out)} tab(s) written')
