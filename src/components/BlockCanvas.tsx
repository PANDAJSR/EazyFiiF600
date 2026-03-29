import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker, Empty, Input, Select } from 'antd'
import type { ParsedBlock } from '../types/fii'
import { blockText, blockTheme, groupBlocksByRow } from './blockCanvasUtils'
import { reorderBlocks } from '../utils/blockOrder'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
  highlightedBlockId?: string
  selectedBlockId?: string
  highlightPulse?: number
  onFieldChange?: (blockId: string, fieldKey: string, value: string) => void
  onSelectBlock?: (blockId: string) => void
  onDeleteBlock?: (blockId: string) => void
  onMoveBlock?: (dragId: string, targetId: string, position: 'before' | 'after') => void
}

const TURN_DIRECTION_LABEL: Record<string, string> = { r: '右', l: '左' }

function BlockCanvas({
  droneName,
  blocks,
  highlightedBlockId,
  selectedBlockId,
  highlightPulse,
  onFieldChange,
  onSelectBlock,
  onDeleteBlock,
  onMoveBlock,
}: Props) {
  const blockRefs = useRef<Record<string, HTMLElement | null>>({})
  const prevTopByBlockIdRef = useRef<Record<string, number>>({})
  const firstLayoutMeasuredRef = useRef(false)
  const [flashRowId, setFlashRowId] = useState<string>()
  const [draggingBlockId, setDraggingBlockId] = useState<string>()
  const [dropHint, setDropHint] = useState<{ targetId: string; position: 'before' | 'after' }>()
  const [previewBlocks, setPreviewBlocks] = useState<ParsedBlock[] | null>(null)

  const displayBlocks = previewBlocks ?? blocks

  const rows = useMemo(() => groupBlocksByRow(displayBlocks), [displayBlocks])
  const rowKeyByBlockId = useMemo(() => {
    const rowMap = new Map<string, string>()
    rows.forEach((row) => {
      const rowId = row[0].id
      row.forEach((block) => rowMap.set(block.id, rowId))
    })
    return rowMap
  }, [rows])

  useLayoutEffect(() => {
    const nextTopByBlockId: Record<string, number> = {}
    Object.entries(blockRefs.current).forEach(([blockId, element]) => {
      if (!element) {
        return
      }
      nextTopByBlockId[blockId] = element.getBoundingClientRect().top
    })

    if (!firstLayoutMeasuredRef.current) {
      prevTopByBlockIdRef.current = nextTopByBlockId
      firstLayoutMeasuredRef.current = true
      return
    }

    Object.entries(nextTopByBlockId).forEach(([blockId, nextTop]) => {
      const prevTop = prevTopByBlockIdRef.current[blockId]
      const element = blockRefs.current[blockId]
      if (!element || prevTop === undefined) {
        return
      }

      const deltaY = prevTop - nextTop
      if (Math.abs(deltaY) < 1) {
        return
      }

      element.style.transition = 'none'
      element.style.transform = `translateY(${deltaY}px)`
      // Force reflow before starting transition, so we can animate from old location to new location.
      void element.offsetHeight
      element.style.transition = 'transform 180ms ease'
      element.style.transform = ''
      window.setTimeout(() => {
        if (blockRefs.current[blockId] === element) {
          element.style.transition = ''
        }
      }, 220)
    })

    prevTopByBlockIdRef.current = nextTopByBlockId
  }, [rows])

  useEffect(() => {
    if (!highlightedBlockId) {
      return
    }
    const target = blockRefs.current[highlightedBlockId]
    if (!target) {
      return
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [highlightedBlockId, highlightPulse])

  useEffect(() => {
    if (!highlightedBlockId) {
      return
    }
    const rowId = rowKeyByBlockId.get(highlightedBlockId)
    if (!rowId) {
      return
    }
    let rafId2 = 0
    const rafId1 = window.requestAnimationFrame(() => {
      setFlashRowId(undefined)
      rafId2 = window.requestAnimationFrame(() => setFlashRowId(rowId))
    })
    const timer = window.setTimeout(() => setFlashRowId(undefined), 1300)
    return () => {
      window.cancelAnimationFrame(rafId1)
      window.cancelAnimationFrame(rafId2)
      window.clearTimeout(timer)
    }
  }, [highlightedBlockId, highlightPulse, rowKeyByBlockId])

  const updateDropHint = (event: React.DragEvent<HTMLElement>, targetId: string) => {
    if (!draggingBlockId || draggingBlockId === targetId) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropHint({ targetId, position })
  }

  const renderBlockCard = (block: ParsedBlock, classNames: string[]) => {
    const text = blockText(block)
    const theme = blockTheme[block.type] ?? {
      color: '#17324d',
      bg: '#deefff',
      border: '#8db8e6',
    }

    if (selectedBlockId === block.id) {
      classNames.push('block-card-selected')
    }
    if (draggingBlockId === block.id) {
      classNames.push('block-card-dragging')
    }
    if (dropHint?.targetId === block.id) {
      classNames.push(dropHint.position === 'before' ? 'block-card-drop-before' : 'block-card-drop-after')
    }

    return (
      <section
        key={block.id}
        className={classNames.join(' ')}
        ref={(el) => {
          blockRefs.current[block.id] = el
        }}
        data-block-id={block.id}
        draggable
        onClick={() => onSelectBlock?.(block.id)}
        onContextMenu={(event) => {
          event.preventDefault()
          onDeleteBlock?.(block.id)
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', block.id)
          setDraggingBlockId(block.id)
          setDropHint(undefined)
          setPreviewBlocks(blocks)
          onSelectBlock?.(block.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          updateDropHint(event, block.id)
          const rect = event.currentTarget.getBoundingClientRect()
          const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          setPreviewBlocks((prev) => {
            if (!draggingBlockId || draggingBlockId === block.id) {
              return prev
            }
            const source = prev ?? blocks
            return reorderBlocks(source, draggingBlockId, block.id, position)
          })
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (!draggingBlockId || draggingBlockId === block.id || !dropHint || dropHint.targetId !== block.id) {
            return
          }
          onMoveBlock?.(draggingBlockId, dropHint.targetId, dropHint.position)
        }}
        onDragEnd={() => {
          setDraggingBlockId(undefined)
          setDropHint(undefined)
          setPreviewBlocks(null)
        }}
        style={{
          color: theme.color,
          background: theme.bg,
          borderColor: theme.border,
        }}
      >
        <div className="block-line">
          <span className="block-title">{text.title}</span>
          {!!text.values.length && (
            <div className="block-values">
              {text.values.map((value, idx) => {
                if (value.fieldKey && onFieldChange) {
                  if (value.inputType === 'select') {
                    return (
                      <Select
                        key={`${block.id}-${idx}`}
                        size="small"
                        value={block.fields[value.fieldKey] ?? value.options?.[0]}
                        onChange={(nextValue) => {
                          onFieldChange(block.id, value.fieldKey!, nextValue)
                        }}
                        options={(value.options ?? []).map((option) => ({
                          label:
                            value.fieldKey === 'turnDirection' ? (TURN_DIRECTION_LABEL[option] ?? option) : option,
                          value: option,
                        }))}
                        className="block-chip block-chip-value"
                        style={{ width: 84 }}
                      />
                    )
                  }

                  if (value.inputType === 'color') {
                    return (
                      <ColorPicker
                        key={`${block.id}-${idx}`}
                        size="small"
                        format="hex"
                        disabledFormat
                        showText
                        value={block.fields[value.fieldKey] ?? value.text}
                        onChangeComplete={(nextColor) => {
                          onFieldChange(block.id, value.fieldKey!, nextColor.toHexString().toLowerCase())
                        }}
                        className="block-chip block-chip-value"
                      />
                    )
                  }

                  return (
                    <Input
                      key={`${block.id}-${idx}`}
                      size="small"
                      value={block.fields[value.fieldKey] ?? ''}
                      onChange={(event) => {
                        onFieldChange(block.id, value.fieldKey!, event.target.value)
                      }}
                      className="block-chip block-chip-value"
                      style={{ width: 64 }}
                    />
                  )
                }

                return (
                  <span
                    key={`${block.id}-${idx}`}
                    className={[
                      'block-chip',
                      value.value ? 'block-chip-value' : '',
                      value.titleLike ? 'block-chip-title-like' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {value.text}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </section>
    )
  }

  const renderRows = (renderRowsList: ParsedBlock[][], rowClassName: string, startRowIndex = 0) => {
    return renderRowsList.map((row, rowOffset) => {
      const rowIndex = startRowIndex + rowOffset
      const rowId = row[0].id

      return (
        <div
          key={rowId}
          className={
            flashRowId === rowId
              ? `${rowClassName} block-row-highlight ${(highlightPulse ?? 0) % 2 === 0 ? 'block-row-highlight-a' : 'block-row-highlight-b'}`
              : rowClassName
          }
        >
          {row.map((block, blockIndex) => {
            const classNames = ['block-card']
            if (blockIndex === 0 && rowIndex > 0) {
              classNames.push('block-card-stack-top')
            }
            if (blockIndex === 0 && rowIndex < rows.length - 1) {
              classNames.push('block-card-stack-bottom')
            }
            if (row.length > 1 && blockIndex === 0) {
              classNames.push('block-card-join-right')
            }
            if (row.length > 1 && blockIndex === row.length - 1) {
              classNames.push('block-card-join-left')
            }
            return renderBlockCard(block, classNames)
          })}
        </div>
      )
    })
  }

  if (!blocks.length) {
    return (
      <div className="blocks-empty">
        <Empty description={droneName ? `${droneName} 暂无可展示积木` : '请先选择无人机'} />
      </div>
    )
  }

  const initTimeRowIndex = rows.findIndex((row) => row.some((block) => block.type === 'block_inittime'))
  const rowsBeforeIndented = initTimeRowIndex >= 0 ? rows.slice(0, initTimeRowIndex + 1) : rows
  const rowsIndented = initTimeRowIndex >= 0 ? rows.slice(initTimeRowIndex + 1) : []

  return (
    <div className="blocks-wrap">
      {renderRows(rowsBeforeIndented, 'block-row')}
      {!!rowsIndented.length && (
        <div className="block-subflow">
          {renderRows(rowsIndented, 'block-row block-row-indented', initTimeRowIndex + 1)}
        </div>
      )}
    </div>
  )
}

export default BlockCanvas
