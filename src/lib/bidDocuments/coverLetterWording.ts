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
  const chosen = input.perBid ?? input.orgDefault ?? ''
  return chosen.trim() ? chosen : input.builtIn
}
