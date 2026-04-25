import { useEffect } from 'react'
import type { DroneProgram } from '../types/fii'

type Options = {
  selectedProgram?: DroneProgram
  selectedBlockIds?: string[]
  onSelectBlock: (blockId: string) => void
  onDeleteBlock?: (blockId: string) => void
  onDeleteBlocks?: (blockIds: string[]) => void
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

function useBlockKeyboardNavigation({ selectedProgram, selectedBlockIds, onSelectBlock, onDeleteBlock, onDeleteBlocks }: Options) {
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
        const currentIndex = selectedBlockIds?.length
          ? selectedProgram.blocks.findIndex((block) => block.id === selectedBlockIds[0])
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

      if ((event.key === 'Backspace' || event.key === 'Delete') && selectedBlockIds?.length) {
        event.preventDefault()
        if (selectedBlockIds.length > 1 && onDeleteBlocks) {
          onDeleteBlocks(selectedBlockIds)
        } else if (onDeleteBlock) {
          onDeleteBlock(selectedBlockIds[0])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDeleteBlock, onDeleteBlocks, onSelectBlock, selectedBlockIds, selectedProgram])
}

export default useBlockKeyboardNavigation
