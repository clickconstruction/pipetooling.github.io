import { describe, expect, it } from 'vitest'
import { AWAY_PREVIEW_WORDS, awayLoginFirstName, awayPreviewNote, awayPreviewTitle, awayPreviewWhoWords } from './awayPreview'
import { awayOfficeFromSettings, buildAwayScreen, parseMyAwayNote, type AwayNoteRow } from './awayNote'

const OFFICE_SETTING = JSON.stringify({ address: '12925 FM 20, Kingsbury, TX 78638', lat: 29.65, lng: -97.81 })
const OFFICE_PHONE = '(512) 555-0142'

const ROW: AwayNoteRow = { user_id: 'u-corinne', words: 'Your spot on the crew is waiting.', countdown_ymd: '2029-11-08', show_where: true, show_call: true, alert_on_day: true, updated_at: '2026-11-09T03:30:00Z' }

describe('awayLoginFirstName', () => {
  it('takes the first word of the login name as the database function does, or none', () => {
    expect(awayLoginFirstName('Corinne Vela')).toBe('Corinne')
    expect(awayLoginFirstName('  Corinne  Vela ')).toBe('Corinne')
    expect(awayLoginFirstName('Corinne')).toBe('Corinne')
    expect(awayLoginFirstName('   ')).toBeNull()
    expect(awayLoginFirstName(null)).toBeNull()
  })
})

describe('awayPreviewTitle and awayPreviewWhoWords', () => {
  it('names whose screen it is and that the viewer is still themself', () => {
    expect(awayPreviewTitle('Corinne Vela')).toBe("Preview of Corinne Vela's sign-in screen")
    expect(awayPreviewTitle('  ')).toBe('Preview of their sign-in screen')
    expect(awayPreviewWhoWords('Corinne Vela', true)).toBe('Corinne Vela meets this screen at sign-in. You are still signed in as yourself.')
  })

  it('says nothing opens yet when no login stands behind the account', () => {
    expect(awayPreviewWhoWords('Corinne Vela', false)).toBe('Corinne Vela has no login, so nothing opens yet. A login would open to this screen. You are still signed in as yourself.')
  })

  it('the press names the act', () => {
    expect(AWAY_PREVIEW_WORDS.press).toBe('See what they see')
    expect(AWAY_PREVIEW_WORDS.close).toBe('Close the preview')
  })
})

describe('awayPreviewNote', () => {
  const office = awayOfficeFromSettings(OFFICE_SETTING, OFFICE_PHONE)

  it("builds what my_away_note() answers the person, field for field, from the office's own reads", () => {
    // The function's answer for the same person: first word of users.name, the note row, the end date, the day
    // the note was updated in the app's zone (03:30 UTC on the 9th is still the 8th in Chicago), the two settings.
    const theirs = parseMyAwayNote({
      first_name: 'Corinne',
      words: ROW.words,
      countdown_ymd: '2029-11-08',
      show_where: true,
      show_call: true,
      left_ymd: '2026-11-03',
      updated_ymd: '2026-11-08',
      office_address: OFFICE_SETTING,
      office_phone: OFFICE_PHONE,
    })
    const preview = awayPreviewNote({ loginName: 'Corinne Vela', leftYmd: '2026-11-03', row: ROW, office })
    expect(preview).toEqual(theirs)
  })

  it('draws the same screen as their own read does', () => {
    const preview = awayPreviewNote({ loginName: 'Corinne Vela', leftYmd: '2026-11-03', row: ROW, office })!
    const now = new Date(2026, 10, 10, 9, 0)
    const screen = buildAwayScreen({ draft: preview.draft, firstName: preview.firstName, now, leftYmd: preview.leftYmd, updatedYmd: preview.updatedYmd, todayYmd: '2026-11-10', office: preview.office })
    expect(screen.hello).toBe('See you soon, Corinne.')
    expect(screen.letter).toEqual({ words: 'Your spot on the crew is waiting.', from: 'The team · updated Nov 8, 2026' })
    expect(screen.countdown?.backOn).toBe('Back on Thursday, Nov 8, 2029')
    expect(screen.where?.words).toBe("We're in Kingsbury, TX")
    expect(screen.call?.href).toBe('tel:+15125550142')
  })

  it("never carries the office's alert switch, which the person is not sent", () => {
    expect(awayPreviewNote({ loginName: 'Corinne Vela', leftYmd: '2026-11-03', row: ROW, office })?.draft.alertOnDay).toBe(false)
  })

  it('greets nobody by name when the login has no name, whatever the roster calls them', () => {
    expect(awayPreviewNote({ loginName: null, leftYmd: '2026-11-03', row: ROW, office })?.firstName).toBeNull()
  })

  it('answers null when the note is gone, which the page draws as its resting words', () => {
    expect(awayPreviewNote({ loginName: 'Corinne Vela', leftYmd: '2026-11-03', row: null, office })).toBeNull()
  })

  it('reads a note with no day back and the switches off', () => {
    const quiet = awayPreviewNote({ loginName: 'Corinne Vela', leftYmd: null, row: { ...ROW, countdown_ymd: null, show_where: false, show_call: false, updated_at: null }, office })
    expect(quiet).toMatchObject({ draft: { countdownYmd: null, showWhere: false, showCall: false }, leftYmd: null, updatedYmd: null })
  })
})
