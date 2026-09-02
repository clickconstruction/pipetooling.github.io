import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2645',
  date: '2026-09-02',
  title: 'File the lien — and never miss its deadlines',
  kind: 'feature',
  highlights: [
    'Lien instruments grows the two statutory tabs: the § 53.056 notice of claim (the statute’s own form, sent to the owner and the GC — by certified mail with tracking, or emailed straight from the app) and the mechanic’s lien affidavit behind an honest readiness gate (owner of record, county + legal description, notice on file, homestead hard-stop).',
    'Record the filing with its county recording number and the serve-by date stamps itself (5 days, § 53.055); once filed, a Release of Recorded Lien tab appears, prefilled from the filing.',
    'Three new deadline watches: notice windows closing, filing windows closing, and a red card for filed-but-unserved liens. The clock shows in the modal header — Notice by… File by… — computed from the job’s real work dates.',
    'Demand-letter update: the § 31.04 theft-of-services line is now available whenever the client has made no payments on the job (it greys out the moment any payment exists).',
  ],
}

export default note
