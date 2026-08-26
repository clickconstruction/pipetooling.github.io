import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2362',
  date: '2026-08-26',
  title: 'Hide people on the Health board',
  kind: 'feature',
  highlights: [
    'Every card in Estimating Health’s People section now has a ✕ to hide that person from your view — card and band marker both. A Hidden row under the heading brings anyone back with one click.',
    'The mystery “—” card is gone: archived people now resolve to their real name and start hidden automatically, tagged "archived" in the Hidden row.',
    'Hiding is per device and display-only — the weekly chart, stat cards, and the ALL marker keep counting everyone.',
  ],
}

export default note
