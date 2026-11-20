// @vitest-environment jsdom
/**
 * The Documents page's Document builder tab (punch list #404): the list of builders with where each stands, the Open
 * press, the open builder on the address it names, and the way back. The flow's own wiring is held by
 * `DocumentBuilderFlow.render.test.tsx`. Every name here is made up.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import DocumentsBuilderTab from './DocumentsBuilderTab'

afterEach(cleanup)

/** The address the tab is on, drawn beside it so a press can be read off the page. */
function Where() {
  const { search } = useLocation()
  return <div data-testid="where">{search}</div>
}

function open(route = '/documents?tab=builder') {
  renderWithProviders(
    <>
      <DocumentsBuilderTab />
      <Where />
    </>,
    { route },
  )
}

const where = () => screen.getByTestId('where').textContent

describe('DocumentsBuilderTab', () => {
  it('lists the Sub NDA with where it stands, and says the tab is a dev’s', () => {
    open()
    expect(screen.getByRole('heading', { level: 2, name: 'Document builder' })).toBeTruthy()
    expect(screen.getByText('Dev only')).toBeTruthy()
    expect(screen.getByText('Sub NDA')).toBeTruthy()
    expect(screen.getByText("A job's secrecy paper for the people you bring onto it. Four levels, seven topics.")).toBeTruthy()
    expect(screen.getByText('On a made-up job')).toBeTruthy()
    expect(screen.getByText('Nothing is saved')).toBeTruthy()
    expect(screen.getByText('Not read by an attorney')).toBeTruthy()
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
  })

  it('opens the Sub NDA on its own address, on the disclaimer, and goes back to the list', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Open Sub NDA' }))
    expect(where()).toBe('?tab=builder&builder=sub-nda')
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Before you start')
    expect(screen.getByText(/Every name is made up, and nobody is asked to sign\./)).toBeTruthy()
    expect(screen.getByText('Not read by an attorney')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '‹ Document builder' }))
    expect(where()).toBe('?tab=builder')
    expect(screen.getByRole('button', { name: 'Open Sub NDA' })).toBeTruthy()
  })

  it('opens straight onto a builder the address names, and onto the list for a name it does not know', () => {
    open('/documents?tab=builder&builder=sub-nda')
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    cleanup()
    open('/documents?tab=builder&builder=nope')
    expect(screen.getByRole('button', { name: 'Open Sub NDA' })).toBeTruthy()
  })

  it('walks the open flow: the box on the disclaimer opens the basis', () => {
    open('/documents?tab=builder&builder=sub-nda')
    expect((screen.getByRole('button', { name: 'Next: The basis' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: The basis' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('The basis')
  })
})
