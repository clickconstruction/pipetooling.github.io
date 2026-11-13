// @vitest-environment jsdom
/**
 * Render smoke for the statement email header (v2.4262): the lines read like
 * an email, one menu serves To and Cc with the GC's people first, a typed
 * address gets a row, the reply choice shows the sender's copy on the Cc
 * line, and a scheduled send greys the two lines it decides. The state is
 * held here the way the dialog holds it — one To, the Cc as text, a user id.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { buildRecipientPeople } from '../../lib/gcStatementRecipients'
import { StatementRecipientHeader } from './StatementRecipientHeader'

const taunya = { id: 'u-taunya', name: 'Taunya', email: 'taunya@office.test', role: 'assistant' }
const malachi = { id: 'u-malachi', name: 'Malachi', email: 'malachi@office.test', role: 'master_technician' }
const roxi = { id: 'u-roxi', name: 'Roxi', email: 'roxi@office.test', role: 'controller' }
const users = [roxi, taunya, malachi]

function Harness({ scheduled = false, to = 'office@rlc.test' }: { scheduled?: boolean; to?: string }) {
  const [toEmail, setTo] = useState(to)
  const [ccText, setCc] = useState('')
  const [replyTo, setReplyTo] = useState(malachi.id)
  const [subject, setSubject] = useState('Click Plumbing open balances: Sep 30, 2026')
  const people = buildRecipientPeople({
    gcName: 'RLC- Dunmere Mallin',
    gcEmail: 'office@rlc.test',
    contacts: [{ name: 'Accounts payable', email: 'ap@rlc.test', gets_bill_copies: true }],
    users,
    meId: taunya.id,
    accountManId: malachi.id,
  })
  return (
    <>
      <StatementRecipientHeader
        people={people}
        users={users}
        me={taunya}
        accountManId={malachi.id}
        toEmail={toEmail}
        onToChange={setTo}
        ccText={ccText}
        onCcTextChange={setCc}
        replyToUserId={replyTo}
        onReplyToChange={setReplyTo}
        subject={subject}
        onSubjectChange={setSubject}
        scheduled={scheduled}
      />
      <output data-testid="state">{JSON.stringify({ toEmail, ccText, replyTo })}</output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as { toEmail: string; ccText: string; replyTo: string }
const open = (props: { scheduled?: boolean; to?: string } = {}) => renderSettled(<Harness {...props} />, { loaded: () => screen.findByTestId('rcp-readback') })

describe('StatementRecipientHeader', () => {
  it('reads like the email: From, the GC on To, the sender copied on Cc, the account man on Reply to', async () => {
    await open()
    expect(screen.getByText('Click Plumbing and Electrical', { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove RLC- Dunmere Mallin from To' })).toBeTruthy()
    expect(screen.getByText('copied, since replies go to Malachi')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reply to: Malachi' })).toBeTruthy()
    expect(screen.getByTestId('rcp-readback').textContent).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. You get a copy.')
  })

  it('the Cc menu leads with the GC’s people, holds whoever is on To, and ticks several', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    const menu = within(screen.getByRole('listbox', { name: 'Who is copied' }))
    const rows = menu.getAllByRole('option')
    expect(rows.map((r) => r.textContent)).toEqual([
      'RLC- Dunmere Mallinoffice@rlc.teston To',
      'Accounts payableap@rlc.testgets bill copies',
      'Malachimalachi@office.testaccount man',
      'Roxiroxi@office.test',
      '✓Taunya (you)taunya@office.testcopied by Reply to',
    ])
    expect(rows[0]!.hasAttribute('disabled')).toBe(true)
    expect(rows[4]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(menu.getByRole('option', { name: /Accounts payable/ }))
    fireEvent.click(menu.getByRole('option', { name: /^Roxi/ }))
    expect(state().ccText).toBe('ap@rlc.test, roxi@office.test')
    expect(screen.getByTestId('rcp-readback').textContent).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. Accounts payable, Roxi and you get a copy.')
    // The menu stays open for another tick; × on the line takes one off.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Roxi from Cc' }))
    expect(state().ccText).toBe('ap@rlc.test')
  })

  it('a whole address typed in the search is offered as Use…, and lands as its own row', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    const menu = within(screen.getByRole('listbox', { name: 'Who gets the statement' }))
    fireEvent.change(menu.getByRole('textbox', { name: 'Search a name or type an address' }), { target: { value: 'bookkeeper@rlc.test' } })
    expect(menu.queryByText('No one by that name. Type a whole address to use it.')).toBeNull()
    fireEvent.click(menu.getByRole('option', { name: /^Use bookkeeper@rlc\.test/ }))
    expect(state().toEmail).toBe('bookkeeper@rlc.test')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove bookkeeper@rlc.test from To' })).toBeTruthy()
    expect(screen.getByTestId('rcp-readback').textContent).toContain('Goes to bookkeeper@rlc.test.')
  })

  it('picking yourself on Reply to takes the copy off the Cc line', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Reply to: Malachi' }))
    const menu = within(screen.getByRole('listbox', { name: 'Who takes the reply' }))
    expect(menu.getAllByRole('option').map((r) => r.textContent)).toEqual(['Taunya (you)Their reply comes to you.', 'MalachiTheir reply goes to Malachi. You get a copy.account man', 'RoxiTheir reply goes to Roxi. You get a copy.'])
    fireEvent.click(menu.getByRole('option', { name: /Taunya \(you\)/ }))
    expect(state().replyTo).toBe('u-taunya')
    expect(screen.queryByText('copied, since replies go to Malachi')).toBeNull()
    expect(screen.getByTestId('rcp-readback').textContent).toBe('Goes to RLC- Dunmere Mallin. Their reply comes to you.')
  })

  it('without a To the line asks for one, and a scheduled send locks Reply to and the subject', async () => {
    await open({ scheduled: true, to: '' })
    expect(screen.getByRole('button', { name: '+ Pick who gets it' })).toBeTruthy()
    expect(screen.getByTestId('rcp-readback').textContent).toBe('Pick who gets the statement. It cannot send without a To.')
    expect((screen.getByRole('button', { name: 'Reply to: Taunya (you)' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A scheduled send replies to whoever scheduled it.')).toBeTruthy()
    expect((screen.getByLabelText('Subject') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Scheduled sends use the standard subject.')).toBeTruthy()
  })
})
