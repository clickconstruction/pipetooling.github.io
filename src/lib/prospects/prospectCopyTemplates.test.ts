import { describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_KEYS,
  APP_SUBJECT_SETTINGS_KEYS,
  COPY_TEMPLATE_KEYS,
  COPY_TEMPLATE_LABELS,
  foldCopyTemplateRows,
  getBlankFieldsForMail,
  getBlankPlaceholderFields,
  resolveCopyText,
  substituteCopyPlaceholders,
  type CopyComment,
  type CopyProspect,
} from './prospectCopyTemplates'
import { formatDateTime } from './prospectFormat'

const FULL: CopyProspect = {
  company_name: 'ZZ Test Builders',
  contact_name: 'Pat Sample',
  phone_number: '555-0100',
  email: 'pat@example.test',
  last_contact: '2026-10-01T15:00:00.000Z',
}
const EMPTY: CopyProspect = { company_name: null, contact_name: null, phone_number: null, email: null, last_contact: null }
const ANSWERED: CopyComment[] = [
  { interaction_type: 'user_comment', created_at: '2026-10-03T15:00:00.000Z' },
  { interaction_type: 'answered', created_at: '2026-10-02T15:00:00.000Z' },
  { interaction_type: 'answered', created_at: '2026-09-01T15:00:00.000Z' },
]
const EVERY_NAME =
  '[User name] [user email] [user phone number] [company name] [prospect phone number] [prospect contact name] [prospect last contact] [prospect last successful contact]'

describe('the three templates', () => {
  it('each key has a label, a body setting and a subject setting, and no two settings share a key', () => {
    expect(COPY_TEMPLATE_KEYS).toEqual(['no_response_email', 'phone_followup_email', 'just_checking_in_email'])
    for (const key of COPY_TEMPLATE_KEYS) {
      expect(COPY_TEMPLATE_LABELS[key]).toBeTruthy()
      expect(APP_SUBJECT_SETTINGS_KEYS[key]).toBe(`${APP_SETTINGS_KEYS[key]}_subject`)
    }
    const all = [...Object.values(APP_SETTINGS_KEYS), ...Object.values(APP_SUBJECT_SETTINGS_KEYS)]
    expect(new Set(all).size).toBe(6)
  })
})

describe('getBlankPlaceholderFields', () => {
  it('finds nothing blank when every named field is filled', () => {
    expect(getBlankPlaceholderFields(EVERY_NAME, 'Sam', 'sam@example.test', FULL, '555-0199', 'no_response_email', ANSWERED)).toEqual([])
  })

  it('names each empty field the template asks for, in the template rule order', () => {
    expect(getBlankPlaceholderFields(EVERY_NAME, '', '', EMPTY, null, 'no_response_email', [])).toEqual([
      'User name',
      'User email',
      'User phone number',
      'Company name',
      'Prospect phone number',
      'Prospect contact name',
      'Prospect last contact',
      'Prospect last successful contact',
    ])
  })

  it('asks only for what the template names', () => {
    expect(getBlankPlaceholderFields('Hello [company name]', '', '', EMPTY, null, 'no_response_email', [])).toEqual(['Company name'])
    expect(getBlankPlaceholderFields('Hello there', '', '', EMPTY, null, 'no_response_email', [])).toEqual([])
  })

  it('takes the email as the user name when there is no name, and treats spaces as empty', () => {
    expect(getBlankPlaceholderFields('[User name]', '', 'sam@example.test', FULL, null, 'no_response_email', [])).toEqual([])
    expect(getBlankPlaceholderFields('[User name] [user phone number]', '   ', '   ', FULL, '   ', 'no_response_email', [])).toEqual(['User name', 'User phone number'])
    expect(getBlankPlaceholderFields('[company name]', 'Sam', 'sam@example.test', { ...FULL, company_name: '  ' }, null, 'no_response_email', [])).toEqual(['Company name'])
  })

  it('a last successful contact needs an answered call, not just any comment', () => {
    const noAnswer: CopyComment[] = [{ interaction_type: 'didnt_answer', created_at: '2026-10-03T15:00:00.000Z' }]
    expect(getBlankPlaceholderFields('[prospect last successful contact]', 'Sam', 'sam@example.test', FULL, null, 'no_response_email', noAnswer)).toEqual(['Prospect last successful contact'])
    expect(getBlankPlaceholderFields('[prospect last successful contact]', 'Sam', 'sam@example.test', FULL, null, 'no_response_email', ANSWERED)).toEqual([])
  })

  it('the underline is the contact name on the phone follow-up', () => {
    expect(getBlankPlaceholderFields('Hi _______', 'Sam', 'sam@example.test', { ...FULL, contact_name: null }, null, 'phone_followup_email', [])).toEqual(['Contact name'])
    expect(getBlankPlaceholderFields('Hi _______', 'Sam', 'sam@example.test', FULL, null, 'phone_followup_email', [])).toEqual([])
  })

  it('the underline is a phone or an email on the checking-in mail, and either one is enough', () => {
    expect(getBlankPlaceholderFields('Reach me at _______', 'Sam', 'sam@example.test', { ...FULL, phone_number: null, email: null }, null, 'just_checking_in_email', [])).toEqual(['Contact info'])
    expect(getBlankPlaceholderFields('Reach me at _______', 'Sam', 'sam@example.test', { ...FULL, phone_number: null }, null, 'just_checking_in_email', [])).toEqual([])
    expect(getBlankPlaceholderFields('Reach me at _______', 'Sam', 'sam@example.test', { ...FULL, email: null }, null, 'just_checking_in_email', [])).toEqual([])
  })

  it('the underline asks for nothing on the no-response mail', () => {
    expect(getBlankPlaceholderFields('Hi _______', 'Sam', 'sam@example.test', EMPTY, null, 'no_response_email', [])).toEqual([])
  })

  it('for a mail, the prospect needs an email whatever the template names', () => {
    expect(getBlankPlaceholderFields('Hello there', 'Sam', 'sam@example.test', { ...FULL, email: ' ' }, null, 'no_response_email', [], true)).toEqual(['Prospect email'])
    expect(getBlankPlaceholderFields('Hello there', 'Sam', 'sam@example.test', { ...FULL, email: ' ' }, null, 'no_response_email', [], false)).toEqual([])
  })
})

