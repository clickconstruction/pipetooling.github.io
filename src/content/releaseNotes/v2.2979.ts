import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2979',
  date: '2026-09-06',
  title: 'Safety net under the sub portal guide',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The sub portal\'s "How do I get paid?" guide now has tests that keep its English and Spanish in step with each other and with the buttons the portal actually shows — rename a button and the guide\'s test fails until the guide follows.',
  ],
}

export default note
