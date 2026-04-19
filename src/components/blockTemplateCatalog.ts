import type { ParsedBlock } from '../types/fii'
import type { RodConfig } from './trajectory/rodConfig'
import { createInsertedBlockByType } from './blockInsertCatalog'
import { AUTO_DELAY_BLOCK_TYPE } from '../utils/autoDelayBlocks'

export const SUBJECT1_SQUARE_STABLE_TEMPLATE_ID = 'subject1_square_stable'

export type InsertableTemplateDefinition = {
  id: string
  label: string
  keywords: string[]
  description: string
}

export const INSERTABLE_TEMPLATES: InsertableTemplateDefinition[] = [
  {
    id: SUBJECT1_SQUARE_STABLE_TEMPLATE_ID,
    label: '科目一_正方形_稳定',
    keywords: ['模板', '科目一', '正方形', '稳定', 'subject1', 'square'],
    description: '围绕科目一杆点执行稳定正方形飞行',
  },
]

export type Subject1SquareStableParams = {
  subject1X: number
  subject1Y: number
}

const toFieldNumber = (value: number) => String(Math.round(value * 100) / 100)

const buildSubject1SquareStableBlocks = (params: Subject1SquareStableParams): ParsedBlock[] => {
  const halfSide = 40
  const z = 100
  const left = params.subject1X - halfSide
  const right = params.subject1X + halfSide
  const bottom = params.subject1Y - halfSide
  const top = params.subject1Y + halfSide

  return [
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '1', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '2', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, { X: toFieldNumber(left), Y: toFieldNumber(bottom), Z: String(z), time: '800' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, { X: toFieldNumber(left), Y: toFieldNumber(top), Z: String(z), time: '800' }),
    createInsertedBlockByType('Goertek_Turn', { turnDirection: 'r', angle: '90' }),
    createInsertedBlockByType('block_delay', { time: '1000' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, { X: toFieldNumber(right), Y: toFieldNumber(top), Z: String(z), time: '800' }),
    createInsertedBlockByType('Goertek_Turn', { turnDirection: 'r', angle: '90' }),
    createInsertedBlockByType('block_delay', { time: '1000' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, { X: toFieldNumber(right), Y: toFieldNumber(bottom), Z: String(z), time: '800' }),
    createInsertedBlockByType('Goertek_Turn', { turnDirection: 'r', angle: '90' }),
    createInsertedBlockByType('block_delay', { time: '1000' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, { X: toFieldNumber(left), Y: toFieldNumber(bottom), Z: String(z), time: '800' }),
  ]
}

export const buildTemplateBlocks = (
  templateId: string,
  params: Subject1SquareStableParams,
): ParsedBlock[] => {
  if (templateId === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID) {
    return buildSubject1SquareStableBlocks(params)
  }
  return []
}

export const getSubject1TemplateDefaultCenter = (rodConfig?: RodConfig): Subject1SquareStableParams => {
  const point = rodConfig?.subject1?.[0]
  const x = typeof point?.x === 'number' && Number.isFinite(point.x) ? point.x : 0
  const y = typeof point?.y === 'number' && Number.isFinite(point.y) ? point.y : 0
  return {
    subject1X: x,
    subject1Y: y,
  }
}
