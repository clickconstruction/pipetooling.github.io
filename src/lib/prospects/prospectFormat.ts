/**
 * How the Prospects page writes its small facts. These were module-level helpers in `src/pages/Prospects.tsx`
 * with no test; the words and the shapes are unchanged.
 */

/** A moment, short. A missing time reads as a dash. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}

/** A comment's kind in words. An unknown kind reads as itself. */
export function formatInteractionType(type: string): string {
  switch (type) {
    case 'answered': return 'Answered'
    case 'didnt_answer': return "Didn't answer"
    case 'no_longer_fit': return 'No longer a fit'
    case 'user_comment': return 'Comment'
    case 'converted': return 'Converted'
    default: return type
  }
}

/** The press that closed a timed call, in words (Timer history). An unknown press reads as itself. */
export function formatTimerButtonName(buttonName: string): string {
  switch (buttonName) {
    case 'no_longer_fit': return 'No Longer a Fit'
    case 'next_prospect': return 'Next Prospect'
    case 'cant_reach': return "Can't reach"
    case 'converted': return 'Converted'
    default: return buttonName
  }
}

/** Seconds as `mm:ss`. The minutes keep counting past an hour. */
export function formatTimerSeconds(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** A website as people say it: no scheme, no `www.`, no trailing slash. An empty one is a dash. */
export function formatWebsiteDisplay(url: string | null): string {
  if (!url || !url.trim()) return '—'
  let s = url.trim()
  s = s.replace(/^https?:\/\//i, '')
  s = s.replace(/^www\./i, '')
  s = s.replace(/\/+$/, '')
  return s || '—'
}

/** A website as a link: `https://` in front unless it names its own scheme. An empty one is `#`. */
export function getWebsiteHref(url: string | null): string {
  if (!url || !url.trim()) return '#'
  const s = url.trim()
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}
