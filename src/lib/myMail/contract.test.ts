import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MY_MAIL_FUNCTION, MY_MAIL_GMAIL_LABEL, MY_MAIL_PAGE, MY_MAIL_REFUSAL_WORDS, myMailRefusal, type MyMailRefusalError } from './contract'

const ERRORS: readonly MyMailRefusalError[] = ['signIn', 'readOnly', 'officeOnly', 'off', 'imitated', 'offWorkspace', 'google', 'badRequest', 'notFound']

describe('the My email contract', () => {
  it('names the function, the page and the Gmail label both sides share', () => {
    expect(MY_MAIL_FUNCTION).toBe('gmail-mine')
    expect(MY_MAIL_PAGE).toBe(50)
    expect(MY_MAIL_GMAIL_LABEL).toBe('Tagged in ClickTooling')
  })

  it('has the office’s sentence for every refusal, each in plain words', () => {
    expect(Object.keys(MY_MAIL_REFUSAL_WORDS).sort()).toEqual([...ERRORS].sort())
    for (const error of ERRORS) {
      expect(MY_MAIL_REFUSAL_WORDS[error].trim()).not.toBe('')
      expect(plainWordsFailures(MY_MAIL_REFUSAL_WORDS[error])).toEqual([])
    }
    expect(MY_MAIL_REFUSAL_WORDS.offWorkspace).toBe('Google will not read this address for the app: it is not on the company Workspace.')
    expect(MY_MAIL_REFUSAL_WORDS.imitated).toBe('This session was opened with Imitate or View as. Sign in as yourself to read your own mail here.')
  })

  it('makes a refusal with the office’s sentence, or with better words when the function has them', () => {
    expect(myMailRefusal('off')).toEqual({ ok: false, error: 'off', words: MY_MAIL_REFUSAL_WORDS.off })
    expect(myMailRefusal('google', ' Google said: invalid_grant. ')).toEqual({ ok: false, error: 'google', words: 'Google said: invalid_grant.' })
    expect(myMailRefusal('google', '   ').words).toBe(MY_MAIL_REFUSAL_WORDS.google)
  })
})
