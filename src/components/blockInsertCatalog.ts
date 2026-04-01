import type { ParsedBlock } from '../types/fii'

export type InsertableBlockDefinition = {
  type: string
  label: string
  keywords: string[]
  fields: Record<string, string>
}

export const INSERTABLE_BLOCKS: InsertableBlockDefinition[] = [
  {
    type: 'block_inittime',
    label: '在时间开始',
    keywords: ['时间', '开始', 'init', 'time'],
    fields: { time: '00:00' },
  },
  {
    type: 'Goertek_HorizontalSpeed',
    label: '水平速度',
    keywords: ['水平', '速度', 'vh', 'ah'],
    fields: { VH: '60', AH: '100' },
  },
  {
    type: 'Goertek_VerticalSpeed',
    label: '垂直速度',
    keywords: ['垂直', '速度', 'vv', 'av'],
    fields: { VV: '60', AV: '100' },
  },
  {
    type: 'Goertek_UnLock',
    label: '解锁',
    keywords: ['解锁', 'unlock'],
    fields: {},
  },
  {
    type: 'block_delay',
    label: '延时',
    keywords: ['延时', '等待', 'delay', 'time'],
    fields: { time: '500' },
  },
  {
    type: 'Goertek_TakeOff2',
    label: '起飞',
    keywords: ['起飞', 'takeoff', 'alt'],
    fields: { alt: '100' },
  },
  {
    type: 'Goertek_MoveToCoord2',
    label: '平移到（异步）',
    keywords: ['平移', '坐标', 'move to', 'x', 'y', 'z'],
    fields: { X: '0', Y: '0', Z: '100' },
  },
  {
    type: 'Goertek_Move',
    label: '相对平移（异步）',
    keywords: ['相对', '平移', 'move', 'x', 'y', 'z'],
    fields: { X: '0', Y: '0', Z: '0' },
  },
  {
    type: 'Goertek_Turn',
    label: '转动（异步）',
    keywords: ['转向', '转动', 'turn', 'angle'],
    fields: { turnDirection: 'r', angle: '90' },
  },
  {
    type: 'Goertek_LEDTurnOnAllSingleColor4',
    label: '设置电机灯光',
    keywords: ['灯光', 'led', '颜色', '电机'],
    fields: { motor: '1', color1: '#ffffff' },
  },
  {
    type: 'Goertek_LEDTurnOnAllSingleColor2',
    label: '设置全部灯光颜色',
    keywords: ['灯光', 'led', '颜色', '全部'],
    fields: { color1: '#ffffff' },
  },
  {
    type: 'Goertek_Land',
    label: '降落',
    keywords: ['降落', 'land'],
    fields: {},
  },
]

const createBlockId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom_${crypto.randomUUID()}`
  }
  return `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export const createInsertedBlock = (definition: InsertableBlockDefinition): ParsedBlock => ({
  id: createBlockId(),
  type: definition.type,
  fields: { ...definition.fields },
})
