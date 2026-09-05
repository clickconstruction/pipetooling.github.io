import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2851',
  date: '2026-09-05',
  title: 'Nothing is saved until you commit: contract quick-send, RFQ quote links and the change-order bridge',
  kind: 'fix',
  highlights: [
    'People → Contracts: picking a name in a document\'s Send to… list no longer files an unsent copy for that person before you have sent anything. The copy is created the moment you tap Send email — so Cancel leaves nothing behind, and "Needs attention" and the person rail\'s unsent counts stop counting picks you walked away from.',
    'Bids → Supply house list → Copy with quote link: the link is put on your clipboard first and the request is saved only once it is. If the browser blocks the clipboard, the link appears in a field to copy by hand and the request is saved when you confirm you have it — no more requests you never got a link for, and no duplicates on retry. The request now records who created it.',
    'Bids → Change Order → Send for signature: a short confirm sheet shows what will be created and asks for the net change to the contract (prefilled when your cost text has a clear number). The Estimates draft opens with that amount as a real line instead of $0 with the money buried in a note. Cancel creates nothing.',
  ],
}

export default note
