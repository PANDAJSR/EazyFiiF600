import { useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import type { ParsedBlock } from '../types/fii'
import { blockText } from './blockCanvasUtils'

type NavigationTarget = {
  blockId: string
  slotIndex: number
  rowIndex: number
  colIndex: number
  linearIndex: number
}

const NAV_KEYS = new Set(['w', 'a', 's', 'd'])

const slotKey = (blockId: string, slotIndex: number) => `${blockId}:${slotIndex}`

const getTextInputSlotCount = (block: ParsedBlock) =>
  blockText(block).values.filter((value) => value.fieldKey && value.inputType !== 'select' && value.inputType !== 'color').length

function useBlockInputNavigation(rows: ParsedBlock[][]) {
  const navigationMeta = useMemo(() => {
    const orderedSlots: NavigationTarget[] = []
    const slotMap = new Map<string, NavigationTarget>()
    const slotCountByBlockId = new Map<string, number>()
    let linearIndex = 0

    rows.forEach((row, rowIndex) => {
      row.forEach((block, colIndex) => {
        const slotCount = getTextInputSlotCount(block)
        slotCountByBlockId.set(block.id, slotCount)
        for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
          const slot = { blockId: block.id, slotIndex, rowIndex, colIndex, linearIndex }
          orderedSlots.push(slot)
          slotMap.set(slotKey(block.id, slotIndex), slot)
          linearIndex += 1
        }
      })
    })

    return { orderedSlots, slotMap, slotCountByBlockId }
  }, [rows])

  const focusSlot = useCallback((target: NavigationTarget | null) => {
    if (!target) {
      return
    }
    const input = document.querySelector<HTMLInputElement>(
      `input[data-block-id="${target.blockId}"][data-slot-index="${target.slotIndex}"]`,
    )
    if (!input) {
      return
    }
    input.focus()
    const cursorPos = input.value.length
    input.setSelectionRange(cursorPos, cursorPos)
  }, [])

  const findBlockInRow = useCallback(
    (targetRowIndex: number, preferredColIndex: number) => {
      const targetRow = rows[targetRowIndex]
      if (!targetRow?.length) {
        return null
      }

      for (let distance = 0; distance < targetRow.length; distance += 1) {
        const candidates = [preferredColIndex - distance, preferredColIndex + distance]
        for (const colIndex of candidates) {
          if (colIndex < 0 || colIndex >= targetRow.length) {
            continue
          }
          const block = targetRow[colIndex]
          const slotCount = navigationMeta.slotCountByBlockId.get(block.id) ?? 0
          if (slotCount > 0) {
            return { block, colIndex, slotCount }
          }
        }
      }

      return null
    },
    [navigationMeta.slotCountByBlockId, rows],
  )

  const getVerticalTarget = useCallback(
    (current: NavigationTarget, direction: -1 | 1) => {
      for (
        let targetRowIndex = current.rowIndex + direction;
        targetRowIndex >= 0 && targetRowIndex < rows.length;
        targetRowIndex += direction
      ) {
        const targetBlock = findBlockInRow(targetRowIndex, current.colIndex)
        if (!targetBlock) {
          continue
        }
        const nextSlotIndex = Math.min(current.slotIndex, targetBlock.slotCount - 1)
        return (
          navigationMeta.slotMap.get(slotKey(targetBlock.block.id, nextSlotIndex)) ?? {
            blockId: targetBlock.block.id,
            slotIndex: nextSlotIndex,
            rowIndex: targetRowIndex,
            colIndex: targetBlock.colIndex,
            linearIndex: -1,
          }
        )
      }
      return null
    },
    [findBlockInRow, navigationMeta.slotMap, rows.length],
  )

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, blockId: string, fieldKey: string) => {
      if (fieldKey === 'content') {
        return
      }
      const key = event.key.toLowerCase()
      if (!NAV_KEYS.has(key) || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      event.preventDefault()

      const currentSlotIndex = Number(event.currentTarget.dataset.slotIndex)
      if (Number.isNaN(currentSlotIndex)) {
        return
      }
      const current = navigationMeta.slotMap.get(slotKey(blockId, currentSlotIndex))
      if (!current) {
        return
      }

      if (key === 'a') {
        focusSlot(navigationMeta.orderedSlots[current.linearIndex - 1] ?? null)
        return
      }
      if (key === 'd') {
        focusSlot(navigationMeta.orderedSlots[current.linearIndex + 1] ?? null)
        return
      }
      if (key === 'w') {
        focusSlot(getVerticalTarget(current, -1))
        return
      }
      focusSlot(getVerticalTarget(current, 1))
    },
    [focusSlot, getVerticalTarget, navigationMeta.orderedSlots, navigationMeta.slotMap],
  )

  return { handleInputKeyDown }
}

export default useBlockInputNavigation
