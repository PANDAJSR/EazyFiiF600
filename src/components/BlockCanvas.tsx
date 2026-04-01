import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { ColorPicker, Empty, Input, Select } from 'antd'
import type { ParsedBlock } from '../types/fii'
import { blockText, blockTheme, groupBlocksByRow, sanitizeBlockTextFieldInput } from './blockCanvasUtils'
import { reorderBlocks } from '../utils/blockOrder'
import useBlockInputNavigation from './useBlockInputNavigation'
import BlockInsertPicker from './BlockInsertPicker'
import type { InsertableBlockDefinition } from './blockInsertCatalog'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
  highlightedBlockId?: string
  selectedBlockId?: string
  highlightPulse?: number
  onFieldChange?: (blockId: string, fieldKey: string, value: string) => void
  onSelectBlock?: (blockId?: string) => void
  onDeleteBlock?: (blockId: string) => void
  onReorderBlocks?: (nextBlocks: ParsedBlock[]) => void
  insertPickerOpen?: boolean
  insertPickerItems?: InsertableBlockDefinition[]
  onInsertPickerCancel?: () => void
  onInsertPickerSubmit?: (item: InsertableBlockDefinition) => void
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
  insertPickerOpen,
  insertPickerItems,
  onInsertPickerCancel,
  onInsertPickerSubmit,
}: Props) {
  const handleWrapMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    if (target.closest('[data-block-id]') || target.closest('.block-insert-picker')) {
      return
    }
    onSelectBlock?.(undefined)
  }

  const blockRefs = useRef<Record<string, HTMLElement | null>>({})
  const transparentDragImageRef = useRef<HTMLImageElement | null>(null)
  const dropMarkerRef = useRef<HTMLDivElement | null>(null)
  const dragFollowRef = useRef<HTMLDivElement | null>(null)
  const [flashRowId, setFlashRowId] = useState<string>()
  const [draggingBlockId, setDraggingBlockId] = useState<string>()
  const draggingBlock = useMemo(
    () => (draggingBlockId ? blocks.find((item) => item.id === draggingBlockId) : undefined),
    [blocks, draggingBlockId],
  )

  const rows = useMemo(() => groupBlocksByRow(blocks), [blocks])
  const { handleInputKeyDown } = useBlockInputNavigation(rows)
  const rowKeyByBlockId = useMemo(() => {
    const rowMap = new Map<string, string>()
    rows.forEach((row) => {
      const rowId = row[0].id
      row.forEach((block) => rowMap.set(block.id, rowId))
    })
    return rowMap
  }, [rows])

  const moveDragFollow = (x: number, y: number) => {
    const follow = dragFollowRef.current
    if (!follow) {
      return
    }
    follow.style.display = 'block'
    follow.style.left = `${x + 12}px`
    follow.style.top = `${y + 12}px`
  }

  const resetDragState = () => {
    setDraggingBlockId(undefined)
    if (dropMarkerRef.current) {
      dropMarkerRef.current.style.display = 'none'
    }
    if (dragFollowRef.current) {
      dragFollowRef.current.style.display = 'none'
    }
  }

  useEffect(() => {
    if (!draggingBlockId) {
      return
    }
    const handleDragOver = (event: DragEvent) => {
      if (event.clientX || event.clientY) {
        moveDragFollow(event.clientX, event.clientY)
      }
    }
    const handleGlobalDragEnd = () => resetDragState()
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragend', handleGlobalDragEnd, true)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragend', handleGlobalDragEnd, true)
    }
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

  const renderBlockLine = (block: ParsedBlock, editable: boolean) => {
    const text = blockText(block)
    let textInputSlotIndex = -1
    return (
      <div className="block-line">
        <span className="block-title">{text.title}</span>
        {!!text.values.length && (
          <div className="block-values">
            {text.values.map((value, idx) => {
              if (value.fieldKey && onFieldChange && editable) {
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
                        label: value.fieldKey === 'turnDirection' ? (TURN_DIRECTION_LABEL[option] ?? option) : option,
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
                    inputMode={value.fieldKey === 'time' ? undefined : 'decimal'}
                    data-block-id={block.id}
                    data-slot-index={(textInputSlotIndex += 1)}
                    onChange={(event) => {
                      const nextValue = sanitizeBlockTextFieldInput(block.type, value.fieldKey!, event.target.value)
                      onFieldChange(block.id, value.fieldKey!, nextValue)
                    }}
                    onKeyDown={(event) => {
                      handleInputKeyDown(event, block.id)
                    }}
                    className="block-chip block-chip-value"
                    style={{ width: 64 }}
                  />
                )
              }

              if (value.fieldKey && !editable) {
                const raw = block.fields[value.fieldKey] ?? value.text
                const textValue = value.fieldKey === 'turnDirection' ? (TURN_DIRECTION_LABEL[raw] ?? raw) : raw
                return (
                  <span key={`${block.id}-${idx}`} className="block-chip block-chip-value">
                    {textValue}
                  </span>
                )
              }

              return (
                <span
                  key={`${block.id}-${idx}`}
                  className={['block-chip', value.value ? 'block-chip-value' : '', value.titleLike ? 'block-chip-title-like' : '']
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
    )
  }

  const renderBlockCard = (block: ParsedBlock, classNames: string[]) => {
    const theme = blockTheme[block.type] ?? {
      color: '#17324d',
      bg: '#deefff',
      border: '#8db8e6',
    }

    if (selectedBlockId === block.id) {
      classNames.push('block-card-selected')
    }
    const cardNode = (
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
          event.dataTransfer.clearData()
          event.dataTransfer.setData('application/x-eazyfii-block-id', block.id)
          if (!transparentDragImageRef.current) {
            const image = new Image()
            image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
            transparentDragImageRef.current = image
          }
          event.dataTransfer.setDragImage(transparentDragImageRef.current, 0, 0)
          setDraggingBlockId(block.id)
          moveDragFollow(event.clientX, event.clientY)
          if (dropMarkerRef.current) {
            dropMarkerRef.current.style.display = 'none'
          }
          onSelectBlock?.(block.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          moveDragFollow(event.clientX, event.clientY)
          if (!draggingBlockId || draggingBlockId === block.id) {
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          if (dropMarkerRef.current) {
            dropMarkerRef.current.style.display = 'block'
            dropMarkerRef.current.style.top = `${position === 'before' ? rect.top : rect.bottom}px`
            dropMarkerRef.current.style.left = `${rect.left}px`
            dropMarkerRef.current.style.width = `${rect.width}px`
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (!draggingBlockId) {
            resetDragState()
            return
          }
          const rect = event.currentTarget.getBoundingClientRect()
          const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          const next = draggingBlockId === block.id ? blocks : reorderBlocks(blocks, draggingBlockId, block.id, position)
          onReorderBlocks?.(next)
          resetDragState()
        }}
        onDragEnd={() => {
          resetDragState()
        }}
        style={{
          color: theme.color,
          background: theme.bg,
          borderColor: theme.border,
        }}
      >
        {renderBlockLine(block, true)}
      </section>
    )

    if (!(insertPickerOpen && selectedBlockId === block.id && insertPickerItems && onInsertPickerCancel && onInsertPickerSubmit)) {
      return cardNode
    }

    return (
      <div key={`${block.id}-insert-wrap`} className="block-insert-anchor">
        {cardNode}
        <BlockInsertPicker items={insertPickerItems} onCancel={onInsertPickerCancel} onSubmit={onInsertPickerSubmit} />
      </div>
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
    <div className="blocks-wrap" onMouseDown={handleWrapMouseDown}>
      {renderRows(rowsBeforeIndented, 'block-row')}
      {!!rowsIndented.length && (
        <div className="block-subflow">
          {renderRows(rowsIndented, 'block-row block-row-indented', initTimeRowIndex + 1)}
        </div>
      )}
      {!!draggingBlock && (
        <div ref={dragFollowRef} className="block-drag-follow">
          <section
            className="block-card block-drag-follow-card"
            style={{
              color: (blockTheme[draggingBlock.type] ?? { color: '#17324d' }).color,
              background: (blockTheme[draggingBlock.type] ?? { bg: '#deefff' }).bg,
              borderColor: (blockTheme[draggingBlock.type] ?? { border: '#8db8e6' }).border,
            }}
          >
            {renderBlockLine(draggingBlock, false)}
          </section>
        </div>
      )}
      <div ref={dropMarkerRef} className="block-drop-marker" />
    </div>
  )
}

export default BlockCanvas
