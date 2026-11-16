import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7466',
  date: '2026-11-16',
  title: 'Dashboard: a short view for a leader, with only what waits on him',
  kind: 'feature',
  highlights: [
    'A leader can now open onto a short Dashboard. It lists only what he alone can do, each with one button, then his day, then one door to everything else.',
    'The list is his lien notices, a GC’s run, lien waivers, the weekly line budgets and job notes that tagged him. One line says how many other things the office is handling.',
    'The page never says nothing waits while the Lien desk is still being read. If that read fails, it says so.',
    'Short or Full is set per person, in Settings or by the office on the leader’s People desk. Everyone stays on Full until someone presses Short.',
  ],
}

export default note
