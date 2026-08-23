import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2156',
  date: '2026-08-23',
  title: 'Roadmap code tidy-up (no visible change)',
  kind: 'infra',
  highlights: [
    'The Roadmap tab\'s internals were split into smaller files — the data loader, the Map\'s stage cluster, and the canvas search box now live on their own — so future roadmap changes land faster and with less risk. Nothing changes on screen.',
  ],
}

export default note
