import { describe, expect, it } from 'vitest'
import { calendarSourceFor, indexPayCalendars, jobPayCalendarWords } from './payCalendar'
import { PAY_CALENDAR_DAYS_AFTER_OFFERED, payTermsKindsWords, payTermsTitleAsOffered, showsHowTheyPay } from './payTermsInDaysOffer'

describe('terms in days are hidden until a contract needs them (punch list #341, call 4)', () => {
  it('the window does not offer them: no contract here pays a number of days after the bill', () => {
    expect(PAY_CALENDAR_DAYS_AFTER_OFFERED).toBe(false)
  })

  it('the choice of how they pay is drawn only for terms that are in days, or were while the fields were open', () => {
    expect(showsHowTheyPay({ days: false, hadDays: false })).toBe(false)
    expect(showsHowTheyPay({ days: true, hadDays: false })).toBe(true)
    // Switched to a set day: the choice stays, so the way back is one press.
    expect(showsHowTheyPay({ days: false, hadDays: true })).toBe(true)
    // The day a contract needs it, the switch brings the choice back for everyone.
    expect(showsHowTheyPay({ days: false, hadDays: false, offered: true })).toBe(true)
  })

  it('a line that introduces the calendar names the second kind only where it can be picked', () => {
    expect(payTermsKindsWords()).toBe('a set day of the month')
    expect(payTermsKindsWords(true)).toBe('a set day of the month, or a number of days after the bill')
  })

  it('takes the second kind off the hover line the edge-copied kernel wrote, and leaves every other line alone', () => {
    // A job with no calendar anywhere, read by someone who may set one: the press's hover words.
    const none = calendarSourceFor(indexPayCalendars([]), { payerId: 'p9', jobId: 'j9' })
    const title = jobPayCalendarWords(none, 'Larkfield Construction', true)!.title
    // The kernel still names both kinds. If its words ever change, this fails and the tail here is changed with them.
    expect(title).toBe('For a job whose contract says when its payer pays: a set day of the month, or a number of days after the bill')
    expect(payTermsTitleAsOffered(title)).toBe('For a job whose contract says when its payer pays: a set day of the month')
    expect(payTermsTitleAsOffered(title, true)).toBe(title)
    expect(payTermsTitleAsOffered('This job reads the usual guess: the bill date plus how long they take to pay.')).toBe('This job reads the usual guess: the bill date plus how long they take to pay.')
  })
})
