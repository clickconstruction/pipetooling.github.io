/**
 * The help guides written before plain words became the convention (v2.4233, 2026-09-30):
 * every guide that existed that day but `build-a-submittal-package` (v2.4229). A guide on
 * this list is not yet held to the rules in `plainWords.ts`.
 *
 * **Never widen this list.** A new guide is held from its first commit. A PR that touches a
 * guide on this list rewrites it by the rules and removes its row — `npm run
 * check:plain-words` fails CI until it does. The list only shrinks; when it is empty,
 * delete it and let `helpGuidePlainWords.test.ts` hold every guide.
 */
export const LEGACY_PLAIN_WORDS_GUIDES: ReadonlySet<string> = new Set([])
