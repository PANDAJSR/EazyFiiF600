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
  onReorderBlocks?: (nextBlocks: ParsedBlock[]) => void
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
  onReorderBlocks,
}: Props) {
  const blockRefs = useRef<Record<string, HTMLElement | null>>({})
  const transparentDragImageRef = useRef<HTMLCanvasElement | null>(null)
  const dropMarkerRef = useRef<HTMLDivElement | null>(null)
  const [flashRowId, setFlashRowId] = useState<string>()
  const [draggingBlockId, setDraggingBlockId] = useState<string>()
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number }>()
  const [dropHint, setDropHint] = useState<{ targetId: string; position: 'before' | 'after' }>()
  const draggingBlock = useMemo(
    () => (draggingBlockId ? blocks.find((item) => item.id === draggingBlockId) : undefined),
    [blocks, draggingBlockId],
  )

  const rows = useMemo(() => groupBlocksByRow(blocks), [blocks])
  const rowKeyByBlockId = useMemo(() => {
    const rowMap = new Map<string, string>()
    rows.forEach((row) => {
      const rowId = row[0].id
      row.forEach((block) => rowMap.set(block.id, rowId))
    })
    return rowMap
  }, [rows])

  useLayoutEffect(() => {
    const marker = dropMarkerRef.current
    if (!marker) {
      return
    }
    if (!dropHint) {
      marker.style.display = 'none'
      return
    }
    const target = blockRefs.current[dropHint.targetId]
    if (!target) {
      marker.style.display = 'none'
      return
    }
    const rect = target.getBoundingClientRect()
    marker.style.display = 'block'
    marker.style.top = `${dropHint.position === 'before' ? rect.top : rect.bottom}px`
    marker.style.left = `${rect.left}px`
    marker.style.width = `${rect.width}px`
  }, [dropHint, rows])

  useEffect(() => {
    if (!draggingBlockId) {
      return
    }
    const handleDragOver = (event: DragEvent) => {
      if (event.clientX || event.clientY) {
        setDragCursor({ x: event.clientX, y: event.clientY })
      }
    }
    window.addEventListener('dragover', handleDragOver)
    return () => window.removeEventListener('dragover', handleDragOver)
  }, [draggingBlockId])

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
          if (!transparentDragImageRef.current) {
            const canvas = document.createElement('canvas')
            canvas.width = 1
            canvas.height = 1
            transparentDragImageRef.current = canvas
          }
          event.dataTransfer.setDragImage(transparentDragImageRef.current, 0, 0)
          setDraggingBlockId(block.id)
          setDragCursor({ x: event.clientX, y: event.clientY })
          setDropHint(undefined)
          onSelectBlock?.(block.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragCursor({ x: event.clientX, y: event.clientY })
          if (!draggingBlockId || draggingBlockId === block.id) {
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          setDropHint({ targetId: block.id, position })
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (!draggingBlockId) {
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          const next = draggingBlockId === block.id ? blocks : reorderBlocks(blocks, draggingBlockId, block.id, position)
          onReorderBlocks?.(next)
        }}
        onDragEnd={() => {
          setDraggingBlockId(undefined)
          setDragCursor(undefined)
          setDropHint(undefined)
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
      {!!draggingBlock && !!dragCursor && (
        <div className="block-drag-follow" style={{ left: `${dragCursor.x + 12}px`, top: `${dragCursor.y + 12}px` }}>
          {blockText(draggingBlock).title}
        </div>
      )}
      <div ref={dropMarkerRef} className="block-drop-marker" />
    </div>
  )
}

export default BlockCanvas
