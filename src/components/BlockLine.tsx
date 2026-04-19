import { ColorPicker, Input, Select } from 'antd'
import type { ParsedBlock } from '../types/fii'
import { blockText, sanitizeBlockTextFieldInput } from './blockCanvasUtils'
import { COMMENT_BLOCK_TYPE } from '../utils/commentBlocks'

const TURN_DIRECTION_LABEL: Record<string, string> = { r: '右', l: '左' }

type Props = {
  block: ParsedBlock
  editable: boolean
  onFieldChange?: (blockId: string, fieldKey: string, value: string) => void
  onFieldBlur?: (blockId: string, fieldKey: string, value: string) => void
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>, blockId: string, fieldKey: string) => void
}

function BlockLine({ block, editable, onFieldChange, onFieldBlur, onInputKeyDown }: Props) {
  const text = blockText(block)
  const getInputWidth = (fieldKey: string, value: string) => {
    if (block.type === COMMENT_BLOCK_TYPE && fieldKey === 'content') {
      const content = value || ''
      const widthCh = Math.max(12, Math.min(60, content.length + 2))
      return `${widthCh}ch`
    }
    return 64
  }
  const getTextInputSlotIndex = (valueIndex: number) =>
    text.values
      .slice(0, valueIndex + 1)
      .filter((token) => token.fieldKey && (!token.inputType || token.inputType === 'text')).length - 1

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
                  inputMode={
                    value.fieldKey === 'time' ||
                    (block.type === COMMENT_BLOCK_TYPE && value.fieldKey === 'content')
                      ? undefined
                      : 'decimal'
                  }
                  draggable={false}
                  data-block-id={block.id}
                  data-field-key={value.fieldKey}
                  data-slot-index={getTextInputSlotIndex(idx)}
                  onDragStart={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onChange={(event) => {
                    const nextValue = sanitizeBlockTextFieldInput(block.type, value.fieldKey!, event.target.value)
                    onFieldChange(block.id, value.fieldKey!, nextValue)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      event.currentTarget.blur()
                      return
                    }
                    onInputKeyDown?.(event, block.id, value.fieldKey!)
                  }}
                  onBlur={(event) => {
                    onFieldBlur?.(block.id, value.fieldKey!, event.target.value)
                  }}
                  className="block-chip block-chip-value"
                  style={{ width: getInputWidth(value.fieldKey!, block.fields[value.fieldKey] ?? '') }}
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

export default BlockLine
