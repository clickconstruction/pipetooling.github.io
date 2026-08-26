import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2354',
  date: '2026-08-26',
  title: 'Workbench previews wait for you',
  kind: 'feature',
  highlights: [
    'Previewed prices on the Pricing Workbench now survive leaving the page — visit Labor, Counts, or anywhere else and they’re waiting when you come back, reloads included. Before, they were silently lost.',
    'Each price option keeps its own preview: viewing another price sets yours aside and it’s restored when you return.',
    'The strip now counts what’s unsaved — "Apply 12" and "12 previewed prices — saved only when you Apply · they’ll wait here if you leave".',
    'The (i) beside the bid name now appears on every bid and gains a "Previews & saving" section — including the promise that a GC can never see a preview.',
  ],
}

export default note
