import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7325',
  date: '2026-11-15',
  title: 'People → Review → Scores: the field and the estimators, two numbers against one hurdle',
  kind: 'feature',
  highlights: [
    'Field: gross profit on every paid field hour over the last 4 weeks, 8 weeks or 90 days, against a hurdle. The hurdle is the window’s overhead per paid field hour plus the target profit per hour a dev sets on the tab. One row per job underneath, and a job with hours and no bill is flagged with a door to the job.',
    'Estimating & sales: one shared number for the estimator and the account manager. A bid counts its priced gross profit at award when that profit over its labor hours clears the hurdle, counts zero for good when awarded under it, and takes the job’s actual gross profit once the job is billed or paid.',
    'Until the first judged bid is awarded, the estimating card shows how many of the priced bids in play can be judged, and lists the ones whose Labor tab still needs hours, each with a door to it.',
    'For a dev, the owner and anyone with payroll access, beside the Scoreboard.',
  ],
}

export default note
