// @vitest-environment jsdom
/**
 * v2.3936: the Workflow page's Superintendents strip as a component. Pins the seam — it draws
 * the lists it is handed (a chip per assigned superintendent, None for nobody, the add list
 * without the ones already assigned), and hands picks and × clicks to the page's callbacks;
 * while a write is in flight every control is disabled.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { WorkflowSuperintendentsStrip } from './WorkflowSuperintendentsStrip'

const sam = { id: 'u1', name: 'Sam Ortiz', email: 'sam@example.test' }
const lee = { id: 'u2', name: null, email: 'lee@example.test' }
const bare = { id: 'u3', name: null, email: null }

afterEach(() => {
  cleanup()
})

const optionLabels = () =>
  within(screen.getByRole('combobox')).getAllByRole('option').map((o) => o.textContent)

describe('WorkflowSuperintendentsStrip', () => {
  it('says None with nobody assigned and lists every superintendent to add', async () => {
    await renderSettled(
      <WorkflowSuperintendentsStrip projectSuperintendents={[]} allSuperintendents={[sam, lee, bare]} saving={false} onAdd={() => {}} onRemove={() => {}} />,
      { loaded: () => screen.findByText('Superintendents:') },
    )
    expect(screen.getByText('None')).toBeTruthy()
    expect(optionLabels()).toEqual(['Add superintendent...', 'Sam Ortiz', 'lee@example.test', 'u3'])
  })

  it('draws a chip per assigned superintendent and leaves them out of the add list', async () => {
    await renderSettled(
      <WorkflowSuperintendentsStrip projectSuperintendents={[sam, bare]} allSuperintendents={[sam, lee, bare]} saving={false} onAdd={() => {}} onRemove={() => {}} />,
      { loaded: () => screen.findByText('Sam Ortiz') },
    )
    expect(screen.queryByText('None')).toBeNull()
    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.getAllByTitle('Remove')).toHaveLength(2)
    expect(optionLabels()).toEqual(['Add superintendent...', 'lee@example.test'])
  })

  it('hands a pick to onAdd and a × to onRemove, with the superintendent’s id', async () => {
    const onAdd = vi.fn()
    const onRemove = vi.fn()
    await renderSettled(
      <WorkflowSuperintendentsStrip projectSuperintendents={[sam]} allSuperintendents={[sam, lee]} saving={false} onAdd={onAdd} onRemove={onRemove} />,
      { loaded: () => screen.findByText('Sam Ortiz') },
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u2' } })
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith('u2')
    fireEvent.click(screen.getByTitle('Remove'))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith('u1')
  })

  it('does not call onAdd when the placeholder is picked, and the list goes back to it after a pick', async () => {
    const onAdd = vi.fn()
    await renderSettled(
      <WorkflowSuperintendentsStrip projectSuperintendents={[]} allSuperintendents={[sam]} saving={false} onAdd={onAdd} onRemove={() => {}} />,
      { loaded: () => screen.findByText('Superintendents:') },
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '' } })
    expect(onAdd).not.toHaveBeenCalled()
    fireEvent.change(select, { target: { value: 'u1' } })
    expect(select.value).toBe('')
  })

  it('disables the list and every × while a write is in flight', async () => {
    await renderSettled(
      <WorkflowSuperintendentsStrip projectSuperintendents={[sam, lee]} allSuperintendents={[sam, lee, bare]} saving onAdd={() => {}} onRemove={() => {}} />,
      { loaded: () => screen.findByText('Sam Ortiz') },
    )
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true)
    for (const b of screen.getAllByTitle('Remove')) expect((b as HTMLButtonElement).disabled).toBe(true)
  })
})
