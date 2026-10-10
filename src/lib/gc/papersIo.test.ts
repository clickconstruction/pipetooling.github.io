import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { paperStep, type PaperStep } from './paperSend'
import { GC_MASTER_AGREEMENT_TITLE, notEmailedWords, paperSendable } from './papersIo'

const state = boardStateFromRows(clinicBoardRows())
const hillside = state.partners.find((p) => p.id === 'hillside')!
const step = (key: string): PaperStep => paperStep(state, hillside, key)!

describe('which papers the Documents tab sends', () => {
  it('sends the master agreement and the W-9 only once the Contract Book has their entry', () => {
    expect(paperSendable(step('msa'), { msa: null, w9: 'w' })).toBe(false)
    expect(paperSendable(step('msa'), { msa: 'm', w9: null })).toBe(true)
    expect(paperSendable(step('w9'), { msa: 'm', w9: null })).toBe(false)
    expect(paperSendable(step('w9'), null)).toBe(false)
    expect(paperSendable(step('w9'), { msa: null, w9: 'w' })).toBe(true)
  })

  it('asks for insurance with or without the Book, and sends no lien waiver yet', () => {
    expect(paperSendable(step('insurance'), null)).toBe(true)
    expect(paperSendable({ ...step('insurance'), paper: 'waiver', docKey: 'waivers-k1' }, { msa: 'm', w9: 'w' })).toBe(false)
  })

  it('names the master agreement the owner is writing', () => {
    expect(GC_MASTER_AGREEMENT_TITLE).toBe('Master Services Agreement')
  })

  it('says a send on record that did not go by email, and how to try again', () => {
    expect(notEmailedWords('No one at the company gets this kind of email.')).toBe('On record, the email did not go: No one at the company gets this kind of email. Send the reminder to try again.')
  })
})
