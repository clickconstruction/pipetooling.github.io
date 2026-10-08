import { useState } from 'react'
import { contactGets, everyMailGroupCovered, mailRecipients, PORTAL_MAIL_GROUPS } from '../../lib/gc/portal'
import type { PortalKey } from '../../lib/gc/portalI18n'
import type { Partner, PortalMailGroup } from '../../lib/gc/types'
import { HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Btn, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P2b-ii): who at the company gets which of our emails, from the design spike's
 * `GcPortalPeople.tsx`. The main contact gets every kind until the company names others. A tick that would leave a
 * kind with no one cannot be taken off, and the server holds the same rule (`gc_trade_set_gets`). With no press
 * (the portal read only), it lists who gets what.
 */

const GROUP_WORDS: Record<PortalMailGroup, { name: PortalKey; help: PortalKey }> = {
  quotes: { name: 'grpQuotes', help: 'grpQuotesHelp' },
  job: { name: 'grpJob', help: 'grpJobHelp' },
  contracts: { name: 'grpContracts', help: 'grpContractsHelp' },
  pay: { name: 'grpPay', help: 'grpPayHelp' },
}

const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const

export function GcTradePortalPeople({ partner }: { partner: Partner }) {
  const { t } = usePortalLang()
  const press = usePortalPress()
  if (!press) {
    return (
      <PortalBlock title={t('pplTitle')}>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem' }}>
          {PORTAL_MAIL_GROUPS.map((g) => (
            <div key={g}>
              <strong>{t(GROUP_WORDS[g].name)}</strong>{' '}
              <span style={{ color: MUTED }}>
                ·{' '}
                {mailRecipients(partner, g)
                  .map((r) => (r.main ? `${r.name} (${t('pplMain')})` : r.name))
                  .join(', ')}
              </span>
            </div>
          ))}
        </div>
      </PortalBlock>
    )
  }
  return <PeopleEditor partner={partner} />
}

function PeopleEditor({ partner }: { partner: Partner }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [adding, setAdding] = useState(false)
  const people = partner.people ?? []
  const main = contactGets(partner)

  // Whether one tick can change: taking it off may not leave its kind with no one.
  const canToggle = (personId: string | null, group: PortalMailGroup, on: boolean): boolean => {
    if (!on) return true
    const nextMain = personId === null ? main.filter((g) => g !== group) : main
    const nextPeople = people.map((p) => (p.id === personId ? { ...p, gets: p.gets.filter((g) => g !== group) } : p))
    if (personId !== null && nextPeople.find((p) => p.id === personId)?.gets.length === 0) return false
    return everyMailGroupCovered(nextMain, nextPeople)
  }
  const toggle = (personId: string | null, gets: PortalMailGroup[], group: PortalMailGroup) => {
    const next = gets.includes(group) ? gets.filter((g) => g !== group) : [...gets, group]
    void run('set_gets', { personId, gets: next })
  }

  const rows = [
    { id: null as string | null, name: partner.contact || partner.company, detail: t('pplMain'), gets: main, removable: false },
    ...people.map((p) => ({ id: p.id as string | null, name: p.name, detail: [p.role, p.email].filter(Boolean).join(' · '), gets: p.gets, removable: true })),
  ]

  return (
    <PortalBlock title={t('pplTitle')}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('pplHelp')}</div>
        {rows.map((row, i) => (
          <div key={row.id ?? 'main'} data-portal-person={row.id ?? 'main'} style={{ display: 'grid', gap: '0.3rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong>{row.name}</strong>
              <span style={{ fontSize: '0.8rem', color: MUTED }}>{row.detail}</span>
              {row.removable && row.id && (
                <Btn kind="quiet" disabled={busy} onClick={() => void run('remove_person', { personId: row.id })}>
                  {t('remove')}
                </Btn>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.3rem 0.8rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {PORTAL_MAIL_GROUPS.map((g) => {
                const on = row.gets.includes(g)
                return (
                  <label key={g} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', minHeight: 32 }}>
                    <input type="checkbox" checked={on} disabled={busy || !canToggle(row.id, g, on)} onChange={() => toggle(row.id, row.gets, g)} />
                    {t(GROUP_WORDS[g].name)}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {problem && <div style={PROBLEM}>{problem}</div>}
        {adding ? (
          <AddPerson onDone={() => setAdding(false)} />
        ) : (
          <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: '0.45rem' }}>
            <Btn onClick={() => setAdding(true)}>{t('pplAdd')}</Btn>
          </div>
        )}
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: MUTED, display: 'grid', gap: '0.1rem' }}>
          {PORTAL_MAIL_GROUPS.map((g) => (
            <li key={g}>
              <strong>{t(GROUP_WORDS[g].name)}</strong>: {t(GROUP_WORDS[g].help)}
            </li>
          ))}
        </ul>
      </div>
    </PortalBlock>
  )
}

function AddPerson({ onDone }: { onDone: () => void }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [gets, setGets] = useState<PortalMailGroup[]>([])
  const ready = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email.trim()) && gets.length > 0
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const add = async () => {
    if (await run('add_person', { name: name.trim(), email: email.trim(), role: role.trim(), gets })) onDone()
  }
  return (
    <div style={{ display: 'grid', gap: '0.45rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.5rem' }}>
        <label style={label}>
          <strong>{t('pplName')}</strong>
          <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
        </label>
        <label style={label}>
          <strong>{t('pplEmail')}</strong>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
        </label>
      </div>
      <label style={label}>
        <strong>{t('pplRole')}</strong>
        <input value={role} onChange={(e) => setRole(e.target.value)} style={field} />
      </label>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.3rem 0.8rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <legend style={{ padding: 0, marginBottom: '0.2rem' }}>
          <strong>{t('pplGets')}</strong>
        </legend>
        {PORTAL_MAIL_GROUPS.map((g) => (
          <label key={g} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', minHeight: 32 }}>
            <input type="checkbox" checked={gets.includes(g)} onChange={() => setGets((now) => (now.includes(g) ? now.filter((x) => x !== g) : [...now, g]))} />
            {t(GROUP_WORDS[g].name)}
          </label>
        ))}
      </fieldset>
      {problem && <div style={PROBLEM}>{problem}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!ready || busy} onClick={() => void add()}>
          {t('pplSave')}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={onDone}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}
