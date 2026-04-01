import { useEffect } from 'react'

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true
  }
  return target.isContentEditable
}

type Params = {
  enabled: boolean
  selectedBlockId?: string
  onOpen: (selectedBlockId: string) => void
}

function useSelectedBlockEnterHotkey({ enabled, selectedBlockId, onOpen }: Params) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) {
        return
      }
      if (!selectedBlockId || isEditableTarget(event.target)) {
        return
      }
      event.preventDefault()
      onOpen(selectedBlockId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onOpen, selectedBlockId])
}

export default useSelectedBlockEnterHotkey
