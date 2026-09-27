import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3877',
  date: '2026-09-27',
  title: 'Lien timeline: the demand letter is on the strip, and every step says whose move it is',
  kind: 'feature',
  highlights: [
    'A demand letter sent from the Lien window now sits on the job’s timeline as its own square step, placed by its reply-by day: how long the GC or owner has, when it was sent, the amount; overdue once the day passes with money open; paid when the covered bills are paid.',
    'Under each step still to come, a small word says whose move it is: ours, the GC, the owner, county or counsel. A step that is done carries none.',
    'A Waiting on line under Next on the path says who we wait on and for what — a reply to the letter, the owner’s name for the notice, the affidavit to be filed.',
  ],
}

export default note
