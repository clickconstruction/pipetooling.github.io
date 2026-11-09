import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6771',
  date: '2026-11-09',
  title: 'Text the bill: the share row’s Text opens the Tell the customer sheet on the bill, and a first text says who is writing',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Text under a sent Stripe bill now opens the Tell the customer sheet on that bill. The Billed line reads “Hi Dana, this is Rosa with Click Plumbing. Your bill for the water heater is ready, $1,850.00. Text me here with any question. Pay it here:” with the bill’s own pay page last, in English or Spanish.',
    'The sheet names the number the text goes from beside the To chip, and Preview on a bill shows the real pay link.',
    'On the customer’s first text from us the sheet wears “First text to this number”, Preview shows the opt-out line the app adds under the words, and Send is held while the words name neither you nor Click Plumbing. Put the opening back restores the line’s opening. A later text is never held.',
    'A bill with no job at hand keeps the copy-only text, now “Your bill for … is ready, $…. Pay it here: …”.',
  ],
}

export default note
