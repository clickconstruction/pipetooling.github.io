import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6672',
  date: '2026-11-08',
  title: 'The vehicle rate override’s database note says it is the fixed part only',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The note on the pay config’s manual vehicle rate still said it replaced the whole computed vehicle rate. Since Review follows the job it replaces only the fixed part, insurance, registration, service and wear per field hour, and never fuel. The note now says so. Nothing on any screen changes.',
  ],
}

export default note
