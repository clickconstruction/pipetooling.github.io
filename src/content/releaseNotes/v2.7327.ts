import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7327',
  date: '2026-11-15',
  title: 'The Lien desk’s draft step goes: the paper saves itself',
  kind: 'feature',
  highlights: [
    'A notice or affidavit on the Lien desk is drawn from the job and the record the moment you open it. Nothing is saved until you change something or send it on. Tick a month, type a value, set the cover letter or correct the claim, and the desk saves the draft by itself a moment later. Saved shows beside the state line. A save that fails says why.',
    'Save draft is gone from the notice footer. Ask Malachi to approve ▸, Sign and approve ▸ and the menu rows still save first.',
    'The pile To draft reads To send on the Monthly notices, Lien affidavits and Retainage notices lists. The To do rows read Open the notice and Open the affidavit, and the ladder’s step says the paper is drawn from the record.',
    'Send N affidavits for approval… sends only an affidavit someone opened and changed, or approved. An affidavit nobody opened is left alone and listed under the press, so the batch never sends a paper nobody read.',
  ],
}

export default note
