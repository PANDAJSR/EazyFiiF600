import type { RefObject } from 'react'

type FileInputWithDirectory = HTMLInputElement & {
  webkitdirectory?: boolean
  directory?: boolean
}

export const openDomDirectoryPicker = (inputRef: RefObject<HTMLInputElement | null>) => {
  const el = inputRef.current as FileInputWithDirectory | null
  if (!el) {
    return
  }
  el.setAttribute('webkitdirectory', 'true')
  el.setAttribute('directory', 'true')
  el.click()
}
