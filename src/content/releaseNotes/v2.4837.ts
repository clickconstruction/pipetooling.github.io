import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4837',
  date: '2026-10-07',
  title: "GC mode: the schedule's chart shows one company's work",
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    "The GC mode schedule's chart can show one company's work alone. Its filter counts then count only that company's activities, so they read as that company's summary.",
    "Our team's printed copy shows only that company's work and says so in a sentence. The customer's copy never changes. Only a dev sees GC mode while it is built, and the chart itself reaches the app in a later step.",
  ],
}

export default note