describe('getBlankFieldsForMail', () => {
  it('joins the body blanks and the subject blanks, each named once, the email first', () => {
    expect(getBlankFieldsForMail('[company name] [user phone number]', '[company name] [prospect contact name]', 'Sam', 'sam@example.test', EMPTY, null, 'no_response_email', [])).toEqual([
      'Prospect email',
      'User phone number',
      'Company name',
      'Prospect contact name',
    ])
  })

  it('is empty when the mail can go', () => {
    expect(getBlankFieldsForMail('[company name]', 'About [company name]', 'Sam', 'sam@example.test', FULL, null, 'no_response_email', [])).toEqual([])
  })
})

describe('substituteCopyPlaceholders', () => {
  it('fills every bracketed name, every time it appears', () => {
    const out = substituteCopyPlaceholders(`${EVERY_NAME} / [company name]`, { name: 'Sam', email: 'sam@example.test' }, FULL, '555-0199', 'no_response_email', ANSWERED)
    expect(out).toBe(
      `Sam sam@example.test 555-0199 ZZ Test Builders 555-0100 Pat Sample ${formatDateTime(FULL.last_contact)} ${formatDateTime('2026-10-02T15:00:00.000Z')} / ZZ Test Builders`,
    )
  })

  it('the last successful contact is the newest answered call, and a dash when there is none', () => {
    expect(substituteCopyPlaceholders('[prospect last successful contact]', { name: 'Sam', email: '' }, FULL, null, 'no_response_email', ANSWERED)).toBe(formatDateTime('2026-10-02T15:00:00.000Z'))
    expect(substituteCopyPlaceholders('[prospect last successful contact] [prospect last contact]', { name: 'Sam', email: '' }, EMPTY, null, 'no_response_email', [])).toBe('— —')
  })

  it('an empty field leaves an empty space, never the bracketed name', () => {
    expect(substituteCopyPlaceholders('a[company name]b[user phone number]c', { name: 'Sam', email: '' }, EMPTY, null, 'no_response_email', [])).toBe('abc')
  })

  it('the first underline is the contact name on the phone follow-up, and stays when there is no name', () => {
    expect(substituteCopyPlaceholders('Hi _______, and _______', { name: 'Sam', email: '' }, FULL, null, 'phone_followup_email', [])).toBe('Hi Pat Sample, and _______')
    expect(substituteCopyPlaceholders('Hi _______', { name: 'Sam', email: '' }, EMPTY, null, 'phone_followup_email', [])).toBe('Hi _______')
  })

  it('the first underline is the phone, else the email, on the checking-in mail', () => {
    expect(substituteCopyPlaceholders('At _______', { name: 'Sam', email: '' }, FULL, null, 'just_checking_in_email', [])).toBe('At 555-0100')
    expect(substituteCopyPlaceholders('At _______', { name: 'Sam', email: '' }, { ...FULL, phone_number: null }, null, 'just_checking_in_email', [])).toBe('At pat@example.test')
    expect(substituteCopyPlaceholders('At _______', { name: 'Sam', email: '' }, EMPTY, null, 'just_checking_in_email', [])).toBe('At _______')
  })

  it('the underline is left alone on the no-response mail', () => {
    expect(substituteCopyPlaceholders('Hi _______', { name: 'Sam', email: '' }, FULL, null, 'no_response_email', [])).toBe('Hi _______')
  })
})

