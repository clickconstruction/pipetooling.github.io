import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5764',
  date: '2026-10-23',
  title: 'Quickfill: a Percent complete station where the stages and the money disagree with the % done',
  kind: 'feature',
  highlights: [
    'A new Quickfill station, Percent complete, lists every open job whose ticked stages or paid money disagree with its % done: a stage paid and ticked while the job says 0% done, two stages paid while the job says 30%, 60% of the bid paid on a job that says 20%, or a bid paid in full under 100%.',
    'Each card shows the job, the stage bar as the Pipeline draws it, the paid share and one plain sentence that says what disagrees. The % box is pre-filled with the number the facts suggest, the ticked stages’ share or the paid share, and Save writes it the way the Pipeline’s % done box does, with the same activity note on the job.',
    'Dismiss for one week hides a card for the whole office, not just this device, and the line it leaves has Undo. A save that fails names the job and the reason on its own card; the rest stay workable. The header counts the cases and says All agree when there are none.',
    'A paid deposit never counts as work done, so a job that has not started does not show. A percent ahead of the ticked stages is a bill that is behind, not a wrong percent, and stays on the Pipeline.',
  ],
}

export default note
