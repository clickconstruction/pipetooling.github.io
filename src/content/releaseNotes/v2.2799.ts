import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2799',
  date: '2026-09-04',
  title: 'The W-9 is now a form subs fill in on the page',
  kind: 'feature',
  highlights: [
    'The IRS Form W-9 (Rev. March 2024) is in the Contract library as a fillable form and in the Subs packet. Send it like any other document; the sub fills the real page and signs.',
    'Their Social Security or EIN number lands only inside the signed PDF. The record shows the last four; the W-9 compliance pill goes green on its own.',
    'The form definition is checked in for agents and devs to reuse or update when the IRS issues a new revision.',
    'The signing page now shows only the pages of a form that have something to fill in, so the W-9\'s instruction pages stay out of the way.',
  ],
}

export default note
