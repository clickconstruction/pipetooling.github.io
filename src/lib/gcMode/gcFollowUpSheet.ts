/**
 * GC mode — design spike: the Follow up sheet (the owner, 2026-10-04). One person at a time: what
 * they owe us, a polite draft that names it, sent from me (the default) or from the company, then
 * logged on each ask so the list stays honest. The people are the ones Follow up's badge counts (a
 * quote to chase, a promise whose day came, insurance that ran out with no new day); anything
 * else they owe shows under it, unticked, to ask in the same message.
 *
 * Built by the Building lane on the Board's Follow up. Import from `./gcModel`.
 */
import type { GcAction, GcState, Partner, TradePromise } from './gcTypes'
import { askPromise, followUps } from './gcFollowUp'
import { insuranceRenewals, insuranceRenewalWords, paperAsks, tradePromisesOf, tradePromiseState, tradePromiseWords } from './gcPromises'
import { papersOwed } from './gcBuildingPromises'
import { portalLink } from './gcPortal'
import { pDate, pWeekday, type PortalLang } from './gcPortalI18n'
import { GC_COMPANY } from './gcFixture'
import { daysUntil, shortDate, weekdayDate } from './gcWords'

export type FollowItemKind =
  | 'quote'
  | 'promise'
  | 'insurance'
  | 'waiver'
  | 'w9'
  | 'sow'
  // One job's list from the board's Who to call card (Board, 2026-10-04): the newest set not
  // opened, questions waiting on the architect, our bid waiting on the customer.
  | 'plans'
  | 'answer'
  | 'decision'
  // A change order waiting on the customer's signature (Board, 2026-10-04).
  | 'signature'

/** One thing a person owes us, with the words a message uses for it in each language. */
export interface FollowItem {
  key: string
  kind: FollowItemKind
  /** "Sitework quote · Boerne Retail Shell". */
  label: string
  /** Why now, in the office's words. */
  why: string
  tone: 'red' | 'amber'
  /** The last thing logged about it. Null: nothing yet. */
  last: string | null
  /** Counted on Follow up's badge, so ticked at first. False: also owed, unticked. */
  due: boolean
  /** A quote's ask, to log the contact on. */
  ask?: { projectId: string; packageId: string; inviteId: string }
  /** The job and trade a paper is for. */
  projectId?: string
  packageId?: string
  /** A promise already made about it. */
  promise?: TradePromise
  /** A quote's bid day, for "Our bid is due …". */
  bidDue?: string
  words: Record<PortalLang, { about: string; detail: string; ask: string }>
}

export interface PartnerReach {
  /** "Greg Paulk". */
  name: string
  first: string
  phone: string
  email: string
  /** True when the record has none and a made-up one stands in. */
  madeUp: boolean
}

export interface FollowPerson {
  partner: Partner
  reach: PartnerReach
  /** What the badge counts first, then what else they owe. */
  items: FollowItem[]
}

