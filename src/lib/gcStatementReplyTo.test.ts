import { describe, expect, it } from 'vitest'
import { canTakeStatementReplies, defaultReplyToUserId, describeReplyToOutcome, resolveStatementReplyTo } from './gcStatementReplyTo'

const taunya = { id: 'u-taunya', name: 'Taunya', email: 'taunya@office.test', role: 'assistant' }
const malachi = { id: 'u-malachi', name: 'Malachi', email: 'Malachi@office.test', role: 'master_technician' }

describe('resolveStatementReplyTo', () => {
  it('sends replies to the sender when nobody is named', () => {
    expect(resolveStatementReplyTo({ sender: taunya, toEmail: 'ap@knight.test', ccEmails: ['boss@office.test'] })).toEqual({
      ok: true,
      replyTo: 'taunya@office.test',
      replyToName: 'Taunya',
      cc: ['boss@office.test'],
      onBehalf: false,
    })
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: taunya, toEmail: 'ap@knight.test', ccEmails: [] })).toMatchObject({ replyTo: 'taunya@office.test', cc: [], onBehalf: false })
  })

  it('sends replies to the account man and copies the sender', () => {
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: malachi, toEmail: 'ap@knight.test', ccEmails: [] })).toEqual({
      ok: true,
      replyTo: 'Malachi@office.test',
      replyToName: 'Malachi',
      cc: ['taunya@office.test'],
      onBehalf: true,
    })
  })

  it('never copies the sender twice, and never past the cap', () => {
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: malachi, toEmail: 'ap@knight.test', ccEmails: ['Taunya@Office.test'] })).toMatchObject({ cc: ['Taunya@Office.test'] })
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: malachi, toEmail: 'taunya@office.test', ccEmails: [] })).toMatchObject({ cc: [] })
    const full = Array.from({ length: 10 }, (_, i) => `cc${i}@x.test`)
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: malachi, toEmail: 'ap@knight.test', ccEmails: full })).toMatchObject({ cc: full })
  })

  it('refuses a person who cannot take replies, by name', () => {
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: { ...malachi, email: '' }, toEmail: 'ap@knight.test', ccEmails: [] })).toEqual({ ok: false, error: 'Malachi has no email on file to take replies.' })
    expect(resolveStatementReplyTo({ sender: taunya, replyToPerson: { ...malachi, role: 'subcontractor' }, toEmail: 'ap@knight.test', ccEmails: [] }).ok).toBe(false)
    expect(resolveStatementReplyTo({ sender: taunya, replyToMissing: true, toEmail: 'ap@knight.test', ccEmails: [] })).toEqual({ ok: false, error: 'The person named to take replies was not found.' })
  })

  it('a sender with no address still sends, with no reply-to', () => {
    expect(resolveStatementReplyTo({ sender: { ...taunya, email: null }, toEmail: 'ap@knight.test', ccEmails: [] })).toMatchObject({ ok: true, replyTo: null })
  })
})

describe('defaultReplyToUserId', () => {
  it('is the account man when he can take replies, else the sender', () => {
    expect(defaultReplyToUserId('u-taunya', malachi)).toBe('u-malachi')
    expect(defaultReplyToUserId('u-taunya', { ...malachi, email: null })).toBe('u-taunya')
    expect(defaultReplyToUserId('u-taunya', null)).toBe('u-taunya')
    expect(defaultReplyToUserId('u-malachi', malachi)).toBe('u-malachi')
  })

  it('office roles with an address can take replies', () => {
    expect(canTakeStatementReplies(malachi)).toBe(true)
    expect(canTakeStatementReplies({ ...malachi, role: 'helpers' })).toBe(false)
    expect(canTakeStatementReplies(undefined)).toBe(false)
  })
})

describe('describeReplyToOutcome', () => {
  it('says where replies went — and says so when the server has not caught up', () => {
    expect(describeReplyToOutcome({ id: 'u-malachi', name: 'Malachi' }, 'u-taunya', 'malachi@office.test')).toBe(' Replies go to Malachi; you are copied.')
    expect(describeReplyToOutcome({ id: 'u-malachi', name: 'Malachi' }, 'u-taunya', undefined)).toBe(' Replies will come to you — sending on Malachi’s behalf is not switched on yet.')
    expect(describeReplyToOutcome({ id: 'u-taunya', name: 'Taunya' }, 'u-taunya', 'taunya@office.test')).toBe('')
    expect(describeReplyToOutcome(null, 'u-taunya', undefined)).toBe('')
  })
})
