import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4185',
  date: '2026-09-29',
  title: 'Deploys unblocked: the contract window’s Edit & re-send test settles before it clicks',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'One render test failed about one run in six and stopped two deploys; it clicked a button React had already replaced. It now waits for the window’s loads to settle and clicks the button on the page. Nothing changed for users.',
  ],
}

export default note
