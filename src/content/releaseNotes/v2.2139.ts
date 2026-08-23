import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2139',
  date: '2026-08-22',
  title: 'Roadmap tasks can be pinned (groundwork)',
  kind: 'infra',
  highlights: [
    'Roadmap tasks gain a pin slot so an editor can say "this one, now" — the next release adds the ★ on the task card and puts pinned tasks at the top of the Next up shortlist.',
    'Stage numbers and prerequisite arrows are untouched; a pin only changes what the shortlist points at.',
  ],
}

export default note
