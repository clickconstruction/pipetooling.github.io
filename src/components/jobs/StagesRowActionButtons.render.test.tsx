// @vitest-environment jsdom
/**
 * Render smokes for the Pipeline row's action icons (Stages tab decomposition PR 9): each
 * button's accessible name, click, and the boxed state the callers flag.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PipelineChecklistDoor } from '../../lib/jobs/pipelineChecklistDoor'
import {
  StagesAiaG702Button,
  StagesChecklistDoorButton,
  StagesHazmatFeeButton,
  StagesJobFolderButton,
  StagesLienInstrumentsButton,
  StagesLienReleaseButton,
  StagesRowIcons,
  StagesTestReportButton,
} from './StagesRowActionButtons'

describe('StagesRowActionButtons', () => {
  it('every icon carries its accessible name and fires its click', () => {
    const fns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()] as const
    render(
      <>
        <StagesTestReportButton onClick={fns[0]} />
        <StagesLienInstrumentsButton onClick={fns[1]} demandOut={false} />
        <StagesLienReleaseButton onClick={fns[2]} hasRelease={false} />
        <StagesAiaG702Button onClick={fns[3]} />
        <StagesHazmatFeeButton onClick={fns[4]} hasFee={false} />
      </>,
    )
    const names = ['Open Test report', 'Liens on this job', 'Release of lien', 'Open AIA G702-G703 workbook generator', 'Create a hazmat fee for this job']
    names.forEach((name, i) => {
      fireEvent.click(screen.getByLabelText(name))
      expect(fns[i]).toHaveBeenCalledTimes(1)
    })
  })

  it('the boxed states change the title and draw the border', () => {
    render(
      <>
        <StagesLienInstrumentsButton onClick={vi.fn()} demandOut />
        <StagesLienReleaseButton onClick={vi.fn()} hasRelease />
        <StagesHazmatFeeButton onClick={vi.fn()} hasFee />
      </>,
    )
    expect(screen.getByLabelText('Liens on this job').getAttribute('title')).toMatch(/a demand letter is out/)
    expect(screen.getByLabelText('Liens on this job').style.border).toBe('2px solid rgb(180, 83, 9)')
    expect(screen.getByLabelText('Release of lien').getAttribute('title')).toMatch(/issued lien release/)
    expect(screen.getByLabelText('Release of lien').style.border).toBe('2px solid rgb(37, 99, 235)')
    expect(screen.getByLabelText('Create a hazmat fee for this job').getAttribute('title')).toMatch(/click to add another/)
    expect(screen.getByLabelText('Create a hazmat fee for this job').style.border).toBe('2px solid rgb(34, 197, 94)')
  })

  it('the icon block drops empty slots and caps each row at four, split evenly', () => {
    const { container } = render(
      <StagesRowIcons>
        <StagesTestReportButton onClick={vi.fn()} />
        {null}
        <StagesLienInstrumentsButton onClick={vi.fn()} demandOut={false} />
        <StagesLienReleaseButton onClick={vi.fn()} hasRelease={false} />
        {false}
        <StagesAiaG702Button onClick={vi.fn()} />
        <StagesHazmatFeeButton onClick={vi.fn()} hasFee={false} />
      </StagesRowIcons>,
    )
    const block = container.querySelector('[data-stages-row-icons]') as HTMLElement
    expect(block.children).toHaveLength(5)
    expect(block.style.maxWidth).toBe('calc(3 * 1.75rem + 2 * 0.35rem)')
  })

  it('an empty icon block draws nothing', () => {
    const { container } = render(<StagesRowIcons>{null}</StagesRowIcons>)
    expect(container.querySelector('[data-stages-row-icons]')).toBeNull()
  })

  it('the Job folder icon opens the tab on a click, Drive on a ⌘-click, and greys out without a folder (v2.6301)', () => {
    const onOpenTab = vi.fn()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const url = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv'
    const { unmount } = render(<StagesJobFolderButton folderUrl={url} onOpenTab={onOpenTab} />)
    const made = screen.getByLabelText('Open the job’s folders')
    expect(made.getAttribute('title')).toMatch(/⌘-click opens the folder in Drive/)
    expect(made.style.color).toBe('rgb(217, 119, 6)')
    fireEvent.click(made)
    expect(onOpenTab).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(made, { metaKey: true })
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer')
    expect(onOpenTab).toHaveBeenCalledTimes(1)
    unmount()

    const onOpenTabBare = vi.fn()
    render(<StagesJobFolderButton folderUrl={null} onOpenTab={onOpenTabBare} />)
    const bare = screen.getByLabelText('Open the job’s folders')
    expect(bare.getAttribute('title')).toMatch(/no Drive folder yet/)
    expect(bare.style.color).toBe('var(--text-muted)')
    fireEvent.click(bare, { metaKey: true })
    expect(onOpenTabBare).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
    open.mockRestore()
  })

  it('the checklist door reads its tone and count, carries its words, fires its click, and is nothing with no stage that takes a checklist (#246)', () => {
    const door = (over: Partial<PipelineChecklistDoor>): PipelineChecklistDoor => ({ kind: 'open', tone: 'amber', answered: 3, asked: 6, count: '3/6', title: 'Checklists · Trim Set 3 of 6 · Rough In filled', aria: 'Checklists on this job · 3 of 6 answered', badge: '3 of 6', ...over })
    const onClick = vi.fn()
    const { unmount, container } = render(<StagesChecklistDoorButton door={door({})} onClick={onClick} />)
    const open = screen.getByLabelText('Checklists on this job · 3 of 6 answered')
    expect(open.getAttribute('title')).toBe('Checklists · Trim Set 3 of 6 · Rough In filled')
    expect(open.getAttribute('data-stages-checklist-door')).toBe('open')
    expect(open.style.color).toBe('var(--text-amber-700)')
    expect(container.querySelector('[data-stages-checklist-count]')?.textContent).toBe('3/6')
    fireEvent.click(open)
    expect(onClick).toHaveBeenCalledTimes(1)
    unmount()

    const filled = render(<StagesChecklistDoorButton door={door({ kind: 'filled', tone: 'green', count: '', aria: 'Checklists on this job · every stage filled' })} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Checklists on this job · every stage filled').style.color).toBe('var(--text-green-700)')
    expect(filled.container.querySelector('[data-stages-checklist-count]')).toBeNull()
    filled.unmount()

    const empty = render(<StagesChecklistDoorButton door={door({ kind: 'empty', tone: 'muted', count: '', aria: 'Checklists on this job · no questions yet' })} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Checklists on this job · no questions yet').style.color).toBe('var(--text-muted)')
    empty.unmount()

    const none = render(<StagesChecklistDoorButton door={door({ kind: 'none' })} onClick={vi.fn()} />)
    expect(none.container.querySelector('button')).toBeNull()
  })
})
