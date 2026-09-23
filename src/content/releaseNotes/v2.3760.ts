import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3760',
  date: '2026-09-23',
  title: 'Lien desk: letter two — the second owner letter from a sent notice',
  kind: 'feature',
  highlights: [
    'A sent notice on the Lien desk is no longer a dead end. Its footer now counts the days since the packet went out and says whether the GC has paid or has authorized the owner to pay us. From day 10 the row wears “day 12 · letter two”, red past day 14 — counsel’s cadence for the second letter.',
    'Send letter two ▸ offers the two letters counsel wrote: the paid-out letter (three questions, the 10 percent, the affidavit date, for an owner we believe has paid the GC out) and the unresponsive one. It drafts the letter on the job’s notice — the same form, the same two recipients, the GC copied by the same mail — and the usual approval and run take it from there. The first packet stays on the record.',
    'The GC authorized direct pay… records the GC’s written okay on the notice, which turns letter two off: the owner may pay us against a release.',
    'The Dashboard’s lien card and the GC run’s claims table both say where letter two stands on every sent notice.',
  ],
}

export default note
