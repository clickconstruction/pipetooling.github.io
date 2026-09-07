import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_ATTACHMENT_LABEL_MAX_LEN,
  CUSTOMER_ATTACHMENT_URL_MAX_LEN,
  googleDrivePreviewEmbedUrl,
  normalizeCustomerAttachmentDraftForDb,
  normalizeCustomerAttachmentLabel,
  normalizeCustomerAttachmentUrl,
  parseCustomerAttachmentSent,
} from './estimateCustomerAttachment'

describe('normalizeCustomerAttachmentUrl', () => {
  it('accepts only https URLs within the length cap, trimmed', () => {
    expect(normalizeCustomerAttachmentUrl(' https://drive.google.com/file/d/abc/view ')).toBe('https://drive.google.com/file/d/abc/view')
    expect(normalizeCustomerAttachmentUrl('http://example.com/x.pdf')).toBeNull()
    expect(normalizeCustomerAttachmentUrl('ftp://example.com/x.pdf')).toBeNull()
    expect(normalizeCustomerAttachmentUrl('not a url')).toBeNull()
    expect(normalizeCustomerAttachmentUrl('')).toBeNull()
    expect(normalizeCustomerAttachmentUrl(null)).toBeNull()
    expect(normalizeCustomerAttachmentUrl(`https://e.com/${'a'.repeat(CUSTOMER_ATTACHMENT_URL_MAX_LEN)}`)).toBeNull()
  })
})

describe('labels and the DB draft', () => {
  it('trims and caps the label, null when blank', () => {
    expect(normalizeCustomerAttachmentLabel('  Plans  ')).toBe('Plans')
    expect(normalizeCustomerAttachmentLabel('   ')).toBeNull()
    expect(normalizeCustomerAttachmentLabel('x'.repeat(CUSTOMER_ATTACHMENT_LABEL_MAX_LEN + 5))).toHaveLength(CUSTOMER_ATTACHMENT_LABEL_MAX_LEN)
  })
  it('a label without a valid URL is dropped', () => {
    expect(normalizeCustomerAttachmentDraftForDb('https://e.com/a.pdf', ' Plans ')).toEqual({ url: 'https://e.com/a.pdf', label: 'Plans' })
    expect(normalizeCustomerAttachmentDraftForDb('http://e.com/a.pdf', 'Plans')).toEqual({ url: null, label: null })
    expect(normalizeCustomerAttachmentDraftForDb('', '')).toEqual({ url: null, label: null })
  })
})

describe('parseCustomerAttachmentSent', () => {
  it('reads a stored payload and rejects anything without a valid https url', () => {
    expect(parseCustomerAttachmentSent({ url: 'https://e.com/a.pdf', label: ' Plans ' })).toEqual({ url: 'https://e.com/a.pdf', label: 'Plans' })
    expect(parseCustomerAttachmentSent({ url: 'https://e.com/a.pdf' })).toEqual({ url: 'https://e.com/a.pdf', label: null })
    expect(parseCustomerAttachmentSent({ url: 'http://e.com/a.pdf', label: 'x' })).toBeNull()
    expect(parseCustomerAttachmentSent({ label: 'x' })).toBeNull()
    expect(parseCustomerAttachmentSent(null)).toBeNull()
    expect(parseCustomerAttachmentSent([])).toBeNull()
    expect(parseCustomerAttachmentSent('https://e.com/a.pdf')).toBeNull()
  })
})

describe('googleDrivePreviewEmbedUrl', () => {
  it('turns a Drive file link or open?id= link into the preview embed', () => {
    expect(googleDrivePreviewEmbedUrl('https://drive.google.com/file/d/1AbC_x-9/view?usp=sharing')).toBe('https://drive.google.com/file/d/1AbC_x-9/preview')
    expect(googleDrivePreviewEmbedUrl('https://drive.google.com/open?id=1AbC_x-9')).toBe('https://drive.google.com/file/d/1AbC_x-9/preview')
    expect(googleDrivePreviewEmbedUrl('https://docs.google.com/file/d/ZZZ/edit')).toBe('https://drive.google.com/file/d/ZZZ/preview')
  })
  it('returns null for non-Drive links, a bad id, or garbage', () => {
    expect(googleDrivePreviewEmbedUrl('https://example.com/doc.pdf')).toBeNull()
    expect(googleDrivePreviewEmbedUrl('https://drive.google.com/open?id=bad id')).toBeNull()
    expect(googleDrivePreviewEmbedUrl('https://drive.google.com/drive/folders/abc')).toBeNull()
    expect(googleDrivePreviewEmbedUrl('nope')).toBeNull()
  })
})
