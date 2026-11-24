/**
 * The one line the sign-in page shows above its form when the app, not the person, signed this
 * browser out: a session that expired, or an Exit from View as that could not put the dev's own
 * sign-in back. Whoever signs the browser out leaves the words; the sign-in page takes them once.
 *
 * It rides in this tab's session storage, so it survives the full load to the sign-in page and
 * reaches no other tab. A browser that refuses storage shows no line, and the sign-in still works.
 */
export const SIGN_IN_NOTICE_STORAGE_KEY = 'auth_error_message'

type NoticeStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function tabStore(): NoticeStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** Leave the words for the sign-in page. Never throws: a refused write only loses the line. */
export function leaveSignInNotice(words: string, store: NoticeStore | null = tabStore()): void {
  try {
    store?.setItem(SIGN_IN_NOTICE_STORAGE_KEY, words)
  } catch {
    /* no storage: the sign-in page opens with no line */
  }
}

/** The words left for the sign-in page, taken once, or null when nobody left any. */
export function takeSignInNotice(store: NoticeStore | null = tabStore()): string | null {
  try {
    const words = store?.getItem(SIGN_IN_NOTICE_STORAGE_KEY) ?? null
    if (words) store?.removeItem(SIGN_IN_NOTICE_STORAGE_KEY)
    return words || null
  } catch {
    return null
  }
}
