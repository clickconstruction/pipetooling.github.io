import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3289',
  date: '2026-09-11',
  title: 'Costs tab: overhead covers the whole job, and the ledger loads once per hour',
  kind: 'fix',
  highlights: [
    'The job window’s Costs tab charged overhead over the last 120 days only, so an older job’s amber band and Burn’s overhead-so-far read lower than Job Summary. It now covers the job from the day office cost begins (Feb 19, 2026), so every job window and Job Summary agree.',
    'When that floor cuts off part of a job’s history, the chart legend says so: “since Feb 19, 2026, where office cost begins.”',
    'Burn’s overhead per field day stays a recent rate (the last 120 days), so the projection keeps reflecting how the job runs now.',
    'The overhead ledger is cached for the session and shared between Job Summary and every job window, so opening several jobs no longer rescans the company’s sessions each time.',
  ],
}

export default note