/** The person to reach at a company. A 555-01xx number and an .example address stand in where the record has none. */
export function partnerReach(partner: Partner): PartnerReach {
  const name = partner.contact || partner.company
  const first = name.split(/\s+/)[0] ?? name
  let h = 2166136261
  for (const c of partner.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const phone = partner.phone ?? `(210) 555-01${String(h % 100).padStart(2, '0')}`
  const slug = partner.company.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const email = partner.email ?? `${first.toLowerCase().replace(/[^a-z]/g, '')}@${slug}.example`
  return { name, first, phone, email, madeUp: !partner.phone || !partner.email }
}

function lastAsk(lines: { on: string; how: string; note: string }[] | undefined): string | null {
  const l = lines?.[0]
  return l ? `${shortDate(l.on)} · ${l.how}: ${l.note}` : null
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Everyone Follow up's badge counts, one person each, in the badge's order, with what else they
 * owe. `also`: a company opened from its own card though the badge does not count it (one we are
 * only waiting on, insurance not run out yet); it comes last, with those items too.
 */
export function followUpPeople(state: GcState, also?: string): FollowPerson[] {
  const today = state.today
  const byPartner = new Map<string, FollowItem[]>()
  const order: string[] = []
  const add = (partnerId: string, item: FollowItem) => {
    if (!byPartner.has(partnerId)) {
      byPartner.set(partnerId, [])
      order.push(partnerId)
    }
    byPartner.get(partnerId)?.push(item)
  }

  // Quotes to chase: the Follow up cards, but not the ones only waiting on their word.
  for (const f of followUps(state)) {
    if (f.why === 'waiting' && f.partner.id !== also) continue
    const trade = f.pkg.trade.toLowerCase()
    const promise = askPromise(f.invite, today)
    const sent = Math.max(0, daysUntil(today, f.invite.invitedOn))
    const detail: Record<PortalLang, string> =
      f.why === 'passed'
        ? { en: `You'd said ${weekdayDate(promise?.by ?? null)}`, es: `Nos dijo el ${pWeekday('es', promise?.by ?? null)}` }
        : f.why === 'today'
          ? { en: "You'd said today", es: 'Nos dijo que hoy' }
          : f.why === 'silent'
            ? { en: `We sent you the plans ${sent} days ago`, es: `Le enviamos los planos hace ${sent} días` }
            : f.why === 'waiting'
              ? { en: `You'd said ${weekdayDate(promise?.by ?? null)}`, es: `Nos dijo el ${pWeekday('es', promise?.by ?? null)}` }
              : { en: 'You have the plans', es: 'Ya tiene los planos' }
    const ask: Record<PortalLang, string> =
      f.why === 'passed'
        ? { en: 'Could you send it today?', es: '¿La puede enviar hoy?' }
        : f.why === 'today'
          ? { en: 'Is it still on track?', es: '¿Sigue en pie para hoy?' }
          : f.why === 'silent'
            ? { en: 'Could you take a look this week?', es: '¿La puede revisar esta semana?' }
            : f.why === 'waiting'
              ? { en: 'Is it still on track?', es: '¿Sigue en pie?' }
              : { en: 'When do you think you can send it?', es: '¿Para cuándo la puede enviar?' }
    add(f.partner.id, {
      key: `quote-${f.invite.id}`,
      kind: 'quote',
      label: `${f.pkg.trade} quote · ${f.project.name}`,
      why: f.words,
      tone: f.why === 'passed' || f.why === 'silent' ? 'red' : 'amber',
      last: lastAsk(f.invite.contacts),
      due: f.why !== 'waiting',
      ask: { projectId: f.project.id, packageId: f.pkg.id, inviteId: f.invite.id },
      ...(f.project.bidDue ? { bidDue: f.project.bidDue } : {}),
      words: {
        en: { about: `your ${trade} quote for ${f.project.name}`, detail: detail.en, ask: ask.en },
        es: { about: `su cotización de ${f.pkg.trade} para ${f.project.name}`, detail: detail.es, ask: ask.es },
      },
    })
  }

  // Promises whose day came or passed (any lane's kind), then insurance that ran out with no new day.
  for (const p of tradePromisesOf(state)) {
    const st = tradePromiseState(p, today).state
    if (st === 'kept' || st === 'late' || ((st === 'pending') && p.partnerId !== also)) continue
    const project = p.projectId ? state.projects.find((x) => x.id === p.projectId) : undefined
    add(p.partnerId, {
      key: `promise-${p.id}`,
      kind: 'promise',
      label: `${cap(p.what)}${project ? ` · ${project.name}` : ''}`,
      why: tradePromiseWords(p, today),
      tone: st === 'passed' ? 'red' : 'amber',
      last: null,
      due: st !== 'pending',
      promise: p,
      ...(p.projectId ? { projectId: p.projectId } : {}),
      ...(p.packageId ? { packageId: p.packageId } : {}),
      words: {
        en: { about: p.what, detail: st === 'today' ? "You'd said today" : `You'd said ${weekdayDate(p.by)}`, ask: st === 'pending' ? 'Is it still on track?' : 'Could you send it today?' },
        es: { about: 'lo que quedó en enviarnos', detail: st === 'today' ? 'Nos dijo que hoy' : `Nos dijo el ${pWeekday('es', p.by)}`, ask: st === 'pending' ? '¿Sigue en pie?' : '¿Lo puede enviar hoy?' },
      },
    })
  }
  for (const r of insuranceRenewals(state)) {
    if ((r.days > 0 || r.promise) && r.partner.id !== also) continue
    if (r.promise && r.partner.id === also) continue
    add(r.partner.id, {
      key: `insurance-${r.partner.id}`,
      kind: 'insurance',
      label: 'Insurance certificate',
      why: insuranceRenewalWords(r),
      tone: r.days <= 0 ? 'red' : 'amber',
      last: null,
      due: r.days <= 0,
      words: {
        en: { about: 'your insurance certificate', detail: `The one we have ${r.days <= 0 ? 'ran out' : 'runs out'} ${shortDate(r.expires)}`, ask: 'Could you send the new one?' },
        es: { about: 'su certificado de seguro', detail: `El que tenemos ${r.days <= 0 ? 'venció' : 'vence'} el ${pDate('es', r.expires)}`, ask: '¿Nos puede enviar el nuevo?' },
      },
    })
  }

  if (also && !byPartner.has(also) && state.partners.some((x) => x.id === also)) {
    byPartner.set(also, [])
    order.push(also)
  }

  // What else each of them owes: a waiver on a paid draw, a W-9, a statement of work to sign.
  const papers = paperAsks(state)
  return order.flatMap((partnerId) => {
    const partner = state.partners.find((x) => x.id === partnerId)
    if (!partner) return []
    const items = byPartner.get(partnerId) ?? []
    const covered = new Set(items.flatMap((i) => (i.promise ? [`${i.promise.kind}-${i.promise.packageId ?? ''}`] : [])))
    for (const project of state.projects) {
      for (const pkg of project.packages) {
        if (pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId !== partnerId || covered.has(`closeout-${pkg.id}`)) continue
        for (const d of papersOwed(project, pkg, today).waivers) {
          items.push({
            key: `waiver-${d.id}`,
            kind: 'waiver',
            label: `Unconditional waiver · draw ${d.number}, ${project.name}`,
            why: `Draw ${d.number} is paid${d.paidOn ? ` ${shortDate(d.paidOn)}` : ''}. The waiver has not come.`,
            tone: 'amber',
            last: null,
            due: false,
            projectId: project.id,
            packageId: pkg.id,
            words: {
              en: { about: `the unconditional waiver for draw ${d.number} on ${project.name}`, detail: `We paid draw ${d.number}${d.paidOn ? ` ${shortDate(d.paidOn)}` : ''}`, ask: 'Could you sign it in your portal?' },
              es: { about: `la renuncia de gravamen incondicional del pago ${d.number} en ${project.name}`, detail: `Le pagamos el pago ${d.number}`, ask: '¿La puede firmar en su portal?' },
            },
          })
        }
      }
    }
    for (const paper of papers) {
      if (paper.partner.id !== partnerId || paper.promise || covered.has(`${paper.kind}-${paper.packageId ?? ''}`)) continue
      const project = paper.projectId ? state.projects.find((x) => x.id === paper.projectId) : undefined
      const trade = project?.packages.find((k) => k.id === paper.packageId)?.trade ?? ''
      items.push(
        paper.kind === 'w9'
          ? {
              key: `w9-${partnerId}`,
              kind: 'w9',
              label: 'W-9',
              why: paper.words,
              tone: 'amber',
              last: null,
              due: false,
              words: {
                en: { about: 'a signed W-9', detail: 'We do not have one on file', ask: 'Could you sign it in your portal?' },
                es: { about: 'un W-9 firmado', detail: 'No tenemos uno en el archivo', ask: '¿Lo puede firmar en su portal?' },
              },
            }
          : {
              key: `sow-${paper.packageId ?? ''}`,
              kind: 'sow',
              label: `${trade} statement of work · ${project?.name ?? ''}`,
              why: paper.words,
              tone: 'amber',
              last: null,
              due: false,
              ...(paper.projectId ? { projectId: paper.projectId } : {}),
              ...(paper.packageId ? { packageId: paper.packageId } : {}),
              words: {
                en: { about: `the ${trade.toLowerCase()} statement of work for ${project?.name ?? 'the job'}`, detail: 'It is waiting on your signature', ask: 'Could you sign it in your portal?' },
                es: { about: `el contrato de trabajo de ${trade} para ${project?.name ?? 'la obra'}`, detail: 'Está esperando su firma', ask: '¿Lo puede firmar en su portal?' },
              },
            },
      )
    }
    return [{ partner, reach: partnerReach(partner), items }]
  })
}

export interface DraftChoice {
  /** Me: in my name, from my phone or mail. The company: from Click, email only for now. */
  from: 'me' | 'company'
  via: 'text' | 'email'
  /** A quick nudge, or a full note with every detail. */
  length: 'nudge' | 'note'
}

function listWords(words: string[], lang: PortalLang): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} ${lang === 'es' ? 'y' : 'and'} ${words[words.length - 1]}`
}

/**
 * The message, in the company's language: the subject (for an email) and the body. `me` is the
 * signed-in person's name; without one, the message speaks for the company.
 */
export function followUpDraft(person: FollowPerson, items: FollowItem[], choice: DraftChoice, me: string | null): { subject: string; body: string } {
  const lang: PortalLang = person.partner.lang ?? 'en'
  const es = lang === 'es'
  const gc = GC_COMPANY.shortName
  const first = person.reach.first
  const mine = choice.from === 'me' && me !== null
  const meFirst = me?.split(/\s+/)[0] ?? ''
  const w = items.map((i) => i.words[lang])
  const one = w.length === 1 ? w[0] : undefined
  const subject = one ? cap(one.about) : es ? `Algunas cosas de ${gc}` : `A few things from ${gc}`
  if (w.length === 0) return { subject, body: '' }
  const dues = items.flatMap((i) => (i.bidDue ? [i.bidDue] : [])).sort()
  const due = dues[0] ? (es ? `Nuestra propuesta al cliente vence el ${pWeekday('es', dues[0])}.` : `Our bid to the customer is due ${weekdayDate(dues[0])}.`) : ''
  const portal = es ? `En su portal está todo: ${portalLink(person.partner.id)}` : `Everything is in your portal: ${portalLink(person.partner.id)}`
  const signMine = es ? `Gracias,\n${me}\n${GC_COMPANY.name}` : `Thanks,\n${me}\n${GC_COMPANY.name}`
  const signCompany = es ? `Gracias,\n${GC_COMPANY.name}` : `Thank you,\n${GC_COMPANY.name}`

  if (choice.length === 'nudge') {
    if (mine) {
      const hi = es ? `Hola ${first}, le escribe ${meFirst} de ${gc}.` : `Hi ${first}, it's ${meFirst} at ${gc}.`
      const what = one
        ? es
          ? `Solo quería consultarle sobre ${one.about}. ${one.detail}. ${one.ask}`
          : `Just checking on ${one.about}. ${one.detail}. ${one.ask}`
        : es
          ? `Quería consultarle sobre ${listWords(w.map((x) => x.about), lang)}. ¿Las puede enviar esta semana?`
          : `Just checking on ${listWords(w.map((x) => x.about), lang)}. Could you send them this week?`
      return { subject, body: `${hi} ${what} ${es ? '¡Gracias!' : 'Thanks!'}` }
    }
    const hi = es ? `Hola ${first},` : `Hello ${first},`
    const what = one
      ? es
        ? `${GC_COMPANY.name} le da seguimiento a ${one.about}. ${one.detail}. ${one.ask}`
        : `${GC_COMPANY.name} is following up on ${one.about}. ${one.detail}. ${one.ask}`
      : es
        ? `${GC_COMPANY.name} le da seguimiento a ${listWords(w.map((x) => x.about), lang)}. ¿Las puede enviar esta semana?`
        : `${GC_COMPANY.name} is following up on ${listWords(w.map((x) => x.about), lang)}. Could you send them this week?`
    return { subject, body: `${hi}\n\n${what}\n\n${portal}\n\n${signCompany}` }
  }

  const hi = es ? `Hola ${first},` : mine ? `Hi ${first},` : `Hello ${first},`
  const warm = mine ? (es ? 'Espero que tenga una buena semana. ' : 'Hope your week is going well. ') : ''
  const opener = es
    ? `${warm}${mine ? 'Le escribo para dar seguimiento a' : `${GC_COMPANY.name} le da seguimiento a`} ${one ? one.about : 'algunas cosas'}.`
    : `${warm}${mine ? "I'm following up on" : `${GC_COMPANY.name} is following up on`} ${one ? one.about : 'a few things'}.`
  // One thing: its day and the ask as a paragraph. Several: a line each.
  const lines = one ? `${one.detail}. ${one.ask}` : w.map((x) => `- ${cap(x.about)}. ${x.detail}. ${x.ask}`).join('\n')
  const body = [hi, opener, lines, due, portal, mine ? signMine : signCompany].filter(Boolean).join('\n\n')
  return { subject, body }
}

