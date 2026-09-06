import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2887',
  date: '2026-09-05',
  title: 'Hiring → Source success groups candidates by job board, not by pasted link',
  kind: 'fix',
  highlights: [
    'Every candidate whose Source is a pasted Indeed (or ZipRecruiter, Craigslist, Facebook, LinkedIn, Handshake…) link now counts under that board — one "Indeed" row instead of one row per candidate — so the table finally answers "which source hires".',
    'Hand-typed spellings fold in too: "indeed.com", "Indeed ad" and "INDEED" are all Indeed; "referred by Marco" is Referral; "walked in" is Walk-in. Links from a site we don\'t recognize group by that site\'s name.',
    'When a row combines several spellings or links, a small "N variants" note appears next to it — hover to see which ones.',
    'The Source field\'s suggestion list offers the same grouped names, so new candidates land in the right row.',
  ],
}

export default note
