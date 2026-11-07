import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6661',
  date: '2026-11-07',
  title: 'A sub’s signed hours statement names their company',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'When the Hours statement window reads a sub’s sheets, a Company field appears under Who. Type the sub’s company and the attestation reads that the sub signs for it: I, Dale Whitfield, for Whitfield Plumbing LLC, state that we did the work above. Leave it blank to name the sub alone.',
    'The company is kept on the statement, so the printed paper, the signed PDF and a statement opened again all carry it.',
    'An agent on the dev seat passes labor_company when it makes a sub’s statement; on a clock paper it is refused in words.',
  ],
}

export default note