/** `sms:` for texting from my phone, the text filled in. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`
}

/** `mailto:` for emailing from my own mail, subject and body filled in. */
export function mailHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** The message on one line, short, for the line logged on the ask. */
function logLine(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat
}

/**
 * What sending does: a line on each quote's ask (how, and the message), and one note on the
 * company for the papers (it shows in its Activity).
 */
export function followUpSentActions(person: FollowPerson, items: FollowItem[], choice: DraftChoice, body: string): GcAction[] {
  const note = `${choice.from === 'company' ? `From ${GC_COMPANY.shortName}: ` : ''}${logLine(body)}`
  const out: GcAction[] = items.flatMap((i): GcAction[] => (i.ask ? [{ type: 'logContact', ...i.ask, how: choice.via, note, promisedBy: null }] : []))
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) {
    out.push({
      type: 'logPartnerContact',
      partnerId: person.partner.id,
      note: `${choice.via === 'text' ? 'Texted' : 'Emailed'} about ${listWords(papers.map((i) => i.label.toLowerCase()), 'en')}: ${note}`,
    })
  }
  return out
}

/**
 * What logging a call does: what they said on each quote's ask, with the day they gave; for the
 * papers, a note on the company and, with a day, a promise of the right kind.
 */
export function followUpCallActions(person: FollowPerson, items: FollowItem[], said: string, by: string | null): GcAction[] {
  const note = said.trim() || 'Gave a day.'
  const partnerId = person.partner.id
  const out: GcAction[] = []
  for (const i of items) {
    if (i.ask) {
      out.push({ type: 'logContact', ...i.ask, how: 'call', note, promisedBy: by })
      continue
    }
    if (!by) continue
    const where = { ...(i.projectId ? { projectId: i.projectId } : {}), ...(i.packageId ? { packageId: i.packageId } : {}) }
    if (i.kind === 'insurance') out.push({ type: 'recordPromise', partnerId, kind: 'insurance', by, from: 'office' })
    else if (i.kind === 'w9') out.push({ type: 'recordPromise', partnerId, kind: 'w9', by, from: 'office' })
    else if (i.kind === 'sow') out.push({ type: 'recordPromise', partnerId, kind: 'sow', ...where, by, from: 'office' })
    else if (i.kind === 'waiver') out.push({ type: 'recordPromise', partnerId, kind: 'closeout', ...where, by, from: 'office', what: i.words.en.about })
    else if (i.kind === 'promise' && i.promise) out.push({ type: 'recordPromise', partnerId, kind: i.promise.kind, ...where, by, from: 'office' })
  }
  const papers = items.filter((i) => !i.ask)
  if (papers.length > 0) out.push({ type: 'logPartnerContact', partnerId, note: `Call about ${listWords(papers.map((i) => i.label.toLowerCase()), 'en')}: ${note}` })
  return out
}

/** How many people and things the sheet holds: the badge's count. */
export function followUpCount(people: FollowPerson[]): number {
  return people.reduce((n, p) => n + p.items.filter((i) => i.due).length, 0)
}
