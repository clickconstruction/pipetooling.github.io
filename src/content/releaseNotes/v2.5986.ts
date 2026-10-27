import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5986',
  date: '2026-10-27',
  title: 'A lost signal on a server call reads No connection',
  kind: 'fix',
  highlights: [
    'With no signal, a press that calls one of our server functions used to read Failed to send a request to the Edge Function. It now reads No connection, the same words every other screen uses, with Retry where the screen offers it.',
    'The invoice under Field: Waiting for Approval on the Dashboard now offers Retry when it cannot reach Stripe. With no signal, it loads again by itself once the signal is back.',
    'On a Bids tab with Only my bids ticked, a search that finds none of your bids now also offers Show every bid. A bid someone else holds is one press away.',
    'Three customer pages now say what fills an empty part: the job stages card, the public terms page in English and Spanish, and a contract link with nothing to read.',
  ],
}

export default note
