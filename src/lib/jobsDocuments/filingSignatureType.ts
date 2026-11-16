/**
 * The leader's electronic signature as a lien paper prints it (types alone, so a kernel that only names the shape does
 * not pull the document builder behind it, and the edge copy can carry that kernel). `lienFilingDocuments.ts` re-exports
 * it, so every caller's import stands.
 */
export type FilingSignature = {
  /** `type` = his name in cursive from one press; `draw` = his ink; `pen` (the pen train) = he signed the paper as printed, so the frame prints no mark, only the record; `code` (v2.5788) = his name in cursive, placed with his signing code on someone else's screen. */
  mode: 'type' | 'draw' | 'pen' | 'code'
  printedName: string
  pngDataUrl?: string | null
  /** "Signed October 9, 2026": the day alone. No clock and no zone reach a paper (v2.7437). */
  signedWords: string
  /**
   * "L878-4C2E91". It ties the paper to the row, where the whole record lives: the instant, the way and whose screen.
   * The sentence that said those on the paper (`auditLine`, until v2.7437) is not in this shape, so no renderer can print it.
   */
  recordId: string
}
