import {
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
} from '../appSettingsKeys'

/**
 * Which Terms / Exclusions wording a bid's cover letter actually carries.
 *
 * The letter builders in `coverLetter.ts` take whatever text they are handed and print the
 * built-in wording when it trims to nothing. The bid room is handed the text itself and hides an
 * empty block, so a caller that passes it the raw text publishes a proposal with no Terms and no
 * Exclusions while the printed letter shows the built-in ones. This is the letter's rule as a
 * function, so every reader that is not the letter builder can ask for the same words.
 *
 * Order, exactly as the letter resolves it today:
 *   1. the bid's own entry, when it has one — including a box the estimator emptied;
 *   2. else the org default (Settings → Bid Cover Letter Defaults);
 *   3. and when the text picked by 1–2 is blank or whitespace only, the built-in wording.
 *
 * A bid whose box was emptied therefore gets the BUILT-IN wording, not the org default: the entry
 * exists, so the org default is never consulted, and the letter swaps blank text for the built-in.
 */
export function effectiveCoverLetterWording(input: {
  /** The bid's own entry; `undefined` when nobody has typed in the box for this bid. */
  perBid: string | undefined
  /** The org default; `null` / `undefined` when none is saved. */
  orgDefault: string | null | undefined
  /** `DEFAULT_EXCLUSIONS` or `DEFAULT_TERMS_AND_WARRANTY`. */
  builtIn: string
}): string {
  const chosen = letterWording(input.perBid, input.orgDefault)
  return chosen.trim() ? chosen : input.builtIn
}

/**
 * What a letter builder is handed for Terms or Exclusions: steps 1–2 above, else `''`. Handing it
 * the built-in text instead is not the same letter — the builder bullets text it is handed, and
 * prints its built-in Terms as one paragraph (the Approval PDF bulleted them until v2.4375).
 */
export function letterWording(perBid: string | undefined, orgDefault: string | null | undefined): string {
  return perBid ?? orgDefault ?? ''
}

/** The org's saved cover-letter wording (Settings → Bid Cover Letter Defaults); null where none is saved. */
export type CoverLetterOrgDefaults = { terms: string | null; exclusions: string | null; closing: string | null }

/** The `app_settings` keys that hold the org's cover-letter wording. */
export const COVER_LETTER_ORG_DEFAULT_KEYS = [
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
] as const

/** The org's wording from its `app_settings` rows, trimmed; a blank value counts as none saved. */
export function coverLetterOrgDefaultsFrom(rows: ReadonlyArray<{ key: string; value_text: string | null }>): CoverLetterOrgDefaults {
  const byKey = new Map(rows.map((r) => [r.key, r.value_text]))
  const pick = (key: string) => (byKey.get(key) ?? '').trim() || null
  return {
    terms: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT),
    exclusions: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT),
    closing: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING),
  }
}
