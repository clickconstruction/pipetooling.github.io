import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2931',
  date: '2026-09-06',
  title: 'Subs report how far along their part is',
  kind: 'feature',
  highlights: [
    'Every working job card on the sub portal now asks "How far along is your part?" with five full-width buttons — 0, 25, 50, 75, 100 ✓ — and a note box. Nothing is sent until they press the one button that appears: teal "Send to office · 50% along, still working" for a percent or a note, green "Send to office · work is done" at 100, which opens the same confirmation as before.',
    'Every report lands on the job\'s Activity feed as a Sub progress line; a note also reaches the dispatch inbox, a bare percent never does. The office sees "50% along" beside the sub on Jobs → Subs → Work and as a fact on the sheet story\'s Work row.',
    'A sheet tied to a project step mirrors the percent onto the step, so the workflow reads it too.',
  ],
}

export default note
