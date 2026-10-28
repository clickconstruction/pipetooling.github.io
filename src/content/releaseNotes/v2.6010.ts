import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6010',
  date: '2026-10-28',
  title: 'Retainage a GC holds on our trade jobs is read by one rule',
  kind: 'feature',
  highlights: [
    'The app now has one read for the retainage a GC holds back on a job where we are the sub: the latest saved pay application’s retainage to date, or on a job with no pay application the figure typed in the job’s lien details. It is the first of four steps toward showing that money as owed to us on Accounts Receivable.',
    'The read already knows what a release looks like, so the later steps agree with it: the final pay application saved at zero retainage releases it on a job with applications, and a release bill does on a job without. A release counts once its bill has gone out, never while it is only drafted, and a paid release clears the amount.',
    'The amount ages from the day our contract on the job ended, the same day the Lien desk’s retainage clock starts. A job still open is not aging.',
    'Nothing shows on a screen yet. Accounts Receivable’s Retainage held section, the release, and the lien details reading the pay application follow in their own updates.',
  ],
}

export default note
