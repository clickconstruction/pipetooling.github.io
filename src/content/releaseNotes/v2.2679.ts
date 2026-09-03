import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2679',
  date: '2026-09-03',
  title: 'Contracts on the Pipeline — see which jobs have a signed agreement',
  kind: 'feature',
  highlights: [
    'Every job row on Jobs → Pipeline now wears a contract chip: gray "No contract", amber "Contract sent · opened 2× · 6d", or green "✍ Signed" with the signer and date.',
    'Estimates the customer accepted online and bids signed in the bid room already count as the agreement, so the gray chips are the real gaps.',
    'The ⋯ menu’s Filters group gains a contract-state filter — pick "No contract" to see the jobs still needing one. Sending and customer signing arrive in the next releases.',
  ],
}

export default note
