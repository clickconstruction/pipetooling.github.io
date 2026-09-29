import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4132',
  date: '2026-09-29',
  title: 'Every email a customer reads comes from Click Plumbing and Electrical',
  kind: 'feature',
  highlights: [
    'The rest of the emails that leave the app for a customer, a GC, a supply house or a law firm now show "Click Plumbing and Electrical" as the sender — the physical invoice, test reports, hazmat notices, GC statements, supply-house job-account packets, the legal portal\'s emails, lien filings and releases, bid room links, pricing packages and price requests. The address underneath is unchanged.',
    'The bill window\'s own words follow: where it said copies go out "from ClickTooling", it now says from Click Plumbing and Electrical.',
    'A check in the build now refuses a new customer email that would go out under the software\'s name, so this cannot drift back.',
    'Team and staff emails keep coming from ClickTooling.',
  ],
}

export default note
