import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7114',
  date: '2026-11-12',
  title: 'Materials: What we buy, every supply house bill’s lines added up',
  kind: 'feature',
  highlights: [
    'Materials has a new tab in the Purchase group, **What we buy**. Each row is one thing the company buys: how many bills carry it, how many, the spend, a bar for each month, the houses and the last price paid.',
    'Pick a house, a job and the months, and sort by spend, by quantity or by how often. A bill split across jobs gives each job its share.',
    'A line with no part in the book yet is counted by the house and its code, so the page is full on day one. A part with a house’s number on file gathers its lines from every house.',
    'Freight, fuel and fees are counted as Charges. Only bills whose lines add up are counted, and the page says how many are not.',
  ],
}

export default note
