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
export const LEGACY_PLAIN_WORDS_GUIDES: ReadonlySet<string> = new Set([
  'see-how-often-we-go-back',
  'see-what-the-office-got-done',
  'see-what-the-team-sees',
  'see-what-to-do-next-on-a-roadmap',
  'see-what-we-owe-each-person',
  'see-what-work-is-coming',
  'see-what-your-crews-did-today',
  'see-what-youre-owed-as-a-sub',
  'see-when-a-customer-will-pay',
  'see-where-someone-stands-on-pay',
  'see-where-you-win-and-lose-with-a-builder',
  'see-whether-the-crew-was-full',
  'see-who-was-on-which-job',
  'see-your-bids-on-a-map',
  'see-your-email-schedule',
  'send-a-bid-for-signature',
  'send-a-bid-pricing-package',
  'send-a-bill-to-more-than-one-person',
  'send-a-customer-account-to-your-attorney',
  'send-a-sub-a-work-order-from-a-sheet',
  'send-a-supply-house-a-quote-link',
  'settings-basics',
  'share-a-customer-their-portal',
  'tell-if-a-customer-opened-an-estimate-and-record-a-no',
  'text-a-bids-basics-to-someone',
  'the-bridge',
  'track-a-general-contractor-on-a-job',
  'track-rfis-on-a-bid',
  'trust-estimate-drafts-to-save-themselves',
  'try-the-new-cover-letter-layout',
  'turn-a-bill-into-a-stripe-bill',
  'turn-a-won-bid-into-a-job',
  'turnaway-trip-charges',
  'understand-how-liens-work-and-which-lien-tool-to-use',
  'understand-overhead-numbers',
  'update-percent-done-from-my-dashboard',
  'usage-dashboard',
  'use-the-pricing-calculator',
  'use-the-reply-book',
  'watch-a-job-for-sub-updates',
  'work-the-hours-grid-on-a-phone',
  'work-the-prospect-calling-queue',
  'work-the-punch-list',
  'write-a-change-order',
  'write-up-a-change-order-from-the-field',
])
