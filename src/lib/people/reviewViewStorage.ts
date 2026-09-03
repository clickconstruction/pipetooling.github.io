export const PEOPLE_REVIEW_VIEW_KEY = 'people_review_view_v1' as const

export type PeopleReviewView = 'ranked' | 'table'

/** Default is the ranked view; the table remains one click away. */
export function readReviewViewFromStorage(): PeopleReviewView {
  try {
    if (typeof localStorage === 'undefined') return 'ranked'
    return localStorage.getItem(PEOPLE_REVIEW_VIEW_KEY) === 'table' ? 'table' : 'ranked'
  } catch {
    return 'ranked'
  }
}

export function writeReviewViewToStorage(view: PeopleReviewView): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PEOPLE_REVIEW_VIEW_KEY, view)
  } catch {
    // ignore quota / private mode
  }
}
