import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3593',
  date: '2026-09-18',
  title: "A field report's percent complete counts for the current run of the job only",
  kind: 'fix',
  highlights: [
    "A report filed before the job last went back into Working describes an earlier visit, so its \"How complete is the job?\" answer no longer feeds Job Summary, Burn or the Ready-to-bill prompt. A $48,700 job in Top Out had been reading 100% off a toilet-and-sink visit from June.",
    'Reports filed since the job entered Working count exactly as before, and a job that has never been in Working keeps every report.',
  ],
}

export default note
