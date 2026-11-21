// @vitest-environment jsdom
/**
 * The Settings list window, the lines of step 4 (punch list #389): a choice takes what puts a person in breach and
 * what the site must have, a line each, and the list takes a notice and a site note. A choice that leaves the topic
 * out has no such lines. Enter starts a new line, and the save sends the lines tidied. Every word is a placeholder.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ContractPaper } from '../../lib/contracts/assemble'
import { parseSettingsDef, settingsDefJson, type SettingsDef } from '../../lib/contracts/paperSettings'
import { PaperSettingsWindow } from './PaperSettingsWindow'

const DEF = parseSettingsDef({
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'A placeholder line.', out: true },
      { key: 'standard', label: 'Standard', says: 'A placeholder line.', breach: ['Breach one.'], site: ['Site one.'] },
    ] },
  ],
  fields: [],
  levels: [],
}) as SettingsDef
const paper = (settingsDef: SettingsDef | null): ContractPaper => ({ id: 'p1', title: 'Sample paper', name: 'the sample paper', between: '', revision: 3, publishedAt: null, settingsDef })

function open(settingsDef: SettingsDef | null = DEF) {
  const saved: Array<SettingsDef | null> = []
  const save = vi.fn(async (_id: string, def: SettingsDef | null) => {
    saved.push(def)
    return { revision: 4 }
  })
  renderWithProviders(<PaperSettingsWindow paper={paper(settingsDef)} onClose={() => {}} onSaved={() => {}} save={save} />)
  return { saved }
}
const box = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement | HTMLInputElement

afterEach(cleanup)

describe('PaperSettingsWindow, the lines beside a choice', () => {
  it('shows a choice’s breach and site lines, one line each, and none on a choice that leaves the topic out', () => {
    open()
    expect(box('What puts a person in breach under Standard of Photos and video, one line each').value).toBe('Breach one.')
    expect(box('What the site must have for Standard of Photos and video, one line each').value).toBe('Site one.')
    expect(screen.queryByLabelText('What puts a person in breach under Off of Photos and video, one line each')).toBeNull()
    expect(screen.queryByLabelText('What the site must have for Off of Photos and video, one line each')).toBeNull()
  })

  it('keeps an empty line while it is typed, and saves the lines tidied', async () => {
    const { saved } = open()
    const breach = box('What puts a person in breach under Standard of Photos and video, one line each')
    fireEvent.change(breach, { target: { value: 'Breach one.\n' } })
    expect(breach.value).toBe('Breach one.\n')
    fireEvent.change(breach, { target: { value: 'Breach one.\n  Breach two.  \n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the settings list' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    const sent = settingsDefJson(saved[0]!) as { settings: Array<{ choices: Array<Record<string, unknown>> }> }
    expect(sent.settings[0]!.choices[1]!.breach).toEqual(['Breach one.', 'Breach two.'])
    expect(sent.settings[0]!.choices[1]!.site).toEqual(['Site one.'])
  })

  it('takes a notice and a site note, and a list with neither sends neither', async () => {
    const { saved } = open()
    fireEvent.change(box('Title of the notice'), { target: { value: 'Before you start' } })
    fireEvent.change(box('The words beside its box of the notice'), { target: { value: 'I have read this.' } })
    fireEvent.change(box('Lines of the notice, one line each'), { target: { value: 'Notice one.\nNotice two.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the settings list' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    const sent = settingsDefJson(saved[0]!)
    expect(sent.notice).toEqual({ title: 'Before you start', tick: 'I have read this.', lines: ['Notice one.', 'Notice two.'] })
    expect('siteNote' in sent).toBe(false)
  })

  it('names a note with words and no line before the save, and holds the save', () => {
    open()
    fireEvent.change(box('Title of the site note'), { target: { value: 'Match the paper to the site' } })
    expect(screen.getByText('The site note has words and no line. Add a line or clear its words.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save the settings list' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the Spanish lines only when the Spanish fields are asked for', () => {
    open()
    expect(screen.queryByLabelText('What puts a person in breach under Standard of Photos and video, in Spanish')).toBeNull()
    fireEvent.click(screen.getByLabelText(/Show the Spanish fields/))
    expect(box('What puts a person in breach under Standard of Photos and video, in Spanish').value).toBe('')
    expect(box('Lines of the notice in Spanish, one line each').value).toBe('')
  })
})
