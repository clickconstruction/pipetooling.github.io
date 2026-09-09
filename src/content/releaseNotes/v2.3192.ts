import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3192',
  date: '2026-09-09',
  title: 'Field reports ask which stage you worked on',
  kind: 'feature',
  highlights: [
    'On a job split into stages on the Bill tab, the report’s percent-complete question becomes a stage list: tap the stage you worked on, slide how far along it is, and the app does the weighting — 60% of a stage worth 35% of the job moves the job 21 points. The math is written out under the number.',
    'Stage weights come from the stage lines’ share of the job’s value; "—" line items like permits sit outside the percent. A job with one line item reports exactly as before.',
    'The job percent still lands where it always did, so Pipeline, Job Summary, Burn and the Ready-to-bill prompt all follow. The stage’s own percent now shows on the Bill tab’s stage line too. "Set the whole-job % instead" is one tap away.',
  ],
}

export default note
