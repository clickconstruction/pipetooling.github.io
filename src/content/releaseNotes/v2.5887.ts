import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5887',
  date: '2026-10-26',
  title: 'Vehicle check-ins know whom you already asked',
  kind: 'feature',
  roles: ['assistant', 'master_technician', 'dev'],
  highlights: [
    'Each late truck now says whether its holder was asked for the miles and whether they answered, read from the holder\'s Messages thread: a text from the office since the last reading is the ask, a text back is the answer.',
    'The count on the station is what is still to do: trucks not yet asked, answers whose miles are not typed yet, and motor pool trucks to walk out to. Trucks asked and waiting on the driver sit in their own fold.',
    'Copy the ask puts the standard text on the clipboard with the truck and the days since the last reading. Open the thread takes you to the holder\'s messages.',
    'One line says what moved since the last look, and the Mark saves the note from the rows.',
  ],
}

export default note
