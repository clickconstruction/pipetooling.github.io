/**
 * A sub's company on People → Contracts (punch list #403, step 6). Two pieces:
 *
 *   - `SubCompanyHeadRow`: the company's own row in the table, above its workers. Its name, the tag *Trade company*,
 *     and the line that names its workers, each name a value.
 *   - `SubCompanyLines`: on a sub's opened row, *Their company* and *What they are there*, each a value in place.
 *     The company box offers the trade companies we have, takes a new name, and has **Same as their name** for a
 *     sub whose business carries their own name. Emptying it takes them off.
 *
 * The rules and the words are `src/lib/people/subCompanies.ts`; the calls are `subCompaniesIo.ts`.
 */
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence } from '../valuesInPlace/ValuesInPlace'
import {
  SUB_COMPANY_WORDS,
  companyKeepPlan,
  companyKeepPreview,
  companyKeepRefusal,
  companyWorkersLine,
  titleKeepRefusal,
  type CompanyGroup,
  type CompanyPlace,
  type SubCompany,
} from '../../lib/people/subCompanies'
import { keepPersonCompany, keepPersonCompanyTitle } from '../../lib/people/subCompaniesIo'
import { COMPANY_PAPER_WORDS, companyPaperDetail, companyPaperStateWords, companyPressHeight, type CompanyPaperRow } from '../../lib/people/subCompanyPapers'
import { TAKE_BACK_LABEL, companyPaperCanBeTakenBack } from '../../lib/documents/paperTakeBack'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/** The state chip on a company's paper, in the tab's own colours. */
function PaperStateChip({ status }: { status: string }) {
  const look =
    status === 'signed'
      ? { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' }
      : status === 'sent'
        ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-200)', color: 'var(--text-700)' }
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap', ...look }}>{companyPaperStateWords(status)}</span>
  )
}

/** The mark on the paper a deep link landed on: the tint and outline a person's linked paper carries on People → Contracts. */
const PAPER_MARK = { background: 'var(--bg-blue-tint)', outline: '2px solid #2563eb', outlineOffset: -2 } as const

