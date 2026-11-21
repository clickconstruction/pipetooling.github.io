import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8189',
  date: '2026-11-21',
  title: 'Document builder: a link keeps its address when the keys behind it change',
  kind: 'fix',
  highlights: [
    'A link from the Document builder is now made with a secret of its own. Before, it leaned on a key the whole app shares, and a change to that key would have shown you a wrong address for every link.',
    'A link made before this keeps its address. The app finds it again by checking the address against the one it kept.',
    'If an address can ever not be shown again, the card says so. It never shows a wrong one. The link still opens for anyone who has it, and Make a new link gives you one to copy.',
  ],
}

export default note
