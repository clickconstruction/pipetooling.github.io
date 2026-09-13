import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3378',
  date: '2026-09-13',
  title: 'Ask the office: a builder can ask about a customer’s bill from their statement',
  kind: 'feature',
  highlights: [
    'Under each bill on a GC’s “Your customers’ open bills” card there is Ask the office. Two asks: Bill this to us instead, or Remind the owner for us, with an optional note.',
    'The ask lands in the Dispatch inbox as a Customer waiting request — “Done Right Foundation asks to be billed instead: J1017 · 4410 Cedar Hollow ($4,420.00) instead of Maria Delgado” — with the Call button. The office decides: move the bill with Bill to ▾, or reach out with the Followup tools.',
    'Nothing happens to the owner from the GC’s click: no email goes out, no bill moves, and the GC cannot pay the owner’s bill from here.',
  ],
}

export default note
