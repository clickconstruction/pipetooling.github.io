import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6057',
  date: '2026-10-29',
  title: 'Where files go: the office sets the jobs root and how a job’s folder is named, on Documents',
  kind: 'feature',
  highlights: [
    'Documents has a Where files go tab for the office. Three cards: the jobs root with a live write check, how a job’s and a bid’s folder is named as pieces you add and take out with a real job as the example, and the tree inside with the choice to make it all up front or each folder as needed.',
    'Paste a Drive folder link and press Check to hear whether the app can write there, in the same words the photo sweep uses. The root moves only once the check passes; a folder the app cannot write in is refused in Drive’s words.',
    'Under the cards, Make the folders for N jobs without one makes every live job’s folders and lists what it held with the reason. Check a job’s folder and Check N pasted folders look at the folders jobs already have, and an amber line counts the ones the app cannot write to.',
    'A change applies to folders made from then on. Nothing that exists is moved or renamed, and the five folder names inside stay fixed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
