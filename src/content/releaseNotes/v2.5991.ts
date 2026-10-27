import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5991',
  date: '2026-10-27',
  title: 'Test the model key from its card',
  kind: 'fix',
  highlights: [
    'The Model keys card has Test the key. It asks Claude one short question and says the key works, or shows Anthropic’s own reason it was refused.',
    'A refused draft now carries that reason too, so a key without credits or without a workspace is named, not guessed.',
    'The card and its guide point to platform.claude.com and say to pick a workspace when you make the key.',
  ],
}

export default note
