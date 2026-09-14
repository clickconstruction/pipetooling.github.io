import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3384',
  date: '2026-09-14',
  title: 'Contracts: a floor for small jobs, and “Not needed” on a job',
  kind: 'feature',
  highlights: [
    'The contract count on the Pipeline and the Dashboard no longer treats a $450 repair like a $120,000 job: a dev sets a dollar floor on the Get contracts signed card, and jobs under it leave the count, the No-contract filter and the sweep. A job with no amount always counts.',
    'The Contract modal gains Not needed… — say why (a builder’s subcontract, a service call, warranty work) and the job leaves the count; the row reads “No contract · not needed”. Needed after all puts it back.',
    'The card now says what it is not counting — “Floor $2,500 · 9 small jobs not counted · 3 marked not needed” — so the number it shows is the number worth chasing.',
  ],
}

export default note
