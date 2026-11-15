import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7335',
  date: '2026-11-15',
  title: 'Lien desk: each affidavit row shows its five gates as marks',
  kind: 'feature',
  highlights: [
    'On Lien affidavits, every row in Needs the property facts and To draft carries five small marks after its last-work month, in the pane’s order: owner, legal description, the GC’s address, the § 53.056 notice, homestead. Green is clear, a red ✕ is a hold, a hollow dot is a gate the job is not asked (a job contracted with the owner has no GC and no notice).',
    'Hover a mark and it names its gate and what is missing; the whole strip reads how many are clear. On a computer the marks replace the row’s “missing …” words; on a phone, where there is no hover, the words stay.',
    'Rows past To draft (awaiting, ready, held, filed, missed) have already passed, so they carry no marks.',
  ],
}

export default note
