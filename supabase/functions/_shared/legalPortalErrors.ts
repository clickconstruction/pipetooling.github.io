/**
 * Which error words may reach the collections law firm's browser (punch list
 * #85, item 7). `legal-portal` and `submit-legal-portal` used to answer a
 * thrown error with its own message on a 500: a Postgres error with table and
 * column names on a law firm's screen. Now an unexpected failure answers with
 * one plain sentence and the real error goes to the function's log.
 *
 * The deliberate messages stay. A 4xx carries words written for the firm (the
 * link is no longer active, that matter is not with your firm, too many
 * changes in the last hour), and the few 5xx sentences the functions write
 * themselves are listed here by name. Anything else on a 5xx becomes the
 * generic sentence: on the server before it is sent, and again on the page,
 * so an older deployed function cannot show a raw error either.
 *
 * Lives in `_shared` so both functions and the page read one list;
 * `src/lib/legal/legalPortalErrors.ts` is the client's door.
 */

export const LEGAL_PORTAL_GENERIC_ERROR = 'The office’s system could not answer. Please try again in a minute, or contact the office.'

/** The 5xx sentences the functions write themselves. Each says what failed and nothing about how. */
export const LEGAL_PORTAL_FIRM_WRITTEN_5XX: ReadonlyArray<string> = [
  'Could not record the step.',
  'Could not save that.',
  'Could not save the rule.',
]

/**
 * The words the firm sees for an answer with this status. A 4xx keeps its own
 * message (the functions write those for the firm); a 5xx keeps only a
 * sentence on the list. Anything missing, empty or unlisted becomes the
 * generic sentence.
 */
export function firmFacingErrorMessage(status: number, message: unknown): string {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return LEGAL_PORTAL_GENERIC_ERROR
  if (status >= 400 && status < 500) return text
  return LEGAL_PORTAL_FIRM_WRITTEN_5XX.includes(text) ? text : LEGAL_PORTAL_GENERIC_ERROR
}

/**
 * What a function's top-level catch does with a thrown error: logs the real
 * one under the function's name with a short reference, and answers with the
 * generic sentence and that reference. The firm can read the reference to the
 * office, and the office finds the log line by it. The reference is random and
 * says nothing about the error.
 */
export function unexpectedErrorBody(
  fn: string,
  e: unknown,
  log: (...args: unknown[]) => void = console.error,
  makeRef: () => string = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
): { error: string; ref: string } {
  const ref = makeRef()
  log(`${fn}: unexpected error (ref ${ref})`, e)
  return { error: LEGAL_PORTAL_GENERIC_ERROR, ref }
}

/** The reference from an answer's body, when it carries one the page may show: 4 to 16 letters and digits. */
export function errorRefOf(body: unknown): string | null {
  const ref = body && typeof body === 'object' ? (body as { ref?: unknown }).ref : null
  return typeof ref === 'string' && /^[A-Z0-9]{4,16}$/.test(ref) ? ref : null
}

/** The sentence and, after an unexpected failure, its reference: what the page prints. */
export function firmFacingErrorLine(status: number, body: unknown): string {
  const message = firmFacingErrorMessage(status, body && typeof body === 'object' ? (body as { error?: unknown }).error : null)
  const ref = status >= 500 ? errorRefOf(body) : null
  return ref ? `${message} Reference ${ref}.` : message
}
