// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EstimateSupportingDocumentFieldset, { type EstimateSupportingDocumentFieldsetProps } from './EstimateSupportingDocumentFieldset'

function props(over: Partial<EstimateSupportingDocumentFieldsetProps> = {}): EstimateSupportingDocumentFieldsetProps {
  return { label: '', url: '', onLabelChange: vi.fn(), onUrlChange: vi.fn(), checkStatus: 'idle', checkMessage: '', onCheck: vi.fn(), ...over }
}

afterEach(cleanup)

describe('EstimateSupportingDocumentFieldset', () => {
  it('hands each keystroke to the page', () => {
    const p = props()
    render(<EstimateSupportingDocumentFieldset {...p} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Floor plan, Scope PDF'), { target: { value: 'Plans' } })
    fireEvent.change(screen.getByPlaceholderText('https://drive.google.com/file/d/…'), { target: { value: 'https://drive.example/a' } })
    expect(p.onLabelChange).toHaveBeenCalledWith('Plans')
    expect(p.onUrlChange).toHaveBeenCalledWith('https://drive.example/a')
  })

  it('keeps Check link dead until the link is an https address', () => {
    const p = props({ url: 'drive.example/a' })
    const { rerender } = render(<EstimateSupportingDocumentFieldset {...p} />)
    const press = screen.getByRole('button', { name: 'Check link' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(p.onCheck).not.toHaveBeenCalled()

    rerender(<EstimateSupportingDocumentFieldset {...p} url="https://drive.example/a" />)
    expect((screen.getByRole('button', { name: 'Check link' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Check link' }))
    expect(p.onCheck).toHaveBeenCalledTimes(1)
  })

  it('says Checking… and waits while the check runs', () => {
    render(<EstimateSupportingDocumentFieldset {...props({ url: 'https://drive.example/a', checkStatus: 'loading' })} />)
    expect((screen.getByRole('button', { name: 'Checking…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws the check’s answer as a status, and a failure as an alert', () => {
    const { rerender } = render(<EstimateSupportingDocumentFieldset {...props({ url: 'https://drive.example/a', checkStatus: 'success', checkMessage: 'Works!' })} />)
    expect(screen.getByRole('status').textContent).toBe('Works!')
    rerender(<EstimateSupportingDocumentFieldset {...props({ url: 'https://drive.example/a', checkStatus: 'warn', checkMessage: 'Sign-in wall likely.' })} />)
    expect(screen.getByRole('status').textContent).toBe('Sign-in wall likely.')
    rerender(<EstimateSupportingDocumentFieldset {...props({ url: 'https://drive.example/a', checkStatus: 'error', checkMessage: 'Not signed in.' })} />)
    expect(screen.getByRole('alert').textContent).toBe('Not signed in.')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('draws no answer with no message', () => {
    render(<EstimateSupportingDocumentFieldset {...props({ checkStatus: 'success', checkMessage: '' })} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('How to share a file in Google Drive')).toBeTruthy()
  })
})
