import type { ParseResult, ParsedBlock } from '../types/fii'

const ROUNDABLE_NUMERIC_FIELDS = new Set([
  'Goertek_HorizontalSpeed:VH',
  'Goertek_HorizontalSpeed:AH',
  'Goertek_VerticalSpeed:VV',
  'Goertek_VerticalSpeed:AV',
  'block_delay:time',
  'Goertek_TakeOff2:alt',
  'Goertek_MoveToCoord2:X',
  'Goertek_MoveToCoord2:Y',
  'Goertek_MoveToCoord2:Z',
  'Goertek_Move:X',
  'Goertek_Move:Y',
  'Goertek_Move:Z',
  'Goertek_Turn:angle',
  'Goertek_TurnTo:angle',
  'custom_auto_delay_move:X',
  'custom_auto_delay_move:Y',
  'custom_auto_delay_move:Z',
  'custom_auto_delay_move:time',
])

const toFiniteNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeRoundedValue = (blockType: string, fieldKey: string, value: string) => {
  const parsed = toFiniteNumber(value)
  if (parsed === null) {
    return value
  }

  let rounded = Math.round(parsed)
  if (blockType === 'Goertek_TurnTo' && fieldKey === 'angle') {
    rounded = Math.min(359, Math.max(0, rounded))
  } else if (blockType === 'Goertek_Turn' && fieldKey === 'angle') {
    rounded = Math.min(360, Math.max(0, rounded))
  } else if (blockType === 'block_delay' && fieldKey === 'time') {
    rounded = Math.max(0, rounded)
  }
  return String(rounded)
}

const normalizeBlockFieldsForSave = (block: ParsedBlock): ParsedBlock => {
  let changed = false
  const nextFields: Record<string, string> = {}

  Object.entries(block.fields).forEach(([fieldKey, rawValue]) => {
    const fieldId = `${block.type}:${fieldKey}`
    if (!ROUNDABLE_NUMERIC_FIELDS.has(fieldId)) {
      nextFields[fieldKey] = rawValue
      return
    }
    const normalized = normalizeRoundedValue(block.type, fieldKey, rawValue)
    nextFields[fieldKey] = normalized
    if (normalized !== rawValue) {
      changed = true
    }
  })

  if (!changed) {
    return block
  }
  return {
    ...block,
    fields: nextFields,
  }
}

export const normalizeResultForSave = (result: ParseResult): ParseResult => {
  let changed = false
  const nextPrograms = result.programs.map((program) => {
    let programChanged = false
    const nextBlocks = program.blocks.map((block) => {
      const normalized = normalizeBlockFieldsForSave(block)
      if (normalized !== block) {
        programChanged = true
      }
      return normalized
    })
    if (!programChanged) {
      return program
    }
    changed = true
    return {
      ...program,
      blocks: nextBlocks,
    }
  })

  if (!changed) {
    return result
  }
  return {
    ...result,
    programs: nextPrograms,
  }
}
