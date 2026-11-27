import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { paperPressFloor } from '../../lib/documents/agreementsPhonePress'
import { useToastContext } from '../../contexts/ToastContext'
import { SEND_A_PAPER_LABEL, papersMatching, sendablePapers } from '../../lib/documents/agreementsSend'
import { readAgreementsSendBook, type AgreementsSendBook } from '../../lib/documents/agreementsSendIo'
import { quickSendNoContentWords, quickSendPickPlan, quickSendPlan, quickSendPlanWrites, quickSendReusablePersonRow, quickSendRosterSplit, resolveQuickSendSource, type QuickSendPlan } from '../../lib/contractsQuickSend'
import { materializeQuickSendRow, readPersonSendFactsByName, readSenderFacts, writePaperPrintsAddress, type PersonPaperSendFacts } from '../../lib/contracts/personPaperSendIo'
import { readSignerPageShowsSite } from '../../lib/contracts/sitePrintReadyIo'
import { partyNameToKeep, sendWindowPartyOfPick, type PartyPick, type PartyRecordTable, type PartySendInput, type SendWindowParty } from '../../lib/documents/paperPartyPick'
import { findPartyContacts, keepSignerWithBusiness, makeContactForAddress, readCopiesOut, readPartyContact } from '../../lib/documents/paperPartyIo'
import { SECOND_COPY_HINT, SECOND_COPY_LABEL, SEND_AGAIN_HINT, copiesOutLead, copiesOutTitle, copyOutSentence, partyPapersOut, sendAgainLabel, type PartyCopyOut } from '../../lib/documents/partyPaperOut'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { PaperPartyPicker } from './PaperPartyPicker'
import { PaperSitePicker } from './PaperSitePicker'
import { PaperSiteLine } from './PaperSiteLine'
import { paperSiteColumns, paperSiteSentence, rowsForSite, signedForSiteWords, sitePrintBox, sitePrintsAtSend, type PaperSite, type SitePrintReady } from '../../lib/addresses/paperSite'
import type { PlaceAnswer } from '../../lib/addresses/lookAlikes'
import { readAnswers } from '../../hooks/useAddressLookAlikes'
import { partyPaperName } from '../../lib/contracts/paperParty'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * Documents → Agreements, **Send a paper** (punch list #376, the second train): one press that picks a paper from the
 * Contract Book, then who it is with, and opens the Send for signature window on the pick. For a person on the roster
 * it is People → Contracts' quick send on this page: the same plan (`quickSendPickPlan`), the same window and the same
 * sender. Since punch list #403 the second window is **Who is it with?**: it also finds a customer, a supply house and
 * the people on file there, and takes someone on no list. An outside party's paper is filed under the party's contact.
 * Nothing is written until **Send email** is pressed, so closing any step leaves nothing behind. Once the email goes,
 * `onSent` lets the list read again and the new line shows on it.
 *
 * Since punch list #439 (piece 3) an outside party's paper can name a site. The email window says *This paper names no
 * site.* with **Name a site…**, which opens **Which site is it for?** over it. A company holds a paper once for each
 * site and once for no site: a copy out for the picked site is offered again, a signature for it stops the send, and
 * the site is written with the row at Send email.
 *
 * Under a named site sits the box **Print the site's address on the paper** (part 3e), off until ticked. Ticked, the
 * signer reads the address above the paper before signing, and the words under the box say that line. The box is dead
 * until the signer's page can show an address (`readSignerPageShowsSite`), so it never promises what no signer reads.
 * A new site unticks it.
 *
 * `startOn` lets another door start at the person step for a paper it names: the Contract library's Send to…. And
 * `onOpenLibrary` is where the paper step sends someone who wants to write or change a paper.
 */

const ContractSendWindow = lazy(() => import('../contracts/ContractSendWindow').then((m) => ({ default: m.ContractSendWindow })))

const primary: CSSProperties = { padding: '0.5rem 0.9rem', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: 'white', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const primaryBusy: CSSProperties = { ...primary, background: DEAD_PRESS_FILL, border: '1px solid var(--border-strong)', color: DEAD_PRESS_TEXT, cursor: 'wait' }
const paperRow: CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', color: 'var(--text-strong)' }
const paperFrom: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }
const closeX: CSSProperties = { minWidth: 44, minHeight: 44, margin: '-0.6rem -0.6rem 0 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }
const choice: CSSProperties = { display: 'block', width: '100%', minHeight: 44, padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', boxSizing: 'border-box' }
const choiceHint: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400, marginTop: '0.15rem' }

type Step =
  | { at: 'paper' }
  | { at: 'person'; documentName: string }
  | { at: 'send'; documentName: string; docId: string | null; plan: QuickSendPlan; again: boolean; facts: PersonPaperSendFacts }
  /**
   * An outside party's paper: nothing is decided until Send email, when its contact is found and its row written.
   * `again` is a copy that is already out, sent to the same person again. `second` is a second copy for someone else
   * at a company that already has the paper out: it never lands on the first person's copy. `printsAddress` is the box
   * under a named site, as the office left it. `kept` is set once Send email wrote the row: a send that failed after
   * it is pressed again on that row, so the site and the box stand as written.
   */
  | { at: 'send-party'; documentName: string; pick: Exclude<PartyPick, { kind: 'roster' }>; party: SendWindowParty; facts: PersonPaperSendFacts; again?: PartyCopyOut; second?: boolean; site?: PaperSite | null; printsAddress?: boolean; kept?: boolean }
  /** The company already has this paper out: the office says whether it goes to the same person again or to another. */
  | { at: 'party-out'; documentName: string; pick: Extract<PartyPick, { kind: 'record' }>; party: SendWindowParty; sender: PersonPaperSendFacts['sender']; copies: PartyCopyOut[]; site?: PaperSite | null }

export function AgreementsSendPaper({
  onSent,
  startOn = null,
  onOpenLibrary,
}: {
  onSent: () => void
  /** A paper another door picked. A new object starts the person step on it. */
  startOn?: { documentName: string } | null
  /** Opens the Contract library in place. */
  onOpenLibrary: () => void
}) {
  const { user } = useAuth()
  /** A phone: Send a paper stands a fingertip tall. A desk adds nothing. */
  const pressFloor = paperPressFloor(useNarrowViewport640())
  const { showToast } = useToastContext()
  const [data, setData] = useState<AgreementsSendBook | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState<null | 'open' | 'pick'>(null)
  const [typed, setTyped] = useState('')
  /** **Which site is it for?** is open over the email window. */
  const [sitePicking, setSitePicking] = useState(false)
  const [siteBusy, setSiteBusy] = useState(false)
  /** The answers kept in Addresses that look alike, read when a site is first named: two spellings of one place are one site. */
  const placeAnswers = useRef<PlaceAnswer[]>([])
  /** Whether the signer's page can show an address, asked each time a site with one is named. */
  const [printReady, setPrintReady] = useState<SitePrintReady>('checking')

  /** The person a party's send kept with their company, so a second press of a send that failed keeps nobody twice. */
  const keptSigner = useRef<{ pick: PartyPick; name: string; email: string; record: { table: PartyRecordTable; id: string } } | null>(null)

  const papers = useMemo(() => sendablePapers(data?.book ?? []), [data])
  /**
   * The roster as the person step lists it: the people who have not had the paper and the ones it is out with, as
   * People's picker lists them. Someone who signed it is done, and is not offered a second copy.
   */
  const pickDocumentName = step?.at === 'person' ? step.documentName : null
  const rosterToPick = useMemo(() => {
    if (!data || pickDocumentName == null) return []
    const split = quickSendRosterSplit({ documentName: pickDocumentName, rosterNames: data.rosterNames, personDocuments: data.personDocuments })
    const offered = new Set([...split.needsIt, ...split.resend.map((r) => r.personName)])
    return data.roster.filter((p) => offered.has(p.name))
  }, [data, pickDocumentName])
  const shown = useMemo(() => papersMatching(papers, typed), [papers, typed])

  // The Book, the papers people hold and the roster are read on the press, so the pick is made on what is true now.
  const open = async () => {
    if (busy) return
    setBusy('open')
    try {
      setData(await readAgreementsSendBook())
      setTyped('')
      setStep({ at: 'paper' })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The Contract Book did not read.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  // A person was picked for the paper: decide the plan, read their address, and open the Send window. Nothing is written.
  const pickPerson = async (documentName: string, personName: string) => {
    if (busy || !data) return
    const { existing, plan } = quickSendPickPlan({ documentName, personName, templateDocuments: data.book, personDocuments: data.personDocuments })
    if (plan.kind === 'no-content') {
      showToast(quickSendNoContentWords(documentName), 'error')
      return
    }
    setBusy('pick')
    try {
      const facts = await readPersonSendFactsByName(personName, documentName, user?.id)
      setStep({ at: 'send', documentName, docId: plan.kind === 'insert' ? null : plan.docId, plan, again: existing?.status === 'sent', facts })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The person’s address did not read.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  // A company or someone on no list was picked: the email window opens on who signs. Nothing is read of the party yet
  // and nothing is written: its contact is found at Send email.
  const pickParty = async (documentName: string, pick: Exclude<PartyPick, { kind: 'roster' }>) => {
    if (busy || !data) return
    setBusy('pick')
    try {
      const sender = await readSenderFacts(user?.id)
      const signer = pick.kind === 'record' ? pick.signer : null
      // A company that already has this paper out: say who has it, and ask before anything is written (the owner's
      // third decision of 2026-11-22). The look is a read alone, and a record with no contact has no paper. A company
      // is looked at on every contact that points at it: its own, and each person named under it by Add to a list.
      if (pick.kind === 'record') {
        const contactIds = await findPartyContacts(pick.record)
        // A paper that names a site is that site's paper: only the copies that name none count here.
        const copies = await readCopiesOut(partyPapersOut(rowsForSite(data.personDocuments, null), contactIds, documentName).map((d) => d.id))
        if (copies.length > 0) {
          setStep({ at: 'party-out', documentName, pick, party: sendWindowPartyOfPick(pick), sender, copies })
          return
        }
      }
      setStep({
        at: 'send-party',
        documentName,
        pick,
        party: sendWindowPartyOfPick(pick),
        facts: { target: { personName: signer?.name ?? '', documentName }, initialEmail: signer?.email ?? '', signerName: signer?.name ?? '', signerTitle: signer?.title ?? '', personId: null, sender },
      })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Your own address did not read.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  /**
   * What a party's first send writes, right before the email goes: a person kept with the company, the party's contact,
   * and the paper's row under the party's stored name. A party that already has this paper out gets the same copy again,
   * unless the office asked for a second copy for someone else there.
   */
  const preparePartyPaper = async (documentName: string, pick: Exclude<PartyPick, { kind: 'roster' }>, party: SendWindowParty, input: PartySendInput, second = false, site: PaperSite | null = null, printsAddress = false): Promise<string> => {
    if (!data) throw new Error('The Contract Book did not read.')
    let contactId: string
    if (pick.kind === 'unlisted') {
      contactId = await makeContactForAddress(input.signerEmail, input.signerName)
    } else {
      let record = pick.record
      if (input.keep && !pick.signer) {
        // A press that failed after the person was kept tries again on the same person, never a second one.
        const again = keptSigner.current
        if (again && again.pick === pick && again.name === input.signerName.trim() && again.email === input.signerEmail.trim()) record = again.record
        else {
          record = await keepSignerWithBusiness(pick.business, { name: input.signerName, email: input.signerEmail }, user?.id)
          keptSigner.current = { pick, name: input.signerName.trim(), email: input.signerEmail.trim(), record }
        }
      }
      contactId = await readPartyContact(record)
    }
    const storedName = partyPaperName(contactId)
    // A second copy is a row of its own, written from the Book: the copy that is out is never reused for it.
    // The copy to reuse is one for the same site: a paper for another site, or for none, is left as it is.
    const source = resolveQuickSendSource({ documentName, templateDocuments: data.book, personDocuments: data.personDocuments })
    const existing = second ? null : quickSendReusablePersonRow({ documentName, personName: storedName, personDocuments: rowsForSite(data.personDocuments, site, placeAnswers.current) })
    const plan = quickSendPlan({ existing, source })
    if (plan.kind === 'no-content') throw new Error(quickSendNoContentWords(documentName))
    const docId = quickSendPlanWrites(plan)
      ? await materializeQuickSendRow({ personName: storedName, documentName, plan, party: { contactId, name: partyNameToKeep(party, input.typedCompany, input.signerName) }, ...(site ? { site: paperSiteColumns(site, printsAddress) } : {}) })
      : plan.docId
    // A copy that was there already keeps its own site. It takes the box as the office left it now, so the signer
    // reads what the window said they would.
    if (existing && site?.kind === 'address' && (existing.site_prints_address === true) !== printsAddress) await writePaperPrintsAddress(existing.id, printsAddress)
    return docId
  }

  /**
   * A site was picked for the paper in the email window, or taken off. For a company on file the papers it holds for
   * that site are looked at first: a signature for the site stops here with the reason, and a copy that is out is
   * offered again, as a copy with no site is. Nothing is written.
   */
  const nameSite = async (site: PaperSite | null) => {
    if (step?.at !== 'send-party' || step.again || !data || siteBusy) return
    if (!site) {
      setStep({ ...step, site: null, printsAddress: false })
      setSitePicking(false)
      return
    }
    setSiteBusy(true)
    try {
      // Two spellings of one place are one site. Without the answers, the same spelling still is.
      placeAnswers.current = await readAnswers().catch(() => [])
      if (step.pick.kind === 'record') {
        const contactIds = await findPartyContacts(step.pick.record)
        const stored = new Set(contactIds.map((id) => partyPaperName(id)))
        const held = rowsForSite(data.personDocuments, site, placeAnswers.current).filter((d) => stored.has(d.person_name) && d.document_name === step.documentName)
        const signed = held.find((d) => d.status === 'signed')
        if (signed) {
          const day = signed.signed_at ? formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(signed.signed_at)) : ''
          showToast(signedForSiteWords(step.party.name, step.documentName, day), 'error')
          return
        }
        const copies = step.second ? [] : await readCopiesOut(partyPapersOut(held, contactIds, step.documentName).map((d) => d.id))
        if (copies.length > 0) {
          setSitePicking(false)
          setStep({ at: 'party-out', documentName: step.documentName, pick: step.pick, party: step.party, sender: step.facts.sender, copies, site })
          return
        }
      }
      // A new site starts with the box unticked: the tick was for the address before it.
      setStep({ ...step, site, printsAddress: false })
      setSitePicking(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The papers for that site did not read.'), 'error')
    } finally {
      setSiteBusy(false)
    }
  }

  const close = () => {
    setSitePicking(false)
    setStep(null)
  }

  // A site with an address was named for a new paper: ask whether the signer's page can show an address. Until the
  // answer is yes the box stays dead and unticked, so a tick never promises a line no signer reads.
  const printSiteKey = step?.at === 'send-party' && !step.again && step.site?.kind === 'address' ? step.site.key : null
  useEffect(() => {
    if (printSiteKey == null) return
    let live = true
    setPrintReady('checking')
    readSignerPageShowsSite().then(
      (yes) => {
        if (live) setPrintReady(yes ? 'yes' : 'no')
      },
      () => {
        if (live) setPrintReady('unread')
      },
    )
    return () => {
      live = false
    }
  }, [printSiteKey])
  const printBox = step?.at === 'send-party' && !step.again ? sitePrintBox(step.site ?? null, step.printsAddress === true, printReady) : null

  // Escape closes the three windows this press draws itself: the paper list, Who is it with? and the one that says a
  // paper is already out. Nothing is written in any of them. The Send window keeps its own keys: it holds an address
  // and a message someone typed.
  const stepAt = step?.at ?? null
  const escapeCloses = stepAt === 'paper' || stepAt === 'person' || stepAt === 'party-out' || sitePicking
  const isTopmost = useModalStackEntry(escapeCloses)
  useEffect(() => {
    if (!escapeCloses) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || busy != null || !isTopmost()) return
      e.preventDefault()
      // Over the email window, Escape closes the site's window alone: the address and the message typed there stay.
      if (sitePicking) setSitePicking(false)
      else setStep(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escapeCloses, busy, isTopmost, sitePicking])

  // Another door named the paper: read what the pick needs, then ask for the person.
  useEffect(() => {
    if (!startOn) return
    let live = true
    setBusy('open')
    readAgreementsSendBook().then(
      (read) => {
        if (!live) return
        setData(read)
        setStep({ at: 'person', documentName: startOn.documentName })
        setBusy(null)
      },
      (e: unknown) => {
        if (!live) return
        showToast(formatErrorMessage(e, 'The Contract Book did not read.'), 'error')
        setBusy(null)
      },
    )
    return () => {
      live = false
    }
  }, [startOn, showToast])

  const toLibrary = () => {
    setStep(null)
    onOpenLibrary()
  }

  return (
    <>
      <button type="button" style={{ ...(busy === 'open' ? primaryBusy : primary), ...pressFloor }} disabled={busy != null} onClick={() => void open()}>
        {busy === 'open' ? 'Opening…' : SEND_A_PAPER_LABEL}
      </button>
      {step?.at === 'paper' ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={SEND_A_PAPER_LABEL}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 420px)', maxHeight: 'min(80vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35 }}>{SEND_A_PAPER_LABEL}</h3>
              <button type="button" onClick={close} aria-label="Close" style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }}>
                ×
              </button>
            </div>
            <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Pick a paper from the Contract Book. You pick who it is with next.</p>
            {papers.length === 0 ? (
              <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'papers in the Contract Book', page: { label: 'Contract library', tail: 'is where a paper is written.' } }), { onPress: toLibrary })} />
            ) : (
              <>
                <input
                  type="search"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Find a paper"
                  aria-label="Find a paper"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)', marginBottom: '0.2rem' }}
                />
                {shown.length === 0 ? (
                  <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'papers', query: typed }), { onPress: () => setTyped('') })} />
                ) : (
                  shown.map((p) =>
                    p.hasWords ? (
                      <button key={p.bookDocumentId} type="button" style={paperRow} onClick={() => setStep({ at: 'person', documentName: p.paperName })}>
                        {p.paperName}
                        <span style={paperFrom}>{p.from}</span>
                      </button>
                    ) : (
                      // A paper with nothing to sign cannot go out: it names why, and is not a press.
                      <div key={p.bookDocumentId} style={{ ...paperRow, cursor: 'default', color: 'var(--text-muted)' }} data-testid="send-paper-no-words">
                        {p.paperName}
                        <span style={paperFrom}>{p.from}</span>
                      </div>
                    ),
                  )
                )}
                <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  A job’s contract is sent from its job. A paper is written and changed in the{' '}
                  <button type="button" onClick={toLibrary} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', fontWeight: 600 }}>
                    Contract library
                  </button>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {step?.at === 'person' && data ? (
        <PaperPartyPicker
          documentName={step.documentName}
          roster={rosterToPick}
          busy={busy === 'pick'}
          onPick={(pick) => (pick.kind === 'roster' ? void pickPerson(step.documentName, pick.personName) : void pickParty(step.documentName, pick))}
          onClose={close}
        />
      ) : null}
      {step?.at === 'party-out' ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copiesOutTitle(step.documentName)}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 440px)', maxHeight: 'min(80vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{copiesOutTitle(step.documentName)}</h3>
              <button type="button" onClick={close} aria-label="Close" style={closeX}>
                ×
              </button>
            </div>
            <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{copiesOutLead(step.party.name, step.copies.length)}</p>
            {step.site ? (
              <p style={{ margin: '-0.3rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }} data-testid="party-out-site">
                <ValueSentence text={paperSiteSentence(step.site)} />
              </p>
            ) : null}
            {step.copies.map((copy) => (
              <div key={copy.docId} style={{ marginBottom: '0.7rem' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.875rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }} data-testid="party-copy-out">
                  <ValueSentence text={copyOutSentence(copy)} values={{ day: (day) => <WorkedOutValue><span style={{ whiteSpace: 'nowrap' }}>{day}</span></WorkedOutValue> }} />
                </p>
                <button
                  type="button"
                  style={choice}
                  onClick={() =>
                    setStep({
                      at: 'send-party',
                      documentName: step.documentName,
                      pick: step.pick,
                      party: step.party,
                      again: copy,
                      facts: { target: { personName: copy.signerName, documentName: step.documentName }, initialEmail: copy.signerEmail, signerName: copy.signerName, signerTitle: copy.signerTitle, personId: null, sender: step.sender },
                    })
                  }
                >
                  {sendAgainLabel(copy)}
                  <span style={choiceHint}>{SEND_AGAIN_HINT}</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              style={choice}
              onClick={() => {
                // Someone else signs the second copy, so it is the company's and the boxes open empty: the office names
                // them, and the tick keeps them with the company as on a first send.
                const business = step.pick.business
                const pick: Extract<PartyPick, { kind: 'record' }> = { kind: 'record', business, record: { table: business.table, id: business.id }, signer: null }
                setStep({
                  at: 'send-party',
                  documentName: step.documentName,
                  pick,
                  party: sendWindowPartyOfPick(pick),
                  second: true,
                  site: step.site ?? null,
                  facts: { target: { personName: '', documentName: step.documentName }, initialEmail: '', signerName: '', signerTitle: '', personId: null, sender: step.sender },
                })
              }}
            >
              {SECOND_COPY_LABEL}
              <span style={choiceHint}>{SECOND_COPY_HINT}</span>
            </button>
          </div>
        </div>
      ) : null}
      {step?.at === 'send-party' ? (
        <Suspense fallback={null}>
          <ContractSendWindow
            again={step.again != null}
            target={step.facts.target}
            docId={step.again?.docId ?? null}
            party={step.party}
            preparePartyPaper={
              step.again ? undefined : (input) => preparePartyPaper(step.documentName, step.pick, step.party, input, step.second === true, step.site ?? null, sitePrintsAtSend(step.site ?? null, step.printsAddress === true, printReady))
            }
            siteSlot={
              // A copy that is out keeps the site it was sent for: only a new paper is asked.
              step.again ? null : (
                <PaperSiteLine site={step.site ?? null} box={printBox} kept={step.kept === true} onPick={() => setSitePicking(true)} onTakeOff={() => void nameSite(null)} onPrint={(on) => setStep({ ...step, printsAddress: on })} />
              )
            }
            onRowWritten={() => setStep((s) => (s?.at === 'send-party' && !s.again ? { ...s, kept: true } : s))}
            initialEmail={step.facts.initialEmail}
            initialSignerName={step.facts.signerName}
            initialSignerTitle={step.facts.signerTitle}
            sender={step.facts.sender}
            personId={null}
            onClose={close}
            onSent={() => {
              setStep(null)
              onSent()
            }}
          />
        </Suspense>
      ) : null}
      {sitePicking && step?.at === 'send-party' && !step.again ? <PaperSitePicker busy={siteBusy} onPick={(site) => void nameSite(site)} onClose={() => setSitePicking(false)} /> : null}
      {step?.at === 'send' ? (
        <Suspense fallback={null}>
          <ContractSendWindow
            again={step.again}
            target={step.facts.target}
            docId={step.docId}
            quickSendPlan={step.plan}
            initialEmail={step.facts.initialEmail}
            initialSignerName={step.facts.signerName}
            initialSignerTitle={step.facts.signerTitle}
            sender={step.facts.sender}
            personId={step.facts.personId}
            onClose={close}
            onSent={() => {
              setStep(null)
              onSent()
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export default AgreementsSendPaper
