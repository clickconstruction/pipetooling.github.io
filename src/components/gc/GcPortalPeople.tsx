import { useState, type Dispatch } from 'react'
import { contactGets, everyMailGroupCovered, PORTAL_MAIL_GROUPS, type GcAction, type Partner, type PartnerPerson, type PortalKey, type PortalMailGroup } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: who at the company gets which of our emails, on its home (owner,
 * 2026-10-05). The main contact gets every kind until the company names others: quotes and plans
 * to the estimator, the job to the foreman, pay and papers to the bookkeeper. A tick that would
 * leave a kind with no one cannot be taken off.
 */

const RULE = '#d9d2c3'

const GROUP_WORDS: Record<PortalMailGroup, { name: PortalKey; help: PortalKey }> = {
  quotes: { name: 'grpQuotes', help: 'grpQuotesHelp' },
  job: { name: 'grpJob', help: 'grpJobHelp' },
  contracts: { name: 'grpContracts', help: 'grpContractsHelp' },
  pay: { name: 'grpPay', help: 'grpPayHelp' },
}

export function GcPortalPeople({ partner, dispatch }: { partner: Partner; dispatch: Dispatch<GcAction> }) {
  const { t } = usePortalLang()
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
    dispatch({ type: 'tradeSetGets', partnerId: partner.id, personId, gets: next })
  }

  const rows: { id: string | null; name: string; detail: string; gets: PortalMailGroup[]; person: PartnerPerson | null }[] = [
    { id: null, name: partner.contact, detail: t('pplMain'), gets: main, person: null },
    ...people.map((p) => ({ id: p.id, name: p.name, detail: [p.role, p.email].filter(Boolean).join(' · '), gets: p.gets, person: p })),
  ]

  return (
    <PortalBlock title={t('pplTitle')}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('pplHelp')}</div>
        {rows.map((row, i) => (
          <div key={row.id ?? 'main'} style={{ display: 'grid', gap: '0.3rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${RULE}` }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong>{row.name}</strong>
              <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{row.detail}</span>
              {row.person && (
                <Btn kind="quiet" onClick={() => dispatch({ type: 'tradeRemovePerson', partnerId: partner.id, personId: row.person?.id ?? '' })}>
                  {t('remove')}
                </Btn>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.3rem 0.8rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {PORTAL_MAIL_GROUPS.map((g) => {
                const on = row.gets.includes(g)
                return (
                  <label key={g} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={on} disabled={!canToggle(row.id, g, on)} onChange={() => toggle(row.id, row.gets, g)} />
                    {t(GROUP_WORDS[g].name)}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {adding ? (
          <AddPerson
            onAdd={(form) => {
              dispatch({ type: 'tradeAddPerson', partnerId: partner.id, ...form })
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: '0.45rem' }}>
            <Btn onClick={() => setAdding(true)}>{t('pplAdd')}</Btn>
          </div>
        )}
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', opacity: 0.75, display: 'grid', gap: '0.1rem' }}>
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

function AddPerson({ onAdd, onCancel }: { onAdd: (form: { name: string; email: string; role: string; gets: PortalMailGroup[] }) => void; onCancel: () => void }) {
  const { t } = usePortalLang()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [gets, setGets] = useState<PortalMailGroup[]>([])
  const ready = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email.trim()) && gets.length > 0
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  return (
    <div style={{ display: 'grid', gap: '0.45rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
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
          <label key={g} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <input type="checkbox" checked={gets.includes(g)} onChange={() => setGets((now) => (now.includes(g) ? now.filter((x) => x !== g) : [...now, g]))} />
            {t(GROUP_WORDS[g].name)}
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!ready} onClick={() => onAdd({ name: name.trim(), email: email.trim(), role: role.trim(), gets })}>
          {t('pplSave')}
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}
