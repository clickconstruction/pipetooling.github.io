import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6946',
  date: '2026-11-11',
  title: 'On a job billed to its builder, the in kind strip reads the builder’s arrangement',
  kind: 'fix',
  highlights: [
    'Some jobs send their bills to a builder, not to the job’s own customer. Bill Customer already read the builder’s in kind arrangement on such a job.',
    'The strip in the job window read the customer’s arrangement, so the two could disagree. The strip now reads the builder’s too.',
    'On every other job nothing changes. The chip beside a customer’s name still speaks for that customer.',
  ],
}

export default note
