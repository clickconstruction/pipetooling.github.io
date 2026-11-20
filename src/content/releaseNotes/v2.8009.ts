import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8009',
  date: '2026-11-19',
  title: 'Document builder: send a job’s insurance sheet to its trades',
  kind: 'feature',
  highlights: [
    'A published insurance sheet can be sent to the trades on its job. Each trade’s row says the day it went and the day they opened it.',
    'One press sends to every trade that is ready. A trade that is held is listed with its reason, and the rest still go.',
    'A send never turns a trade’s page back on. A trade with no page gets one only when you send to them alone.',
    'The trade finds the sheet on their own page, with a press to send it to their insurance agent. Only a dev can send for now.',
  ],
}

export default note
