import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4262',
  date: '2026-09-30',
  title: 'GC Review: the statement email’s To, Cc and Reply to read like an email, with one menu',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The top of the Email statement window now reads From, To, Cc, Reply to and Subject. Each person is a name with the address beside it, and × takes one off. From is the company name the GC sees.',
    'One menu serves To and Cc. The GC’s own contact people come first, then the office. Type a name to find one, or type a whole address and pick Use it. Ticks on Cc, a dot on To.',
    'When replies go to the account man, your copy now shows on the Cc line, marked copied since replies go to him. Pick yourself on Reply to and it goes away.',
    'A sentence under the header says the send back before it goes: Goes to the GC. Their reply goes to Malachi. You get a copy. A scheduled send greys the two lines it decides for you.',
  ],
}

export default note
