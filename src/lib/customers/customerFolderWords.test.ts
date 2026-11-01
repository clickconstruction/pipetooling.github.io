import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { CUSTOMER_FOLDER_LATER_WORDS, customerFolderDoor } from './customerFolderWords'

describe('customerFolderDoor', () => {
  it('opens a Drive folder link by its id, whatever came after it', () => {
    expect(customerFolderDoor('https://drive.google.com/drive/folders/1thXqFTZBJttlX4wMz8UFspkp68MMQpUk?usp=sharing')).toEqual({ kind: 'open', url: 'https://drive.google.com/drive/folders/1thXqFTZBJttlX4wMz8UFspkp68MMQpUk' })
    expect(customerFolderDoor('https://drive.google.com/drive/u/0/folders/1thXqFTZBJttlX4wMz8UFspkp68MMQpUk')).toEqual({ kind: 'open', url: 'https://drive.google.com/drive/folders/1thXqFTZBJttlX4wMz8UFspkp68MMQpUk' })
  })

  it('says what makes the folder when there is none, or the link is not a Drive folder', () => {
    expect(customerFolderDoor(null)).toEqual({ kind: 'none', words: CUSTOMER_FOLDER_LATER_WORDS })
    expect(customerFolderDoor('')).toEqual({ kind: 'none', words: CUSTOMER_FOLDER_LATER_WORDS })
    expect(customerFolderDoor('https://example.com/folder')).toEqual({ kind: 'none', words: CUSTOMER_FOLDER_LATER_WORDS })
    expect(plainWordsFailures(CUSTOMER_FOLDER_LATER_WORDS)).toEqual([])
  })
})
