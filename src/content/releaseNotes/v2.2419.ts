import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2419',
  date: '2026-08-28',
  title: 'Cover Letter sheds two redundant captions',
  kind: 'fix',
  highlights: [
    'The single-GC "Checked packets go in the letter…" explainer under the packet list is gone — the checkboxes speak for themselves (multi-GC bids keep their per-GC line).',
    'The headline amount no longer repeats "Mark sent stamps this as the bid\'s value" — that lives once, next to the Mark sent button.',
  ],
}

export default note
