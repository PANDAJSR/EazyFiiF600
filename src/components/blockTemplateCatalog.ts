import type { ParsedBlock } from '../types/fii'
import type { RodConfig } from './trajectory/rodConfig'
import { createInsertedBlockByType } from './blockInsertCatalog'
import { AUTO_DELAY_BLOCK_TYPE } from '../utils/autoDelayBlocks'
import { COMMENT_BLOCK_TYPE } from '../utils/commentBlocks'

export const SUBJECT1_SQUARE_STABLE_TEMPLATE_ID = 'subject1_square_stable'
export const SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID = 'subject2_rectangle_stable'

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
  {
    id: SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID,
    label: '科目二_长方形_稳定',
    keywords: ['模板', '科目二', '长方形', '稳定', 'subject2', 'rectangle'],
    description: '围绕科目二横杆执行稳定长方形绕行并闭合',
  },
]

export type TemplateInsertionContext = {
  x: number
  y: number
  z: number
  orientationDeg: number
}

export type Subject1SquareStableParams = {
  subject1X: number
  subject1Y: number
  insertionContext?: TemplateInsertionContext
}

export type Subject2RectangleStableParams = {
  subject2RodAX: number
  subject2RodAY: number
  subject2RodBX: number
  subject2RodBY: number
  insertionContext?: TemplateInsertionContext
}

const toFieldNumber = (value: number) => String(Math.round(value * 100) / 100)
const EPSILON = 1e-6

const buildSubject1SquareStableBlocks = (params: Subject1SquareStableParams): ParsedBlock[] => {
  const halfSide = 40
  const inheritedZ = params.insertionContext?.z ?? 100
  const z = Math.min(inheritedZ, 145)
  const left = params.subject1X - halfSide
  const right = params.subject1X + halfSide
  const bottom = params.subject1Y - halfSide
  const top = params.subject1Y + halfSide
  const corners = [
    { x: left, y: bottom },
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
  ]

  const insertionX = params.insertionContext?.x ?? left
  const insertionY = params.insertionContext?.y ?? bottom
  const startCornerIndex = corners.reduce((bestIndex, corner, cornerIndex) => {
    const bestCorner = corners[bestIndex]
    const bestDistance = Math.hypot(bestCorner.x - insertionX, bestCorner.y - insertionY)
    const currentDistance = Math.hypot(corner.x - insertionX, corner.y - insertionY)
    return currentDistance < bestDistance ? cornerIndex : bestIndex
  }, 0)
  const orderedLoopCorners = Array.from({ length: corners.length + 1 }, (_, offset) => corners[(startCornerIndex + offset) % corners.length])

  const headingToDeg = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (Math.abs(to.x - from.x) < 1e-6 && Math.abs(to.y - from.y) < 1e-6) {
      return null
    }
    const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
    const normalized = ((deg % 360) + 360) % 360
    return Math.round(normalized * 100) / 100
  }

  const flightSegments = (() => {
    const segments: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = []
    const startCorner = orderedLoopCorners[0]
    if (Math.hypot(startCorner.x - insertionX, startCorner.y - insertionY) > 1e-6) {
      segments.push({
        from: { x: insertionX, y: insertionY },
        to: startCorner,
      })
    }
    for (let index = 0; index < orderedLoopCorners.length - 1; index += 1) {
      segments.push({
        from: orderedLoopCorners[index],
        to: orderedLoopCorners[index + 1],
      })
    }
    return segments
  })()

  const headingBlocks = flightSegments.flatMap((segment) => {
    const headingDeg = headingToDeg(segment.from, segment.to)
    if (headingDeg === null) {
      return []
    }
    return [createInsertedBlockByType('Goertek_TurnTo', { turnDirection: 'r', angle: toFieldNumber(headingDeg) })]
  })

  const moveBlocks = flightSegments.map((segment) =>
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(z),
      time: '800',
    }))

  const flightBlocks = flightSegments.flatMap((_, index) => [headingBlocks[index], moveBlocks[index]]).filter(Boolean) as ParsedBlock[]

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 Begin' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '1', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '2', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    ...flightBlocks,
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 End' }),
  ]
}

