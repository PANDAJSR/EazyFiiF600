import type { ParsedBlock } from '../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../utils/autoDelayBlocks'

export type BlockFieldInputType = 'text' | 'select' | 'color'

export type BlockToken = {
  text: string
  value?: boolean
  titleLike?: boolean
  fieldKey?: string
  inputType?: BlockFieldInputType
  options?: string[]
}

const MOVE_BLOCK_TYPES = new Set(['Goertek_MoveToCoord2', 'Goertek_Move'])
const NUMERIC_TEXT_FIELDS = new Set([
  'Goertek_HorizontalSpeed:VH',
  'Goertek_HorizontalSpeed:AH',
  'Goertek_VerticalSpeed:VV',
  'Goertek_VerticalSpeed:AV',
  'block_delay:time',
  'Goertek_TakeOff2:alt',
  `${AUTO_DELAY_BLOCK_TYPE}:X`,
  `${AUTO_DELAY_BLOCK_TYPE}:Y`,
  `${AUTO_DELAY_BLOCK_TYPE}:Z`,
  'Goertek_MoveToCoord2:X',
  'Goertek_MoveToCoord2:Y',
  'Goertek_MoveToCoord2:Z',
  'Goertek_Move:X',
  'Goertek_Move:Y',
  'Goertek_Move:Z',
  'Goertek_Turn:angle',
])
const TIME_TEXT_FIELDS = new Set(['block_inittime:time'])

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

export const blockTheme: Record<string, { color: string; bg: string; border: string }> = {
  Goertek_Start: { color: '#17324d', bg: '#f1f7ff', border: '#adc3e3' },
  block_inittime: { color: '#17324d', bg: '#f1f7ff', border: '#adc3e3' },
  Goertek_HorizontalSpeed: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  Goertek_VerticalSpeed: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  Goertek_UnLock: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  block_delay: { color: '#17324d', bg: '#eaf3ff', border: '#9bb6de' },
  Goertek_TakeOff2: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  Goertek_MoveToCoord2: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  [AUTO_DELAY_BLOCK_TYPE]: { color: '#17324d', bg: '#e2fff2', border: '#89c7a7' },
  Goertek_Move: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  Goertek_Turn: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
  Goertek_Land: { color: '#17324d', bg: '#dfeeff', border: '#8fadd8' },
}

export const blockText = (block: ParsedBlock): { title: string; values: BlockToken[] } => {
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
    case AUTO_DELAY_BLOCK_TYPE:
      return {
        title: '平移到（自动延时）',
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
          token('自动延时'),
          token(f.time ?? '800', true),
          token('ms'),
        ],
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
    case 'Goertek_Turn':
      return {
        title: '转动（异步）',
        values: [
          token('向'),
          token(f.turnDirection ?? 'r', true, false, 'turnDirection', 'select', ['r', 'l']),
          token('转动'),
          token(f.angle ?? '90', true, false, 'angle'),
          token('度'),
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
    case 'Goertek_LEDTurnOnAllSingleColor2':
      return {
        title: '设置全部灯光颜色为',
        values: [token(f.color1 ?? '#ffffff', true, false, 'color1', 'color')],
      }
    default:
      return {
        title: block.type,
        values: Object.entries(f).flatMap(([k, v]) => [token(k), token(v, true, false, k)]),
      }
  }
}

export const sanitizeBlockTextFieldInput = (blockType: string, fieldKey: string, raw: string) => {
  const fieldId = `${blockType}:${fieldKey}`
  if (!NUMERIC_TEXT_FIELDS.has(fieldId) && !TIME_TEXT_FIELDS.has(fieldId)) {
    return raw
  }

  // 中文输入法误触 WASD 时先去掉字母，再按字段类型做白名单过滤。
  const withoutLetters = raw.replace(/[A-Za-z]/g, '')
  if (TIME_TEXT_FIELDS.has(fieldId)) {
    return withoutLetters.replace(/[^\d:]/g, '')
  }
  return withoutLetters.replace(/[^\d+\-.]/g, '')
}

export const groupBlocksByRow = (blocks: ParsedBlock[]): ParsedBlock[][] => {
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
