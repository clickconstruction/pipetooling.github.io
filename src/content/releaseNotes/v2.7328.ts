import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7328',
  date: '2026-11-15',
  title: 'The Lien desk’s run is a checklist: Printed, Signed, Mailed',
  kind: 'feature',
  highlights: [
    'Send the run now opens on a checklist, one row per notice with three ticks across: Printed, Signed and Mailed. A tick that is in says who and when. An open tick is a press: Printed ▸ marks a paper printed elsewhere, Signed ▸ opens the pen pane for a paper the leader signed by hand, and Mailed is the tracking box for each envelope.',
    'The presses at the foot are counted and hold what is not ready, with the reason listed: Mark N printed, Mark N signed ▸ and Record N mailings ▸. Nothing moves to Sent until every envelope has its number.',
    'Print the sheet, under More, prints one page for the batch with the three boxes per row and a code per row. Scan the code with your phone and the desk opens on that notice’s Mailed box, ready to type.',
    'The printed pile is now called In the run, and each row names the tick it waits on, like printed · not signed. The pill on the desk’s title line reads The run · 3 of 7 mailed, with a small meter.',
  ],
}

export default note
