import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2614',
  date: '2026-09-01',
  title: 'Property legal info lives on customer addresses',
  kind: 'feature',
  highlights: [
    'Each customer address can now carry the property’s legal identity: the filing county (suggested from the city, with a direct link to the county appraisal district), the legal description, residential/homestead classification, and the owner of record with their mailing address.',
    'Addresses show a “lien-ready” check when everything a lien filing needs is on file — or exactly which fields are still missing.',
    'Jobs link to a property record (the Release of Lien window suggests the match by address), so lien paperwork pulls the owner of record automatically — entered once per property, reused by every job there.',
  ],
}

export default note
