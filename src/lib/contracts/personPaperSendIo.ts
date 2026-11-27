/**
 * Sending a person's paper to sign: the calls. One sender for every screen that sends a staff, sub or partner paper
 * from the app's own windows: `send-contract-for-signature`, in email mode (the signer is emailed the link) or link
 * mode (the link comes back and nothing is emailed). Either mode mints a new link, so the one sent before stops working.
 * Browser io, not pure; the rules are `personPaperSend.ts`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { QuickSendPlan } from '../contractsQuickSend'
import { onePersonIdForName, rosterEmailForName, sendWindowSender, type PersonPaperSendResult, type SendRosterPerson, type SendRosterUser } from './personPaperSend'
import { isPartyPaperName } from './paperParty'
import type { SendWindowParty } from '../documents/paperPartyPick'
import type { PaperSiteColumns } from '../addresses/paperSite'

export type PersonPaperSendInput = {
  documentId: string
  /** `email` sends the link to `signerEmail`; `link` hands it back and emails nobody. */
  mode: 'email' | 'link'
  signerEmail?: string
  /** Who signs, kept on the paper's row (punch list #403). Blank leaves the name to the function's own rule. */
  signerName?: string
  /** The signer's title. Sent with every email, so a cleared box clears the row's; never sent with a link. */
  signerTitle?: string
  /** The business a party's signer signs for (punch list #403). Sent only for a party's paper; '' clears it, for a person who signs for themselves. */
  signingFor?: string
  /** The office's own subject and opening words; blank keeps the email's own. */
  subject?: string
  intro?: string
}

/** Send the paper, or mint its link. Throws with the function's own reason. */
export async function sendPersonPaperForSignature(input: PersonPaperSendInput): Promise<PersonPaperSendResult> {
  const { data: sess } = await supabase.auth.getSession()
  const jwt = sess.session?.access_token
  if (!jwt) throw new Error('Not signed in.')
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const subject = (input.subject ?? '').trim()
  const intro = (input.intro ?? '').trim()
  const signerName = (input.signerName ?? '').trim()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-for-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      apikey: anon,
    },
    body: JSON.stringify({
      person_contract_document_id: input.documentId,
      ...(input.mode === 'link'
        ? { mode: 'link' }
        : {
            signer_email: (input.signerEmail ?? '').trim(),
            ...(signerName ? { signer_name: signerName } : {}),
            ...(input.signerTitle !== undefined ? { signer_title: input.signerTitle.trim() } : {}),
            ...(input.signingFor !== undefined ? { signing_for: input.signingFor.trim() } : {}),
          }),
      public_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      ...(subject ? { email_subject: subject } : {}),
      ...(intro ? { email_intro_plain: intro } : {}),
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    accept_url?: string
    emailed?: boolean
    email_error?: string
    warning?: string
    error?: string
  }
  if (!res.ok || !json.ok) throw new Error(json.error || 'Send failed')
  return { acceptUrl: json.accept_url ?? null, emailed: json.emailed === true, emailNote: json.warning || json.email_error || null }
}

/**
 * The write a quick-send pick deferred: fill the placeholder or insert the unsent row, returning the id the send
 * function needs. Called from Send email only. Throws on failure, and nothing is minted.
 */
export async function materializeQuickSendRow(pending: {
  personName: string
  documentName: string
  plan: Extract<QuickSendPlan, { kind: 'fill' | 'insert' }>
  /**
   * An outside party's paper (punch list #403): the party's contact and its name as it stands today. `personName` is
   * then the party's stored name, and the paper is no roster person's.
   */
  party?: { contactId: string; name: string }
  /** The site a new row names (punch list #439). A row that is there already keeps the site it has. */
  site?: PaperSiteColumns
}): Promise<string> {
  const { plan } = pending
  const source = plan.source
  if (plan.kind === 'fill') {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('person_contract_documents')
          .update({
            signing_body_html: source.signingBodyHtml,
            signing_body_format: source.signingBodyFormat,
            canonical_document_url: source.canonicalDocumentUrl,
            ...(source.kind === 'book' ? { applied_contract_template_document_id: source.appliedTemplateDocumentId } : {}),
          })
          .eq('id', plan.docId),
      'fill quick send content',
    )
    return plan.docId
  }
  const inserted = await withSupabaseRetry<{ id: string }>(
    async () =>
      supabase
        .from('person_contract_documents')
        .insert({
          person_name: pending.personName,
          ...(pending.party ? { party_contact_id: pending.party.contactId, party_name: pending.party.name } : {}),
          // The site's columns are younger than the generated types: spread, they are written as they are.
          ...(pending.site ?? {}),
          document_name: pending.documentName,
          contract_lineage_id: globalThis.crypto.randomUUID(),
          lineage_version: 1,
          supersedes_person_contract_document_id: null,
          status: 'unsent',
          signing_body_html: source.signingBodyHtml,
          signing_body_format: source.signingBodyFormat,
          canonical_document_url: source.canonicalDocumentUrl,
          applied_contract_template_document_id: source.kind === 'book' ? source.appliedTemplateDocumentId : null,
        })
        .select('id')
        .single(),
    'create quick send document',
  )
  if (!inserted?.id) throw new Error('Could not create the document copy.')
  return inserted.id
}

/**
 * Set whether a paper that is there already prints its site's address (punch list #439): a send that lands on a copy
 * written before keeps that copy's site, and takes the box as the office left it now. Called from Send email only.
 * The row refuses a print with no address beside it. Throws with the reason.
 */
