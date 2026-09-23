import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3751',
  date: '2026-09-23',
  title: 'Send a job as a task: the job is a bar above the box, not a code in it',
  kind: 'feature',
  highlights: [
    'The purple "send this job as a task" arrow — on the Jobs pipeline row, the phone card and the Job Detail header — used to drop a code like {{1:1016 · Mission faucet}} into the text box for you to type after. Now the job sits on its own bar above the box: number and trade pill, job name, address and customer.',
    'The box is empty and asks "What needs doing on this job?". Type only the task; the sent task still reads "1016 · Mission faucet — your words" with the job name as a link that opens the job, exactly as before.',
    '"open ↗" on the bar shows the job behind the dialog without losing your draft. "×" on the bar makes it an ordinary task with no job attached.',
  ],
}

export default note
