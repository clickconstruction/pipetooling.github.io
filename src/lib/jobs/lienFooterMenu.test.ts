import { describe, expect, it } from 'vitest'
import { lienFooter, lienSignWays, LIEN_FOOTER_AFFIDAVIT_LEADER_LINE } from './lienFooterMenu'
import { plainWordsFailures } from '../plainWords'

const M = 'Malachi Whites'

describe('lienFooter · one press per draft footer, the rare doors behind a menu (v2.7324)', () => {
  it('the office on a notice: Ask Malachi to approve ▸, one line on his phone, the okayed menu with his word and the pen, and the quiet link', () => {
    const f = lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, route: 'leader', pen: true })
    expect(f.primary).toEqual({ key: 'ask', label: 'Ask Malachi to approve ▸', line: 'One line on Malachi’s phone.' })
    expect(f.menus.map((m) => m.label)).toEqual(['He already okayed it ▾'])
    expect(f.menus[0]!.rows.map((r) => [r.key, r.label])).toEqual([
      ['word', 'Malachi said to send it…'],
      ['pen', 'He signed the paper…'],
    ])
    expect(f.links).toEqual(['by_hand'])
  })

  it('a live send rule puts it in the run; the hold rule parks it; a notice with no months has no pen row', () => {
    expect(lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, route: 'run', pen: true }).primary).toEqual({ key: 'run', label: 'Put it in the run ▸', line: 'Straight into the run.' })
    expect(lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, route: 'hold', pen: true }).primary).toEqual({ key: 'ask', label: 'Ask Malachi to approve ▸', line: 'Parks under the hold rule.' })
    expect(lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, pen: false }).menus[0]!.rows.map((r) => r.key)).toEqual(['word'])
  })

  it('the leader on his own notice: Sign and approve ▸ with his typed name, Sign another way ▾ offering the pad alone, no okayed menu for a master', () => {
    const f = lienFooter({ role: 'master_technician', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'type', otherScreen: false, codeReady: false }, pen: false })
    expect(f.primary).toEqual({ key: 'approve', label: 'Sign and approve ▸', line: 'Your typed name goes on it, and it goes in the run.' })
    expect(f.menus.map((m) => m.label)).toEqual(['Sign another way ▾'])
    expect(f.menus[0]!.rows.map((r) => [r.key, r.label])).toEqual([['sign:draw', 'Draw it']])
    // Drawing, the menu offers the typed name back, and the line says what reaches the paper.
    const drawing = lienFooter({ role: 'master_technician', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'draw', otherScreen: false, codeReady: false } })
    expect(drawing.primary!.line).toBe('Your signature on the line goes on it, and it goes in the run.')
    expect(drawing.menus[0]!.rows.map((r) => r.key)).toEqual(['sign:type'])
    // A master is office too, so he keeps the quiet link on a notice.
    expect(f.links).toEqual(['by_hand'])
  })

  it('on someone else’s screen the ways are his hand and his code when he has one; the typed name is never offered there', () => {
    expect(lienSignWays(true, true)).toEqual(['draw', 'code'])
    expect(lienSignWays(true, false)).toEqual(['draw'])
    expect(lienSignWays(false, true)).toEqual(['type', 'draw'])
    const code = lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'code', otherScreen: true, codeReady: true }, pen: true })
    expect(code.primary!.line).toBe('Malachi’s code signs it, and it goes in the run.')
    const sign = code.menus.find((m) => m.key === 'sign')!
    expect(sign.rows.map((r) => r.label)).toEqual(['Draw it'])
    const draw = lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'draw', otherScreen: true, codeReady: true } })
    expect(draw.primary!.line).toBe('Malachi signs on the line, and it goes in the run.')
    expect(draw.menus.find((m) => m.key === 'sign')!.rows.map((r) => r.label)).toEqual(['Use Malachi’s signing code'])
    // No code set: the pad is the only way, so there is nothing to switch to and no menu.
    const padOnly = lienFooter({ role: 'master_technician', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'draw', otherScreen: true, codeReady: false } })
    expect(padOnly.menus).toEqual([])
  })

  it('the dev is both: his own press first, the okayed menu and the sign menu in that order', () => {
    const f = lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'type', otherScreen: false, codeReady: false }, pen: true })
    expect(f.primary!.label).toBe('Sign and approve ▸')
    expect(f.menus.map((m) => m.key)).toEqual(['okayed', 'sign'])
  })

  it('an affidavit: the leader gets I approve it ▸ alone, with the notary line; the office gets the ask and a menu with his word only, never the pen; no links', () => {
    const leader = lienFooter({ role: 'master_technician', paper: 'affidavit', leaderName: M, blocked: false, pen: true })
    expect(leader.primary).toEqual({ key: 'approve', label: 'I approve it ▸', line: LIEN_FOOTER_AFFIDAVIT_LEADER_LINE })
    expect(leader.menus).toEqual([])
    expect(leader.links).toEqual([])
    const office = lienFooter({ role: 'assistant', paper: 'affidavit', leaderName: M, blocked: false, pen: true })
    expect(office.primary).toEqual({ key: 'ask', label: 'Ask Malachi to approve ▸', line: 'One line on Malachi’s phone.' })
    expect(office.menus.map((m) => m.label)).toEqual(['He already okayed it ▾'])
    expect(office.menus[0]!.rows.map((r) => [r.key, r.label])).toEqual([['word', 'Malachi said to file it…']])
    expect(office.links).toEqual([])
  })

  it('a retainage notice reads as a notice for the office; the leader’s okay puts it in the run with no sign menu', () => {
    const office = lienFooter({ role: 'controller', paper: 'retainage', leaderName: M, blocked: false })
    expect(office.primary!.label).toBe('Ask Malachi to approve ▸')
    expect(office.menus[0]!.rows.map((r) => r.label)).toEqual(['Malachi said to send it…'])
    const leader = lienFooter({ role: 'master_technician', paper: 'retainage', leaderName: M, blocked: false })
    expect(leader.primary).toEqual({ key: 'approve', label: 'Sign and approve ▸', line: 'Your okay puts it in the run.' })
    expect(leader.menus).toEqual([])
  })

  it('blocked: no press and no menu, the links stay for the host', () => {
    const f = lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: true, sign: { way: 'type', otherScreen: false, codeReady: false }, pen: true })
    expect(f.primary).toBeNull()
    expect(f.menus).toEqual([])
    expect(f.links).toEqual(['by_hand'])
  })

  it('with no master on the job the words say the leader', () => {
    const f = lienFooter({ role: 'assistant', paper: 'notice', leaderName: null, blocked: false })
    expect(f.primary!.label).toBe('Ask the leader to approve ▸')
    expect(f.primary!.line).toBe('One line on the leader’s phone.')
    expect(f.menus[0]!.rows[0]!.label).toBe('The leader said to send it…')
  })

  it('every line and every row title reads in plain words', () => {
    const cases = [
      lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, pen: true }),
      lienFooter({ role: 'assistant', paper: 'notice', leaderName: '', blocked: false, route: 'run', pen: true }),
      lienFooter({ role: 'assistant', paper: 'notice', leaderName: M, blocked: false, route: 'hold' }),
      lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'type', otherScreen: false, codeReady: false }, pen: true }),
      lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'draw', otherScreen: true, codeReady: true } }),
      lienFooter({ role: 'dev', paper: 'notice', leaderName: M, blocked: false, sign: { way: 'code', otherScreen: true, codeReady: true } }),
      lienFooter({ role: 'master_technician', paper: 'affidavit', leaderName: M, blocked: false }),
      lienFooter({ role: 'assistant', paper: 'affidavit', leaderName: M, blocked: false }),
      lienFooter({ role: 'master_technician', paper: 'retainage', leaderName: M, blocked: false }),
    ]
    for (const f of cases) {
      expect(plainWordsFailures(f.primary!.line), f.primary!.line).toEqual([])
      for (const m of f.menus) {
        expect(plainWordsFailures(m.aria), m.aria).toEqual([])
        for (const r of m.rows) expect(plainWordsFailures(r.title), r.title).toEqual([])
      }
    }
  })
})
