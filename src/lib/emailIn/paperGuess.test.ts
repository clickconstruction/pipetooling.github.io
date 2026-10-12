import { describe, expect, it } from 'vitest'
import { paperGuess, PAPER_GUESS_WORDS } from './paperGuess'

const pdf = (name: string) => ({ name, mime: 'application/pdf' })

describe('paperGuess: a trade partner\'s W-9 or certificate, by its name', () => {
  it('reads a certificate of insurance in the ways people name it', () => {
    for (const name of ['Hillside COI 2027.pdf', 'ACORD 25.pdf', 'acord25_hillside.pdf', 'Certificate of Insurance - Hillside.pdf', 'Cert of Liability Insurance.pdf', 'insurance_cert.pdf', 'Hillside-coi.PDF']) {
      expect(paperGuess(pdf(name), 'trade')).toBe('coi')
    }
  })

  it('reads a W-9', () => {
    for (const name of ['W-9 Hillside.pdf', 'w9.pdf', 'Form W9 2026.pdf', 'hillside_w_9.pdf']) {
      expect(paperGuess(pdf(name), 'trade')).toBe('w9')
    }
    expect(paperGuess({ name: 'w9 scan.jpg', mime: 'image/jpeg' }, 'trade')).toBe('w9')
  })

  it('reads nothing from another kind of sender, another kind of file, or a name that reads as both or neither', () => {
    expect(paperGuess(pdf('Hillside COI 2027.pdf'), 'customer')).toBeNull()
    expect(paperGuess(pdf('Hillside COI 2027.pdf'), null)).toBeNull()
    expect(paperGuess({ name: 'COI.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, 'trade')).toBeNull()
    expect(paperGuess(pdf('W-9 and COI.pdf'), 'trade')).toBeNull()
    expect(paperGuess(pdf('Hillside-Boerne-sitework-rev1.pdf'), 'trade')).toBeNull()
    expect(paperGuess(pdf('Coil spec w90.pdf'), 'trade')).toBeNull()
  })

  it('says what the offer calls each paper', () => {
    expect(PAPER_GUESS_WORDS.coi.press).toBe('File this as their certificate')
    expect(PAPER_GUESS_WORDS.w9.paper).toBe('W-9')
  })
})
