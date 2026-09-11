import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3302',
  date: '2026-09-11',
  title: 'Bid Board: won rows say whether the job is linked and whether the bid was costed',
  kind: 'feature',
  highlights: [
    'On won rows the Links column carries two new chips. "J1007 matches by value · Link" names an unlinked job whose price equals the bid to the dollar — one tap (with a confirm) links the job to the bid and takes the bid’s estimate as the job’s budget. The other chip reads the estimate’s state: costed · 47 h, hours only, or no cost estimate → Cost it, which opens the Labor tab.',
    'New Job from a bid now carries the bid’s estimate as the job’s budget by default — a checkbox beside the Bid link turns it off. The job’s Costs tab opens on ◆ Budget from bid instead of an assumption.',
  ],
}

export default note
