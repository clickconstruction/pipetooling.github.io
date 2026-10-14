import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5535',
  date: '2026-10-14',
  title: 'Lien desk: Mail through Docsmit never offers an envelope the run holds back',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In the run, Mail through Docsmit counted the envelopes the run holds back. An envelope held for an unsigned notice or a $0 claim could be prepared and mailed certified through Docsmit, though the packet would never print it.',
    'The button now offers only the envelopes that go out, the same ones Print the packet prints. A held envelope stays on its card with its reason, and Docsmit never sees it.',
    'When every certified envelope is held, the button is dim and its hover says so, instead of saying nothing is on certified mail. When some go and some wait, the hover counts the held envelopes that wait in the run.',
  ],
}

export default note