export async function writePaperPrintsAddress(documentId: string, printsAddress: boolean): Promise<void> {
  await withSupabaseRetry(async () => supabase.from('person_contract_documents').update({ site_prints_address: printsAddress }).eq('id', documentId), 'set whether the paper prints its site')
}

/** Whether the person has a live portal address: a saved slug and an unrevoked link. Nothing is minted. */
export async function readPortalSlugIfLive(personId: string): Promise<string | null> {
  const [slugRes, linkRes] = await Promise.all([
    supabase.from('sub_portal_slugs' as never).select('slug').eq('person_id', personId).maybeSingle(),
    supabase.from('sub_portal_links' as never).select('id').eq('person_id', personId).is('revoked_at', null).limit(1),
  ])
  const slug = ((slugRes.data as { slug?: string | null } | null)?.slug ?? '').trim()
  const live = ((linkRes.data ?? []) as unknown[]).length > 0
  return slug && live ? slug : null
}

/** What the Send window needs about one paper, for a screen that holds no roster of its own. */
export type PersonPaperSendFacts = {
  target: { personName: string; documentName: string }
  initialEmail: string
  /** Who signed for it last time, when the paper kept them: the window opens on these. */
  signerName?: string
  signerTitle?: string
  /** An outside party's paper (punch list #403): who it is with, as the window shows it. */
  party?: SendWindowParty
  personId: string | null
  sender: { name: string; email: string } | null
}

/**
 * Read a person's send facts by the name their papers are filed under: their address from the roster or a login of
 * that name, the one roster person the name finds, and the sender. For a paper that is not written yet.
 */
export async function readPersonSendFactsByName(personName: string, documentName: string, currentUserId: string | null | undefined): Promise<PersonPaperSendFacts> {
  const name = personName.trim()
  const [peopleRes, usersRes, meRes] = await Promise.all([
    supabase.from('people').select('id, name, email').eq('name', name).is('archived_at', null).limit(5),
    supabase.from('users').select('id, name, email').eq('name', name).limit(5),
    currentUserId ? supabase.from('users').select('id, name, email').eq('id', currentUserId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const people = (peopleRes.data ?? []) as SendRosterPerson[]
  const users = (usersRes.data ?? []) as SendRosterUser[]
  const me = meRes.data as SendRosterUser | null
  return {
    target: { personName: name, documentName: documentName.trim() },
    initialEmail: rosterEmailForName(name, people, users),
    personId: onePersonIdForName(name, people),
    sender: sendWindowSender(currentUserId, me ? [me] : []),
  }
}

/** The staff member sending, for a window whose party is on no roster: their own name and address, or null with none. */
export async function readSenderFacts(currentUserId: string | null | undefined): Promise<{ name: string; email: string } | null> {
  if (!currentUserId) return null
  const me = await withSupabaseRetry(async () => supabase.from('users').select('id, name, email').eq('id', currentUserId).maybeSingle(), 'read your own address')
  return sendWindowSender(currentUserId, me ? [me as SendRosterUser] : [])
}

/**
 * Read one saved paper's send facts: the paper as filed, then the person's. Each table's own row security answers; a
 * paper the caller cannot read throws.
 */
export async function readPersonPaperSendFacts(documentId: string, currentUserId: string | null | undefined): Promise<PersonPaperSendFacts> {
  const doc = await readPaperSendRow(documentId)
  const kept = keptSignerOf(doc)
  if (isPartyPaperName(doc.person_name)) {
    // A party's paper is filed under a stored name, which is nobody's on the roster: the window opens on who signed for
    // it and the address it went to, and names the party the paper keeps.
    const partyName = (doc.party_name ?? '').trim()
    return {
      target: { personName: kept.name || partyName, documentName: (doc.document_name ?? '').trim() },
      initialEmail: kept.email,
      signerName: kept.name,
      signerTitle: kept.title,
      personId: null,
      sender: await readSenderFacts(currentUserId),
      party: { name: partyName, unlisted: false, keepWith: null },
    }
  }
  const facts = await readPersonSendFactsByName(doc.person_name ?? '', doc.document_name ?? '', currentUserId)
  // The roster's address opens the window, as before. With none on the roster, the address the paper last went to does.
  return { ...facts, initialEmail: facts.initialEmail || kept.email, signerName: kept.name, signerTitle: kept.title }
}

/** The signer a paper kept from its last send (punch list #403): '' for each word it never kept. */
export type KeptSigner = { name: string; title: string; email: string }

/** Read the signer a saved paper kept. For a window opened on a paper whose caller holds no row of it. Throws with the reason. */
export async function readKeptSigner(documentId: string): Promise<KeptSigner> {
  return keptSignerOf(await readPaperSendRow(documentId))
}

/** What a send reads of a saved paper: who it is filed under, and the signer it kept from its last send. */
type PaperSendRow = { person_name: string; document_name: string; signer_name: string | null; signer_title: string | null; signer_email: string | null; party_name: string | null }
// The signer's columns join the generated types with the push's types PR; until then the list is a plain string.
const PAPER_SEND_COLUMNS: string = 'person_name, document_name, signer_name, signer_title, signer_email, party_name'

async function readPaperSendRow(documentId: string): Promise<PaperSendRow> {
  const row = await withSupabaseRetry(async () => supabase.from('person_contract_documents').select(PAPER_SEND_COLUMNS).eq('id', documentId).single(), 'read the paper')
  return row as unknown as PaperSendRow
}

function keptSignerOf(doc: PaperSendRow): KeptSigner {
  return { name: (doc.signer_name ?? '').trim(), title: (doc.signer_title ?? '').trim(), email: (doc.signer_email ?? '').trim() }
}
