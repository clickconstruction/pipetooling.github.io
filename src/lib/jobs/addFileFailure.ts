/**
 * A file that did not go up into a job's Drive folder, and whether sending the same file again can help (v2.7635).
 * Until then every thrown error behind `drive-link`'s `put` reached the screen as the one word `failed`.
 *
 * Pure, and beside `jobFolderAddFile.ts` on purpose: that file is copied under `supabase/functions/_shared/gcKernels`,
 * and a change to it reads as drift on every function that holds the copy. Nothing here is needed on the server.
 */

/** The words of a failed upload that the function does not write itself. */
export const ADD_FILE_FAILURE_WORDS = {
  /** The function answered with no reason, or with its old bare word. */
  failed: 'The file was not added.',
  /** No answer came back at all: the file never reached the app. */
  lost: 'The file did not reach the app. Check the signal, then try again.',
  /** The press beside a failure a second try can get past. */
  tryAgain: 'Try again',
} as const

/**
 * `retry` is the function's own answer when it gives one (`drive-link` says so since v2.7635), true when no answer
 * came back, and otherwise read from the status: a busy or broken server may take a second try, a refusal will not.
 */
export class AddFileFailure extends Error {
  readonly retry: boolean
  constructor(message: string, retry: boolean) {
    super(message)
    this.name = 'AddFileFailure'
    this.retry = retry
  }
}

/** What came back from the function, as the io read it: the body's fields and the status. */
export type AddFileAnswer = { error?: unknown; retry?: unknown; status?: number | null }

/** A status a second try can get past: a wait that ran out, a busy server, a broken one. */
export function addFileStatusRetries(status: number | null | undefined): boolean {
  return status != null && (status === 408 || status === 429 || status >= 500)
}

/**
 * The failure for one answer, or for no answer (`null`). A bare `failed` is the function's old catch-all, and the
 * open link's door still says it: it names nothing, so the screen says the file was not added and offers the second try.
 */
export function addFileFailureOf(answer: AddFileAnswer | null, fallback: string = ADD_FILE_FAILURE_WORDS.failed): AddFileFailure {
  if (!answer) return new AddFileFailure(ADD_FILE_FAILURE_WORDS.lost, true)
  const said = typeof answer.error === 'string' ? answer.error.trim() : ''
  if (!said || said === 'failed') return new AddFileFailure(fallback, true)
  if (typeof answer.retry === 'boolean') return new AddFileFailure(said, answer.retry)
  return new AddFileFailure(said, addFileStatusRetries(answer.status))
}

/** Whether a thrown upload failure is one a second try can get past. Anything else is a refusal. */
export function addFileCanRetry(e: unknown): boolean {
  return e instanceof AddFileFailure && e.retry
}
