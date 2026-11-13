/**
 * The owner is told (v2.7068): the Needs you line drawn from a person's own notices that someone else saved their mail
 * onto a job. Its place on the card is `dashboardNeedsYou.mailSaved.test.ts`. Made-up people only.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MAIL_SAVED_SHOWN_DAYS, mailSavedNeed, mailSavedShownSince } from './savedForYou'

// 2026-11-12 4:00 PM in the app's time zone (Central).
const NOW = '2026-11-12T22:00:00.000Z'
const notice = (id: string, sentAt: string, title = 'Nadia Reyes saved a conversation from your mail to JP1077 4 Elm Ct.') => ({ id, title, sentAt })

describe('mailSavedNeed: the line', () => {
  it('says the newest notice in its own words, when it was, and that the mailbox was not changed', () => {
    const need = mailSavedNeed([notice('n-1', '2026-11-12T21:05:00.000Z', 'Nadia Reyes saved 17 conversations from your mail to 7 jobs.')], NOW)
    expect(need).toEqual({ count: 1, title: 'Nadia Reyes saved 17 conversations from your mail to 7 jobs.', detail: 'It was today at 3:05 PM. Nothing changed in your Gmail.' })
    expect(plainWordsFailures(need!.detail)).toEqual([])
  })

  it('counts the week’s other notices, newest first, and leaves an older one to the record', () => {
    const need = mailSavedNeed(
      [
        notice('n-old', '2026-11-01T15:00:00.000Z', 'An older save.'),
        notice('n-1', '2026-11-10T15:00:00.000Z', 'An earlier save.'),
        notice('n-2', '2026-11-12T21:05:00.000Z'),
        notice('n-blank', '2026-11-12T21:10:00.000Z', '  '),
      ],
      NOW,
    )
    expect(need).toMatchObject({ count: 2, title: 'Nadia Reyes saved a conversation from your mail to JP1077 4 Elm Ct.' })
    expect(need!.detail).toBe(`It was today at 3:05 PM. 1 more notice in the last ${MAIL_SAVED_SHOWN_DAYS} days. Nothing changed in your Gmail.`)
    expect(mailSavedShownSince(NOW)).toBe('2026-11-05T22:00:00.000Z')
  })

  it('is no line when the week holds no notice', () => {
    expect(mailSavedNeed([], NOW)).toBeNull()
    expect(mailSavedNeed([notice('n-old', '2026-10-01T15:00:00.000Z')], NOW)).toBeNull()
  })
})
