/**
 * The guide behind an error line (punch list #187, PR 6): one card per family of error, not per
 * surface, since a family's sentence is the same everywhere and the surface's own help is its ? card.
 * `errorDoor` reads the class the formatters already decide (`errorHandling.ts`: `network`, an access
 * refusal, a broken link, the sign-in lock, a timeout, the server's own words, the page itself) and
 * answers three rows, what happened, what was saved, what to do, and the guide for that family. The
 * door opens as a card in place and the guide in a new tab, so the error, the window and anything half
 * typed stay. Every row is held to the plain-words rules and every slug to the registry in
 * `errorGuides.test.ts`. Pure.
 */
import type { LegendRow } from './deskLegend'
import { helpGuideHref } from '../helpGuideAnchors'

export type ErrorFamily = 'network' | 'access' | 'broken-link' | 'sign-in' | 'timeout' | 'server-words' | 'page' | 'unknown'

export interface ErrorDoor {
  family: ErrorFamily
  rows: LegendRow[]
  guide: { slug: string; title: string }
  /** Whether a Retry press makes sense for this family. */
  retry: boolean
}

export const ERROR_DOOR_WORDS = {
  open: 'What this means',
  tip: 'Opens a card that says what this error means and what to do.',
  label: 'What this error means',
} as const

const NETWORK_GUIDE = { slug: 'what-no-connection-means', title: 'know what No connection means and what was saved' }
const ACCESS_GUIDE = { slug: 'what-you-dont-have-access-means', title: 'know who to ask when the app says you do not have access' }
const SERVER_GUIDE = { slug: 'read-the-servers-words-on-a-failed-save', title: "read the server's words on a failed save" }
const RESPOND_GUIDE = { slug: 'what-to-do-when-the-app-did-not-respond', title: 'know what to do when the app hangs or a link is dead' }
const UPDATE_GUIDE = { slug: 'app-updates', title: 'update the app when a new version is ready' }

/** The access and broken-link codes `errorHandling.ts` names; the timeout and the sign-in lock by their words. */
export function errorFamilyOf(input: { kind: 'network' | 'server' | 'unknown'; code?: string | null; message?: string | null }): ErrorFamily {
  if (input.kind === 'network') return 'network'
  const code = (input.code ?? '').trim()
  if (code === '42501') return 'access'
  if (code === '22P02' || code === 'PGRST116') return 'broken-link'
  const m = (input.message ?? '').toLowerCase()
  // The formatters' own sentences, for a line that kept the words and lost the code.
  if (m.includes("don't have access") || m.includes("don't have permission") || m.includes('permission denied')) return 'access'
  if (m.includes("doesn't exist any more")) return 'broken-link'
  if (m.includes('renewing your sign-in')) return 'sign-in'
  if (m.includes('did not respond within')) return 'timeout'
  if (m.includes('went wrong loading this page') || m.includes('new version')) return 'page'
  if (input.kind === 'server') return 'server-words'
  return 'unknown'
}

const DOORS: Record<ErrorFamily, ErrorDoor> = {
  network: {
    family: 'network',
    retry: true,
    guide: NETWORK_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#dc2626', note: 'The phone or the computer had no signal. The app never reached the server.' },
      // A read fails this way too (the Physical inbox's, live 2026-10-27), so the row is true for a read and a save alike.
      { key: 'saved', label: 'What was saved', note: 'Nothing was lost. Anything you typed is still on the screen.' },
      { key: 'do', label: 'What to do', note: 'Check the signal, then press Retry. A read tries again on its own when the signal comes back.' },
    ],
  },
  access: {
    family: 'access',
    retry: false,
    guide: ACCESS_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#dc2626', note: 'The server refused this for your role. The record is there, but it is not yours to read or change.' },
      { key: 'saved', label: 'What was saved', note: 'Nothing. Nothing of yours was changed either.' },
      { key: 'do', label: 'What to do', note: 'Ask the office or a leader to do it, or to open the door for your role.' },
    ],
  },
  'broken-link': {
    family: 'broken-link',
    retry: false,
    guide: RESPOND_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#dc2626', note: 'The link points at a record that is gone or was renamed.' },
      { key: 'saved', label: 'What was saved', note: 'Nothing.' },
      { key: 'do', label: 'What to do', note: 'Find the record by its name or number instead. Tell whoever sent the link that it is dead.' },
    ],
  },
  'sign-in': {
    family: 'sign-in',
    retry: true,
    guide: RESPOND_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#d97706', note: 'The app was renewing your sign-in in another tab at that moment.' },
      { key: 'saved', label: 'What was saved', note: 'Nothing. Nothing was lost either.' },
      { key: 'do', label: 'What to do', note: 'Press Retry. If it happens twice, close the other tabs of the app.' },
    ],
  },
  timeout: {
    family: 'timeout',
    retry: true,
    guide: RESPOND_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#d97706', note: 'The server took too long to answer, so the app stopped waiting.' },
      { key: 'saved', label: 'What was saved', note: 'Maybe. A save that timed out may still have landed. Look before you save it again.' },
      { key: 'do', label: 'What to do', note: 'Refresh the app, then check the record. If it is still slow, tell a dev.' },
    ],
  },
  'server-words': {
    family: 'server-words',
    retry: false,
    guide: SERVER_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#dc2626', note: 'The server refused the save and said why in its own words, which name the rule it checked.' },
      { key: 'saved', label: 'What was saved', note: 'Nothing. What you typed is still in the form.' },
      { key: 'do', label: 'What to do', note: 'Fix what the words name and save again. If the words name a rule you do not know, ask the office and say them.' },
    ],
  },
  page: {
    family: 'page',
    retry: true,
    guide: UPDATE_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#d97706', note: 'A part of the app did not load. A new version was most likely put out while you were on the page.' },
      { key: 'saved', label: 'What was saved', note: 'Everything saved before this stays saved.' },
      { key: 'do', label: 'What to do', note: 'Reload the page. The new version comes with it.' },
    ],
  },
  unknown: {
    family: 'unknown',
    retry: false,
    guide: RESPOND_GUIDE,
    rows: [
      { key: 'what', label: 'What happened', accent: '#dc2626', note: 'Something failed and the app has no better word for it than the line above.' },
      { key: 'saved', label: 'What was saved', note: 'Nothing, unless the line says otherwise.' },
      { key: 'do', label: 'What to do', note: 'Try once more. If it fails again, tell a dev the words on the line and what you pressed.' },
    ],
  },
}

export function errorDoor(family: ErrorFamily): ErrorDoor {
  return DOORS[family]
}

export const ERROR_FAMILIES = Object.keys(DOORS) as ErrorFamily[]

/** The guide's address with `via=error`, so the Usage readout counts the open as the door's. */
export function errorGuideHref(door: ErrorDoor): string {
  return helpGuideHref(door.guide.slug, null, 'error')
}

/** `ui_nav_clicks.control` for a press on *What this means*; the target is `#<family>`. */
export const ERROR_DOOR_OPENED_CONTROL = 'error_door_opened'
