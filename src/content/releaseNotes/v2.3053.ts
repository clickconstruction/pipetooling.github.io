import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3053',
  date: '2026-09-07',
  title: 'Safety net under the Dispatch Subs lanes',
  kind: 'fix',
  highlights: [
    'The loads behind the dispatch hub’s Subs lanes — live sub work orders with their stage, who is on each job, and sub off-days — now have 7 tests pinning what is read and how each order is labelled and placed in the week; no behaviour change.',
  ],
}

export default note
