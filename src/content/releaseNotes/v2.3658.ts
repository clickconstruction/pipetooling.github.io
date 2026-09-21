import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3658',
  date: '2026-09-20',
  title: 'Lien desk: the owner the roll found reads like the envelope — owner, c/o, street, city',
  kind: 'feature',
  highlights: [
    'The roll’s answer used to be one long sentence that wrapped mid-address and read “mail to % Sabra Health Care…”. It is now an address block with each part on its own line, so it reads the way the certified-mail label will.',
    'The “%” was the appraisal districts’ shorthand for “care of” — it now says c/o, and the state stays in capitals (CA, not Ca).',
    'The district, the tax year and the CAD link share one caption line above the address; Use is now Use this owner and sits beside the address with Find the owner.',
    'The grey “mail elsewhere” chip is now a plain line that says what it means: the mail goes somewhere other than the job site, which is normal for a company-held property. Landlord, public-owner and likely-homestead flags stay as chips.',
  ],
}

export default note