describe('resolveCopyText', () => {
  it('a person own words win', () => {
    expect(resolveCopyText('mine', 'the default')).toBe('mine')
  })
  it('a missing or empty override falls back to the default', () => {
    expect(resolveCopyText(null, 'the default')).toBe('the default')
    expect(resolveCopyText(undefined, 'the default')).toBe('the default')
    expect(resolveCopyText('', 'the default')).toBe('the default')
  })
  it('with neither, the words are empty', () => {
    expect(resolveCopyText(null, undefined)).toBe('')
  })
  it('spaces alone are still an override', () => {
    expect(resolveCopyText(' ', 'the default')).toBe(' ')
  })
})

describe('foldCopyTemplateRows', () => {
  it('starts every template empty', () => {
    expect(foldCopyTemplateRows([], [])).toEqual({
      defaults: { no_response_email: '', phone_followup_email: '', just_checking_in_email: '' },
      subjectDefaults: { no_response_email: '', phone_followup_email: '', just_checking_in_email: '' },
      overrides: { no_response_email: null, phone_followup_email: null, just_checking_in_email: null },
      subjectOverrides: { no_response_email: null, phone_followup_email: null, just_checking_in_email: null },
    })
  })

  it('reads the defaults by their settings key, bodies and subjects apart', () => {
    const out = foldCopyTemplateRows(
      [
        { key: 'prospect_copy_no_response_email', value_text: 'body one' },
        { key: 'prospect_copy_no_response_email_subject', value_text: 'subject one' },
        { key: 'prospect_copy_phone_followup_email', value_text: 'body two' },
        { key: 'some_other_setting', value_text: 'not ours' },
      ],
      [],
    )
    expect(out.defaults).toEqual({ no_response_email: 'body one', phone_followup_email: 'body two', just_checking_in_email: '' })
    expect(out.subjectDefaults).toEqual({ no_response_email: 'subject one', phone_followup_email: '', just_checking_in_email: '' })
  })

  it('skips an empty or missing default body, keeps an empty default subject and skips a missing one', () => {
    const out = foldCopyTemplateRows(
      [
        { key: 'prospect_copy_no_response_email', value_text: '' },
        { key: 'prospect_copy_phone_followup_email', value_text: null },
        { key: 'prospect_copy_no_response_email_subject', value_text: '' },
        { key: 'prospect_copy_phone_followup_email_subject', value_text: null },
      ],
      [],
    )
    expect(out.defaults.no_response_email).toBe('')
    expect(out.defaults.phone_followup_email).toBe('')
    expect(out.subjectDefaults.no_response_email).toBe('')
    expect(out.subjectDefaults.phone_followup_email).toBe('')
  })

  it('reads a person overrides by template key, a missing subject as none, and ignores a key nobody knows', () => {
    const out = foldCopyTemplateRows(
      [],
      [
        { template_key: 'no_response_email', value_text: 'my body', subject_text: 'my subject' },
        { template_key: 'just_checking_in_email', value_text: '', subject_text: null },
        { template_key: 'phone_followup_email', value_text: 'no subject column' },
        { template_key: 'retired_template', value_text: 'old', subject_text: 'old' },
      ],
    )
    expect(out.overrides).toEqual({ no_response_email: 'my body', phone_followup_email: 'no subject column', just_checking_in_email: '' })
    expect(out.subjectOverrides).toEqual({ no_response_email: 'my subject', phone_followup_email: null, just_checking_in_email: null })
  })

  it('with resolveCopyText, an empty override shows the default', () => {
    const out = foldCopyTemplateRows(
      [{ key: 'prospect_copy_just_checking_in_email', value_text: 'the default' }],
      [{ template_key: 'just_checking_in_email', value_text: '', subject_text: null }],
    )
    expect(resolveCopyText(out.overrides.just_checking_in_email, out.defaults.just_checking_in_email)).toBe('the default')
  })
})
