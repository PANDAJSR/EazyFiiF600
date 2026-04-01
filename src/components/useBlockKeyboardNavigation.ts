import { useEffect } from 'react'
import type { DroneProgram } from '../types/fii'

type Options = {
  selectedProgram?: DroneProgram
  selectedBlockId?: string
  onSelectBlock: (blockId: string) => void
  onDeleteBlock: (blockId: string) => void
}

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

function useBlockKeyboardNavigation({ selectedProgram, selectedBlockId, onSelectBlock, onDeleteBlock }: Options) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return
      }

      if (!selectedProgram?.blocks.length) {
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const currentIndex = selectedBlockId
          ? selectedProgram.blocks.findIndex((block) => block.id === selectedBlockId)
          : -1
        if (event.key === 'ArrowUp') {
          const prevIndex = currentIndex <= 0 ? selectedProgram.blocks.length - 1 : currentIndex - 1
          onSelectBlock(selectedProgram.blocks[prevIndex]?.id ?? selectedProgram.blocks[0].id)
          return
        }
        const nextIndex =
          currentIndex < 0 || currentIndex >= selectedProgram.blocks.length - 1 ? 0 : currentIndex + 1
        onSelectBlock(selectedProgram.blocks[nextIndex]?.id ?? selectedProgram.blocks[0].id)
        return
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedBlockId) {
        event.preventDefault()
        onDeleteBlock(selectedBlockId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDeleteBlock, onSelectBlock, selectedBlockId, selectedProgram])
}

export default useBlockKeyboardNavigation