const buildSubject2RectangleStableBlocks = (params: Subject2RectangleStableParams): ParsedBlock[] => {
  const lowZ = 130
  const highZ = 170
  const halfHorizontalSpan = 40
  const defaultHalfRodSpan = 40
  const axisX = params.subject2RodBX - params.subject2RodAX
  const axisY = params.subject2RodBY - params.subject2RodAY
  const axisLength = Math.hypot(axisX, axisY)
  const unitAxisX = axisLength > EPSILON ? axisX / axisLength : 1
  const unitAxisY = axisLength > EPSILON ? axisY / axisLength : 0
  const unitPerpX = -unitAxisY
  const unitPerpY = unitAxisX
  const centerX = (params.subject2RodAX + params.subject2RodBX) / 2
  const centerY = (params.subject2RodAY + params.subject2RodBY) / 2
  const halfRodSpan = axisLength > EPSILON ? axisLength / 2 : defaultHalfRodSpan

  const insertionX = params.insertionContext?.x ?? (centerX - halfRodSpan * unitAxisX - halfHorizontalSpan * unitPerpX)
  const insertionY = params.insertionContext?.y ?? (centerY - halfRodSpan * unitAxisY - halfHorizontalSpan * unitPerpY)
  const insertionZ = params.insertionContext?.z ?? lowZ

  const relX = insertionX - centerX
  const relY = insertionY - centerY
  // 科目二模板要求围绕横杆中间闭合，不沿横杆方向偏移到杆端。
  const u = 0
  const rawV = relX * unitPerpX + relY * unitPerpY
  const startOnPositiveV = rawV >= 0
  const startAtLowEdge = Math.abs(insertionZ - lowZ) <= Math.abs(insertionZ - highZ)

  const loopLocalCorners = (() => {
    if (startAtLowEdge) {
      if (startOnPositiveV) {
        return [
          { v: halfHorizontalSpan, z: lowZ },
          { v: -halfHorizontalSpan, z: lowZ },
          { v: -halfHorizontalSpan, z: highZ },
          { v: halfHorizontalSpan, z: highZ },
        ]
      }
      return [
        { v: -halfHorizontalSpan, z: lowZ },
        { v: halfHorizontalSpan, z: lowZ },
        { v: halfHorizontalSpan, z: highZ },
        { v: -halfHorizontalSpan, z: highZ },
      ]
    }
    if (startOnPositiveV) {
      return [
        { v: halfHorizontalSpan, z: highZ },
        { v: -halfHorizontalSpan, z: highZ },
        { v: -halfHorizontalSpan, z: lowZ },
        { v: halfHorizontalSpan, z: lowZ },
      ]
    }
    return [
      { v: -halfHorizontalSpan, z: highZ },
      { v: halfHorizontalSpan, z: highZ },
      { v: halfHorizontalSpan, z: lowZ },
      { v: -halfHorizontalSpan, z: lowZ },
    ]
  })()

  const loopCorners = [...loopLocalCorners, loopLocalCorners[0]].map((corner) => ({
    x: centerX + u * unitAxisX + corner.v * unitPerpX,
    y: centerY + u * unitAxisY + corner.v * unitPerpY,
    z: corner.z,
  }))

  const flightSegments = (() => {
    const segments: Array<{
      from: { x: number; y: number; z: number }
      to: { x: number; y: number; z: number }
    }> = []
    segments.push({
      from: { x: insertionX, y: insertionY, z: insertionZ },
      to: loopCorners[0],
    })
    for (let index = 0; index < loopCorners.length - 1; index += 1) {
      segments.push({
        from: loopCorners[index],
        to: loopCorners[index + 1],
      })
    }
    return segments
  })()

  const moveBlocks = flightSegments.map((segment) =>
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(segment.to.z),
      time: '800',
    }))

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目二 Begin' }),
    ...moveBlocks,
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目二 End' }),
  ]
}

export const buildTemplateBlocks = (
  templateId: string,
  params: Subject1SquareStableParams | Subject2RectangleStableParams,
): ParsedBlock[] => {
  if (templateId === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID) {
    return buildSubject1SquareStableBlocks(params as Subject1SquareStableParams)
  }
  if (templateId === SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID) {
    return buildSubject2RectangleStableBlocks(params as Subject2RectangleStableParams)
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

export const getSubject2TemplateDefaultRods = (rodConfig?: RodConfig): Subject2RectangleStableParams => {
  const pointA = rodConfig?.subject2?.[0]
  const pointB = rodConfig?.subject2?.[1]
  const ax = typeof pointA?.x === 'number' && Number.isFinite(pointA.x) ? pointA.x : 0
  const ay = typeof pointA?.y === 'number' && Number.isFinite(pointA.y) ? pointA.y : 0
  const bx = typeof pointB?.x === 'number' && Number.isFinite(pointB.x) ? pointB.x : ax
  const by = typeof pointB?.y === 'number' && Number.isFinite(pointB.y) ? pointB.y : ay
  return {
    subject2RodAX: ax,
    subject2RodAY: ay,
    subject2RodBX: bx,
    subject2RodBY: by,
  }
}
