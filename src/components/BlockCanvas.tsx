import { useEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker, Empty, Input, Select } from 'antd'
import type { ParsedBlock } from '../types/fii'

type BlockFieldInputType = 'text' | 'select' | 'color'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
  highlightedBlockId?: string
  highlightPulse?: number
  onFieldChange?: (blockId: string, fieldKey: string, value: string) => void
}

type BlockToken = {
  text: string
  value?: boolean
  titleLike?: boolean
  fieldKey?: string
  inputType?: BlockFieldInputType
  options?: string[]
}

const themeControl = { color: '#17324d', bg: '#eaf3ff', border: '#9bb6de' }
const themeAction = { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' }
const themeKey = { color: '#17324d', bg: '#f1f7ff', border: '#adc3e3' }

const blockTheme: Record<string, { color: string; bg: string; border: string }> = {
  Goertek_Start: themeKey,
  block_inittime: themeKey,
  Goertek_HorizontalSpeed: themeAction,
  Goertek_VerticalSpeed: themeAction,
  Goertek_UnLock: themeAction,
  block_delay: themeControl,
  Goertek_TakeOff2: themeAction,
  Goertek_MoveToCoord2: themeAction,
  Goertek_Move: themeAction,
  Goertek_Land: themeAction,
}

const MOVE_BLOCK_TYPES = new Set(['Goertek_MoveToCoord2', 'Goertek_Move'])

const token = (
  text: string,
  value = false,
  titleLike = false,
  fieldKey?: string,
  inputType: BlockFieldInputType = 'text',
  options?: string[],
): BlockToken => ({
  text,
  value,
  titleLike,
  fieldKey,
  inputType,
  options,
})

const blockText = (block: ParsedBlock): { title: string; values: BlockToken[] } => {
  const f = block.fields
  switch (block.type) {
    case 'Goertek_Start':
      return { title: '开始', values: [] }
    case 'block_inittime':
      return { title: '在时间', values: [token(f.time || '00:00', true, false, 'time'), token('开始', false, true)] }
    case 'Goertek_HorizontalSpeed':
      return {
        title: '水平速度',
        values: [
          token('速度'),
          token(f.VH ?? '-', true, false, 'VH'),
          token('cm/s'),
          token('加速度'),
          token(f.AH ?? '-', true, false, 'AH'),
          token('cm/s²'),
        ],
      }
    case 'Goertek_VerticalSpeed':
      return {
        title: '垂直速度',
        values: [
          token('速度'),
          token(f.VV ?? '-', true, false, 'VV'),
          token('cm/s'),
          token('加速度'),
          token(f.AV ?? '-', true, false, 'AV'),
          token('cm/s²'),
        ],
      }
    case 'Goertek_UnLock':
      return { title: '解锁', values: [] }
    case 'block_delay':
      return { title: '延时', values: [token('ms'), token(f.time ?? '-', true, false, 'time')] }
    case 'Goertek_TakeOff2':
      return {
        title: '起飞',
        values: [token('Z'), token(f.alt ?? '-', true, false, 'alt'), token('cm')],
      }
    case 'Goertek_MoveToCoord2':
      return {
        title: '平移到（异步）',
        values: [
          token('X'),
          token(f.X ?? '-', true, false, 'X'),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true, false, 'Y'),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true, false, 'Z'),
          token('cm'),
        ],
      }
    case 'Goertek_Move':
      return {
        title: '相对平移（异步）',
        values: [
          token('X'),
          token(f.X ?? '-', true, false, 'X'),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true, false, 'Y'),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true, false, 'Z'),
          token('cm'),
        ],
      }
    case 'Goertek_Land':
      return {
        title: '降落',
        values: [token('Z'), token('0', true), token('cm')],
      }
    case 'Goertek_LEDTurnOnAllSingleColor4':
      return {
        title: '设置电机',
        values: [
          token(f.motor ?? '1', true, false, 'motor', 'select', ['1', '2', '3', '4']),
          token('号灯光为'),
          token(f.color1 ?? '#ffffff', true, false, 'color1', 'color'),
        ],
      }
    default:
      return {
        title: block.type,
        values: Object.entries(f).flatMap(([k, v]) => [token(k), token(v, true, false, k)]),
      }
  }
}

const groupBlocksByRow = (blocks: ParsedBlock[]): ParsedBlock[][] => {
  const rows: ParsedBlock[][] = []

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index]
    const next = blocks[index + 1]

    if (MOVE_BLOCK_TYPES.has(current.type) && next?.type === 'block_delay') {
      rows.push([current, next])
      index += 1
      continue
    }

    rows.push([current])
  }

  return rows
}

function BlockCanvas({
  droneName,
  blocks,
  highlightedBlockId,
  highlightPulse,
  onFieldChange,
}: Props) {
  const blockRefs = useRef<Record<string, HTMLElement | null>>({})
  const [flashRowId, setFlashRowId] = useState<string>()
  const rows = useMemo(() => groupBlocksByRow(blocks), [blocks])
  const rowKeyByBlockId = useMemo(() => {
    const rowMap = new Map<string, string>()
    rows.forEach((row) => {
      const rowId = row[0].id
      row.forEach((block) => rowMap.set(block.id, rowId))
    })
    return rowMap
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

  const renderBlockCard = (block: ParsedBlock, classNames: string[]) => {
    const text = blockText(block)
    const theme = blockTheme[block.type] ?? {
      color: '#17324d',
      bg: '#deefff',
      border: '#8db8e6',
    }

    return (
      <section
        key={block.id}
        className={classNames.join(' ')}
        ref={(el) => {
          blockRefs.current[block.id] = el
        }}
        data-block-id={block.id}
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
                        options={(value.options ?? []).map((option) => ({ label: option, value: option }))}
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
