import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8257',
  date: '2026-11-21',
  title: 'Dev seat: a paper’s words can be loaded as a draft',
  kind: 'feature',
  highlights: [
    'A session at the dev seat can load a builder’s whole draft into Documents → Document builder, instead of someone typing each line.',
    'It can also add one new entry to the Contract Book, in a packet you name.',
    'It shows what will change before it writes. It never publishes, never changes an entry that exists, and sends nothing.',
    'It will not make an entry named Master Services Agreement, because GC mode sends that one the moment it exists. Load it under another name and rename it yourself.',
  ],
}

export default note
