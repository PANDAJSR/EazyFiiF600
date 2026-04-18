import { useEffect, useRef } from 'react'

type Params = {
  enabled?: boolean
  onSave: () => void
  onOpen: () => void
}

function useSaveOpenHotkey({ enabled = true, onSave, onOpen }: Params) {
  const onSaveRef = useRef(onSave)
  const onOpenRef = useRef(onOpen)

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      if (!isCmdOrCtrl) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 's') {
        event.preventDefault()
        onSaveRef.current()
      } else if (key === 'o') {
        event.preventDefault()
        onOpenRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])
}

export default useSaveOpenHotkey
