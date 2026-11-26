import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8660',
  date: '2026-11-26',
  title: 'Agreements: a paper sent to an outside company can name the site it is for',
  kind: 'feature',
  highlights: [
    'When you send a paper to a customer, a supply house or a trade company, the email window says This paper names no site, with Name a site…. It opens Which site is it for?, which finds an address a job or a bid already has.',
    'A company holds a paper once for each site, and once more for no site. A copy for one site is never reused for another.',
    'A copy already out for the picked site is offered again. A company that signed for the site is not sent the paper again, and the app says the day they signed.',
    'The site is kept when Send email is pressed, and not before. Lists that show a site’s papers come next.',
  ],
}

export default note
