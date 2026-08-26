import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2328',
  date: '2026-08-26',
  title: 'Job addresses stay Title Case',
  kind: 'feature',
  highlights: [
    'Job addresses now normalize to proper Title Case automatically — type or paste "11704 fm 1117 seguin tx" and it saves as "11704 FM 1117 Seguin TX". ALL-CAPS pastes calm down too.',
    'Address conventions are respected: FM/IH/TX/N/NE stay capitals, "5th" stays "5th", suite letters stay "200B", and names like McQueeney keep their casing.',
    'The address preview under the field shows exactly what will be stored, and the Add-comma suggestion applies the same casing.',
  ],
}

export default note
