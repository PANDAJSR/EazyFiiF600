import type { ParsedBlock } from '../types/fii'

export const reorderBlocks = (
  blocks: ParsedBlock[],
  dragId: string,
  targetId: string,
  position: 'before' | 'after',
) => {
  if (dragId === targetId) {
    return blocks
  }

  const dragIndex = blocks.findIndex((block) => block.id === dragId)
  const targetIndex = blocks.findIndex((block) => block.id === targetId)
  if (dragIndex < 0 || targetIndex < 0) {
    return blocks
  }

  const next = [...blocks]
  const [dragBlock] = next.splice(dragIndex, 1)
  const adjustedTargetIndex = next.findIndex((block) => block.id === targetId)
  if (adjustedTargetIndex < 0) {
    return blocks
  }

  const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1
  next.splice(insertIndex, 0, dragBlock)
  return next
}
