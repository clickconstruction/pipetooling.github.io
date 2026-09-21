import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3684',
  date: '2026-09-21',
  title: 'A claim set by hand follows the job: the GC run, the affidavit draft and Collections',
  kind: 'feature',
  highlights: [
    'Put a GC on notice now claims the corrected figure on every job that has one — the claims table shows “set by hand” with the difference under the amount, the totals follow, and a claim over the balance goes to the leader rather than out on the spoken word. Approving the run counts as having looked at a carried correction.',
    'Collections shows what the notice does not cover: a job whose claim was set under the balance carries a line like “$1,500 not on the lien notice (claim set by hand) — unsecured, chase it here” beside its note.',
    'Two places that still used the raw balance now use the corrected one: the notice drafted from the Affidavits pane, and the run’s fallback when an approved notice has no saved draft.',
  ],
}

export default note
