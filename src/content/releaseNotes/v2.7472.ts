import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7472',
  date: '2026-11-16',
  title: 'Liens: print the copies a filed lien owes, with a cover letter (punch list #366, step 1)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A filed lien that has not been served has a new press in its Lien window, under Record service…: Print the copies to mail. It prints one envelope’s papers for the owner, and one for the original contractor on a job under a GC.',
    'Each envelope gets a short cover letter and a copy of the affidavit. The letter names the county, the day filed, the document number and the amount, and says how to pay and get a release. The copy is the affidavit as filed, with a box that says COPY and what the page does not show.',
    'Counsel has not read the letter yet, or said that the app’s copy counts as the copy. A line under the press says so. The letter can be unticked, and the copy always prints.',
    'A filing with no recording number is held, and the number can now be typed right under the press. The print is kept on the job, under Sent from this job.',
  ],
}

export default note