const pressLook = { padding: '0.35rem 0.7rem', boxSizing: 'border-box', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer' } as const

/**
 * The company's row: its name, its tag, its workers, and its own papers once with **Send for signature** and
 * **Enter from paper** (PR 2). With no `papers` handed in, the row names the company and its workers alone. With
 * `onTakeBack`, a paper that is not signed carries **Take back** on its own line (the walks of 2026-11-24).
 */
export function SubCompanyHeadRow({
  group,
  papers,
  markedPaperId,
  onSend,
  onEnter,
  onTakeBack,
  takingBackId,
}: {
  group: CompanyGroup
  papers?: readonly CompanyPaperRow[]
  /** The paper a deep link landed on (`/people?tab=contracts&doc=<id>`): marked as a person's linked paper is. */
  markedPaperId?: string | null
  onSend?: () => void
  onEnter?: () => void
  /** Whoever may delete a paper is handed this: the press on a paper that is out or was never sent. */
  onTakeBack?: (paper: CompanyPaperRow) => void
  /** The paper being taken back right now: its press says so, and every Take back waits. */
  takingBackId?: string | null
}) {
  /** A phone: the two presses stand a fingertip tall. A desk keeps its own height. */
  const pressHeight = { minHeight: companyPressHeight(useNarrowViewport640()) }
  return (
    <tr data-sub-company-row={group.company.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
      <td colSpan={2} style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{group.company.name}</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.1rem 0.45rem',
              borderRadius: 999,
              background: 'var(--bg-200)',
              color: 'var(--text-700)',
              whiteSpace: 'nowrap',
            }}
          >
            {SUB_COMPANY_WORDS.tag}
          </span>
        </div>
        <div style={{ marginTop: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          <ValueSentence text={companyWorkersLine(group.workers)} />
        </div>
        {papers ? (
          <div data-sub-company-papers style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {papers.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{COMPANY_PAPER_WORDS.none}</p>
            ) : (
              papers.map((p) => (
                <div
                  key={p.id}
                  data-sub-company-paper={p.id}
                  aria-current={p.id === markedPaperId ? 'true' : undefined}
                  style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', ...(p.id === markedPaperId ? PAPER_MARK : null) }}
                >
                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{p.document_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                      <ValueSentence text={companyPaperDetail(p)} />
                    </div>
                  </div>
                  <PaperStateChip status={p.status} />
                  {onTakeBack && companyPaperCanBeTakenBack(p.status) ? (
                    <button
                      type="button"
                      data-sub-company-paper-take-back={p.id}
                      disabled={takingBackId != null}
                      aria-busy={takingBackId === p.id || undefined}
                      onClick={() => onTakeBack(p)}
                      style={{
                        ...pressLook,
                        ...pressHeight,
                        border: '1px solid var(--border-strong)',
                        ...(takingBackId != null ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'wait' } : { background: 'var(--surface)', color: 'var(--text-red-700)' }),
                      }}
                    >
                      {takingBackId === p.id ? 'Taking it back…' : TAKE_BACK_LABEL}
                    </button>
                  ) : null}
                </div>
              ))
            )}
            {onSend || onEnter ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {onSend ? (
                  <button type="button" onClick={onSend} style={{ ...pressLook, ...pressHeight, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600 }}>
                    {COMPANY_PAPER_WORDS.send}
                  </button>
                ) : null}
                {onEnter ? (
                  <button type="button" onClick={onEnter} style={{ ...pressLook, ...pressHeight, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
                    {COMPANY_PAPER_WORDS.enter}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  )
}

/** Under a company's last worker: where else its papers are. */
export function SubCompanyFootRow({ companyId }: { companyId: string }) {
  return (
    <tr data-sub-company-foot={companyId} style={{ borderBottom: '1px solid var(--border)' }}>
      <td colSpan={2} style={{ padding: '0.4rem 0.75rem 0.6rem 1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--border-strong)' }}>
        {COMPANY_PAPER_WORDS.foot}
      </td>
    </tr>
  )
}

export type SubCompanyLinesProps = {
  /** The sub's roster row, or null when two roster people share the name. */
  personId: string | null
  personName: string
  /** Where they work now, or undefined for no company. */
  place: CompanyPlace | undefined
  companies: readonly SubCompany[]
  suggestions: readonly string[]
  /** Read the links again after a keep. */
  onKept: () => void | Promise<void>
}

/** *Their company* and *What they are there* on a sub's opened row. */
export function SubCompanyLines({ personId, personName, place, companies, suggestions, onKept }: SubCompanyLinesProps) {
  if (!personId) {
    return <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{SUB_COMPANY_WORDS.notLinkable}</p>
  }
  const current = place?.company.name ?? ''
  return (
    <div data-sub-company-lines onClick={(e) => e.stopPropagation()}>
      <ValueLines>
        <ValueLine label={SUB_COMPANY_WORDS.lineLabel}>
          <ChangeableValue
            text={current || SUB_COMPANY_WORDS.none}
            label={SUB_COMPANY_WORDS.label}
            type="text"
            value={current}
            canClear
            hint={SUB_COMPANY_WORDS.hint}
            suggestions={suggestions}
            fills={[{ label: SUB_COMPANY_WORDS.sameAsName, value: personName }]}
            check={(draft) => companyKeepRefusal(draft)}
            preview={(draft) => companyKeepPreview(draft, companies, current)}
            onKeep={async (typed) => {
              await keepPersonCompany(personId, companyKeepPlan(typed, companies), place?.title || null)
              await onKept()
            }}
          />
        </ValueLine>
        {place ? (
          <ValueLine label={SUB_COMPANY_WORDS.titleLineLabel}>
            <ChangeableValue
              text={place.title || SUB_COMPANY_WORDS.noTitle}
              label={SUB_COMPANY_WORDS.titleLabel}
              type="text"
              value={place.title}
              canClear
              hint={SUB_COMPANY_WORDS.titleHint}
              check={(draft) => titleKeepRefusal(draft)}
              onKeep={async (typed) => {
                await keepPersonCompanyTitle(personId, place.company.id, typed)
                await onKept()
              }}
            />
          </ValueLine>
        ) : null}
      </ValueLines>
    </div>
  )
}
