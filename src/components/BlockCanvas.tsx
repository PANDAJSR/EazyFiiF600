import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty } from 'antd'
import type { ParsedBlock } from '../types/fii'

type Props = {
  droneName?: string
  blocks: ParsedBlock[]
  highlightedBlockId?: string
  highlightPulse?: number
}

type BlockToken = {
  text: string
  value?: boolean
  titleLike?: boolean
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

const token = (text: string, value = false, titleLike = false): BlockToken => ({
  text,
  value,
  titleLike,
})

const blockText = (block: ParsedBlock): { title: string; values: BlockToken[] } => {
  const f = block.fields
  switch (block.type) {
    case 'Goertek_Start':
      return { title: '开始', values: [] }
    case 'block_inittime':
      return { title: '在时间', values: [token(f.time || '00:00', true), token('开始', false, true)] }
    case 'Goertek_HorizontalSpeed':
      return {
        title: '水平速度',
        values: [
          token('速度'),
          token(f.VH ?? '-', true),
          token('cm/s'),
          token('加速度'),
          token(f.AH ?? '-', true),
          token('cm/s²'),
        ],
      }
    case 'Goertek_VerticalSpeed':
      return {
        title: '垂直速度',
        values: [
          token('速度'),
          token(f.VV ?? '-', true),
          token('cm/s'),
          token('加速度'),
          token(f.AV ?? '-', true),
          token('cm/s²'),
        ],
      }
    case 'Goertek_UnLock':
      return { title: '解锁', values: [] }
    case 'block_delay':
      return { title: '延时', values: [token('ms'), token(f.time ?? '-', true)] }
    case 'Goertek_TakeOff2':
      return { title: '起飞', values: [token(f.alt ?? '-', true), token('cm')] }
    case 'Goertek_MoveToCoord2':
      return {
        title: '平移到（异步）',
        values: [
          token('X'),
          token(f.X ?? '-', true),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true),
          token('cm'),
        ],
      }
    case 'Goertek_Move':
      return {
        title: '相对平移（异步）',
        values: [
          token('X'),
          token(f.X ?? '-', true),
          token('cm'),
          token('Y'),
          token(f.Y ?? '-', true),
          token('cm'),
          token('Z'),
          token(f.Z ?? '-', true),
          token('cm'),
        ],
      }
    case 'Goertek_Land':
      return { title: '降落', values: [] }
    default:
      return {
        title: block.type,
        values: Object.entries(f).flatMap(([k, v]) => [token(k), token(v, true)]),
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

function BlockCanvas({ droneName, blocks, highlightedBlockId, highlightPulse }: Props) {
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
    setFlashRowId(rowId)
    const timer = window.setTimeout(() => setFlashRowId(undefined), 1300)
    return () => window.clearTimeout(timer)
  }, [highlightedBlockId, highlightPulse, rowKeyByBlockId])

  if (!blocks.length) {
    return (
      <div className="blocks-empty">
        <Empty description={droneName ? `${droneName} 暂无可展示积木` : '请先选择无人机'} />
      </div>
    )
  }

  const initTimeRowIndex = rows.findIndex((row) => row.some((block) => block.type === 'block_inittime'))
  const rowsBeforeIndented =
    initTimeRowIndex >= 0 ? rows.slice(0, initTimeRowIndex + 1) : rows
  const rowsIndented =
    initTimeRowIndex >= 0 ? rows.slice(initTimeRowIndex + 1) : []

  return (
    <div className="blocks-wrap">
      {rowsBeforeIndented.map((row, rowIndex) => (
        <div
          key={row[0].id}
          className={flashRowId === row[0].id ? 'block-row block-row-highlight' : 'block-row'}
        >
          {row.map((block, blockIndex) => {
            const text = blockText(block)
            const theme = blockTheme[block.type] ?? {
              color: '#17324d',
              bg: '#deefff',
              border: '#8db8e6',
            }

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
                      {text.values.map((value, idx) => (
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
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ))}
      {!!rowsIndented.length && (
        <div className="block-subflow">
          {rowsIndented.map((row, rowOffset) => {
            const rowIndex = initTimeRowIndex + 1 + rowOffset
            return (
              <div
                key={row[0].id}
                className={
                  flashRowId === row[0].id
                    ? 'block-row block-row-indented block-row-highlight'
                    : 'block-row block-row-indented'
                }
              >
                {row.map((block, blockIndex) => {
                  const text = blockText(block)
                  const theme = blockTheme[block.type] ?? {
                    color: '#17324d',
                    bg: '#deefff',
                    border: '#8db8e6',
                  }

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
                            {text.values.map((value, idx) => (
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
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BlockCanvas
