import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8677',
  date: '2026-11-26',
  title: 'Recently deleted: a deleted test person can be put back',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Deleting a person made by mistake kept a copy of their roster record that could never go back, because no copy of their account was kept. For a test person, whose name starts with ZZ, the delete now keeps that copy too.',
    'A developer puts a deleted test person back from Settings, Data & recovery, Recently deleted: Preview restore, then Restore. The account, the roster record, the pay row and the workday template come back together, or nothing does.',
    'The window that asks before a test person is deleted now says a developer can put them back for 90 days. It no longer says for good.',
    'Nothing changes for a real person. Their delete is as it was, and it still cannot be taken back.',
  ],
}

export default note
