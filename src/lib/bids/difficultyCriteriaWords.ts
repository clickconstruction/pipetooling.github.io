/**
 * GC difficulty rating (punch list #357, PR 1): the words of Settings → Difficulty criteria, in one place so the card's
 * smoke and the guide read the same strings.
 */
export const DIFFICULTY_CRITERIA_WORDS = {
  title: 'Difficulty criteria',
  lead: 'The scales a GC is rated on, their rungs and their sentences. A rating and a priced bid pin to the version they were made under, so publishing a new version never moves old points.',
  startDraft: 'Start a draft',
  saveDraft: 'Save the draft',
  discardDraft: 'Discard the draft',
  addScale: 'Add a scale',
  addRung: 'Add a rung',
  removeRung: 'Remove',
  removeScale: 'Remove this scale',
  preview: 'Preview the GC card',
  hidePreview: 'Hide the preview',
  everyVersion: 'Every version',
  publish: (n: number) => `Publish version ${n}`,
  publishTitle: (n: number) => `Publish version ${n}?`,
  publishBody: 'Ratings under the current version carry where the key and the points still exist. A rung you removed leaves that scale unrated and the GC’s card says so. A bid already priced keeps its version, its words and its lines.',
  discardTitle: 'Discard the draft?',
  discardBody: 'Every change in it is lost. The published version stays as it is.',
  discardConfirm: 'Discard it',
  saved: 'Draft saved.',
  published: (n: number) => `Version ${n} is published.`,
  noPublished: 'No version is published yet. Start a draft and publish it.',
  footer: 'Publishing makes the next version. Ratings carry where the key and the points still exist. A rung you removed leaves that scale unrated, and the GC’s card says so. A bid already priced keeps its version, its words and its lines.',
  keyLocked: 'The key carries ratings from the published version and cannot change.',
  loading: 'Reading the criteria…',
} as const
