import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6513',
  date: '2026-11-04',
  title: 'The numbers and addresses in an email’s words are presses, and each press leaves a line on the thread',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Open an email in Messages and the signature’s phone number has Call after it, with Call in Quo or Call from my phone on a phone that has a seat. A number that can take a text has Text too. An email address has Email, and a street address has Open the map.',
    'Text or Email opens the reply box on that kind. When the number or the address belongs to this person it opens in this thread; when it is someone else’s it opens in their thread, and the app makes one for them when nobody has one yet.',
    'Every press leaves a gray line on the thread, such as “Grace pressed Call on (832) 871-4166 ext. 121 from Glenn’s email of Oct 22.”, with Undo on the toast for ten seconds. A line that opened another thread has “open it ›” on it, so anyone following later can see where it went.',
    'The mail program’s picture markers before the number and the address are gone from the words, and the tracking links at the foot of a signature stay plain links.',
  ],
}

export default note
