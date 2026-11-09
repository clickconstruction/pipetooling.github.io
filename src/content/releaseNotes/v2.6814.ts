import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6814',
  date: '2026-11-09',
  title: 'The lien papers you print claim the same amount the Lien desk shows',
  kind: 'fix',
  highlights: [
    "The job's Lien window counted the job's whole balance on its notice and its affidavit. The Lien desk counts what the sent bills still owe. On a job billed in stages the two papers swore different amounts. The window now claims what the desk claims.",
    'A claim set by hand on the Lien desk now reaches the papers the window prints. A line under the amount says who set it, when and why.',
    'The window also says how much of the job is not billed yet. That part is not claimed until it is billed.',
    'On a job you contracted with the owner, the affidavit names your own company as the original contractor, with its address. The desk used to leave that line blank and ask for a GC.',
  ],
}

export default note
