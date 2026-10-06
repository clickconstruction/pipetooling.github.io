import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4666',
  date: '2026-10-06',
  title: 'Send the run: the GC gets the courtesy PDF the desk promises',
  kind: 'fix',
  highlights: [
    'The Lien desk says the GC gets a courtesy PDF by email when we have an address. Recording the run now sends it, after the notice is written to the job.',
    'The GC’s envelope in the run has a Courtesy PDF tick naming the address. It is on by default, and you can untick it for a run.',
    'The email says it is a courtesy copy and how the notice itself is being delivered, such as by certified mail. If the email fails, the notice is still recorded and a warning names the copy that did not go.',
  ],
}

export default note
