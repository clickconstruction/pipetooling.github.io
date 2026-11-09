import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6772',
  date: '2026-11-09',
  title: 'Text the bill: after the bill goes, the strip asks “Text Dana the pay link too?”, and the row reads Texted beside Emailed',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'After the bill goes by email from the share row or Send Email invoice, the green strip asks “Text Dana the pay link too? A text is read in minutes. Email waits for the evening.” with Text Dana the bill… and Not now. The press opens the Tell the customer sheet on the bill.',
    'The same strip follows Bill Customer making a Stripe bill and Make Stripe bill converting one, saying nothing has gone to the customer yet.',
    'A customer who asked for email only reads “Dana asked for email only.” in the question’s place.',
    'Beside Payment links the row reads “Emailed 3:30 PM · Texted 3:32 PM”, or “Not texted” until a text goes, read from the job’s thread, so nobody texts the bill twice.',
  ],
}

export default note
