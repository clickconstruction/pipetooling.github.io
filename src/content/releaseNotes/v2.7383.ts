import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7383',
  date: '2026-11-15',
  title: 'Sub labor: the rules for whose a sheet is (PR 1 of the sub labor train)',
  kind: 'feature',
  highlights: [
    'The ground for the sub labor changes that follow: one rule says who a sheet’s money is owed to. A sheet with a sub is the sub’s, whole. A sheet that names one teammate and no sub is owed to that teammate, as sub labor on top of their wages.',
    'A sheet names only the one person it pays. The rules for the sheet form’s one pick, for offering a job’s team without ticking it, and for taking teammates off a sub’s old sheets are worked out and tested here.',
    'What we owe a person is worked out sheet by sheet, with a check that the sheets add up to their Balance due.',
    'Nothing shows on a screen yet. The next changes draw it on People → Subs, on Jobs → Subs and in the sheet form.',
  ],
}

export default note
