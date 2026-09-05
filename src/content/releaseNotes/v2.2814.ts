import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2814',
  date: '2026-09-05',
  title: 'Work Orders tab: groundwork',
  kind: 'infra',
  highlights: [
    'Behind the scenes for the coming Work Orders tab: a sub work order can now belong to a job before any sheet exists, drafts can be saved without a price, and every sent order gets a record number like WO-977-01.',
    'When a sub signs a job work order, their Sub Labor sheet is created from the agreed amount automatically.',
  ],
}

export default note
