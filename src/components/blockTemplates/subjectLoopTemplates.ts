import type { ParsedBlock } from '../../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'
import { COMMENT_BLOCK_TYPE } from '../../utils/commentBlocks'
import { createInsertedBlockByType } from '../blockInsertCatalog'
import type {
  Subject2RectangleStableParams,
  Subject5HexagonFigureEightParams,
  Subject6OctagonFigureEightParams,
  Subject7ThreeColorRingsParams,
} from './templateParams'

const EPSILON = 1e-6
const toFieldNumber = (value: number) => String(Math.round(value))

export const buildSubject2RectangleStableBlocks = (params: Subject2RectangleStableParams): ParsedBlock[] => {
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

  const insertionX = params.insertionContext?.x ?? centerX - halfRodSpan * unitAxisX - halfHorizontalSpan * unitPerpX
  const insertionY = params.insertionContext?.y ?? centerY - halfRodSpan * unitAxisY - halfHorizontalSpan * unitPerpY
  const insertionZ = params.insertionContext?.z ?? lowZ
  const relX = insertionX - centerX
  const relY = insertionY - centerY
  const rawV = relX * unitPerpX + relY * unitPerpY
  const startOnPositiveV = rawV >= 0
  const startAtLowEdge = Math.abs(insertionZ - lowZ) <= Math.abs(insertionZ - highZ)

  const loopLocalCorners = (() => {
    if (startAtLowEdge) {
      return startOnPositiveV
        ? [
          { v: halfHorizontalSpan, z: lowZ },
          { v: -halfHorizontalSpan, z: lowZ },
          { v: -halfHorizontalSpan, z: highZ },
          { v: halfHorizontalSpan, z: highZ },
        ]
        : [
          { v: -halfHorizontalSpan, z: lowZ },
          { v: halfHorizontalSpan, z: lowZ },
          { v: halfHorizontalSpan, z: highZ },
          { v: -halfHorizontalSpan, z: highZ },
        ]
    }
    return startOnPositiveV
      ? [
        { v: halfHorizontalSpan, z: highZ },
        { v: -halfHorizontalSpan, z: highZ },
        { v: -halfHorizontalSpan, z: lowZ },
        { v: halfHorizontalSpan, z: lowZ },
      ]
      : [
        { v: -halfHorizontalSpan, z: highZ },
        { v: halfHorizontalSpan, z: highZ },
        { v: halfHorizontalSpan, z: lowZ },
        { v: -halfHorizontalSpan, z: lowZ },
      ]
  })()

  const loopCorners = [...loopLocalCorners, loopLocalCorners[0]].map((corner) => ({
    x: centerX + corner.v * unitPerpX,
    y: centerY + corner.v * unitPerpY,
    z: corner.z,
  }))
  const flightSegments = [
    { from: { x: insertionX, y: insertionY, z: insertionZ }, to: loopCorners[0] },
    ...Array.from({ length: loopCorners.length - 1 }, (_, index) => ({
      from: loopCorners[index],
      to: loopCorners[index + 1],
    })),
  ]
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

export const buildSubject5HexagonFigureEightBlocks = (params: Subject5HexagonFigureEightParams): ParsedBlock[] => {
  const sideOffset = 40
  const endExtension = 40
  const defaultAxisSpan = 100
  const axisX = params.subject5RodBX - params.subject5RodAX
  const axisY = params.subject5RodBY - params.subject5RodAY
  const axisLength = Math.hypot(axisX, axisY)
  const unitAxisX = axisLength > EPSILON ? axisX / axisLength : 1
  const unitAxisY = axisLength > EPSILON ? axisY / axisLength : 0
  const unitPerpX = -unitAxisY
  const unitPerpY = unitAxisX
  const resolvedBX = axisLength > EPSILON ? params.subject5RodBX : params.subject5RodAX + defaultAxisSpan * unitAxisX
  const resolvedBY = axisLength > EPSILON ? params.subject5RodBY : params.subject5RodAY + defaultAxisSpan * unitAxisY
  const insertionX = params.insertionContext?.x ?? params.subject5RodAX - endExtension * unitAxisX
  const insertionY = params.insertionContext?.y ?? params.subject5RodAY - endExtension * unitAxisY
  const insertionZ = Math.min(params.insertionContext?.z ?? 100, 145)

  const pathPoints = [
    { x: params.subject5RodAX - endExtension * unitAxisX, y: params.subject5RodAY - endExtension * unitAxisY, z: insertionZ },
    { x: params.subject5RodAX + sideOffset * unitPerpX, y: params.subject5RodAY + sideOffset * unitPerpY, z: insertionZ },
    { x: resolvedBX - sideOffset * unitPerpX, y: resolvedBY - sideOffset * unitPerpY, z: insertionZ },
    { x: resolvedBX + endExtension * unitAxisX, y: resolvedBY + endExtension * unitAxisY, z: insertionZ },
    { x: resolvedBX + sideOffset * unitPerpX, y: resolvedBY + sideOffset * unitPerpY, z: insertionZ },
    { x: params.subject5RodAX - sideOffset * unitPerpX, y: params.subject5RodAY - sideOffset * unitPerpY, z: insertionZ },
  ]
  const endpointIndexes = [0, 3]
  const startPathIndex = endpointIndexes.reduce((bestIndex, currentIndex) => {
    const best = pathPoints[bestIndex]
    const current = pathPoints[currentIndex]
    const bestDistance = Math.hypot(best.x - insertionX, best.y - insertionY)
    const currentDistance = Math.hypot(current.x - insertionX, current.y - insertionY)
    return currentDistance < bestDistance ? currentIndex : bestIndex
  }, endpointIndexes[0])
  const orderedLoopPoints = Array.from({ length: pathPoints.length + 1 }, (_, offset) => pathPoints[(startPathIndex + offset) % pathPoints.length])
  const flightSegments: Array<{
    from: { x: number; y: number; z: number }
    to: { x: number; y: number; z: number }
  }> = []
  if (Math.hypot(orderedLoopPoints[0].x - insertionX, orderedLoopPoints[0].y - insertionY) > EPSILON) {
    flightSegments.push({ from: { x: insertionX, y: insertionY, z: insertionZ }, to: orderedLoopPoints[0] })
  }
  flightSegments.push(...Array.from({ length: orderedLoopPoints.length - 1 }, (_, index) => ({
    from: orderedLoopPoints[index],
    to: orderedLoopPoints[index + 1],
  })))

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目五 Begin' }),
    ...flightSegments.map((segment) => createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(segment.to.z),
      time: '800',
    })),
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目五 End' }),
  ]
}

export const buildSubject6OctagonFigureEightBlocks = (params: Subject6OctagonFigureEightParams): ParsedBlock[] => {
  const crossbarHeight = 150
  const heightOffset = 30
  const endExtension = 50
  const defaultGapSpan = 120
  const center1X = (params.subject6RodAX + params.subject6RodBX) / 2
  const center1Y = (params.subject6RodAY + params.subject6RodBY) / 2
  const center2X = (params.subject6RodCX + params.subject6RodDX) / 2
  const center2Y = (params.subject6RodCY + params.subject6RodDY) / 2
  const rawGapAxisX = center2X - center1X
  const rawGapAxisY = center2Y - center1Y
  const gapAxisLength = Math.hypot(rawGapAxisX, rawGapAxisY)
  const unitGapX = gapAxisLength > EPSILON ? rawGapAxisX / gapAxisLength : 1
  const unitGapY = gapAxisLength > EPSILON ? rawGapAxisY / gapAxisLength : 0
  const middleX = (center1X + center2X) / 2
  const middleY = (center1Y + center2Y) / 2
  const halfGap = gapAxisLength > EPSILON ? gapAxisLength / 2 : defaultGapSpan / 2
  const insertionX = params.insertionContext?.x ?? middleX + (-halfGap - endExtension) * unitGapX
  const insertionY = params.insertionContext?.y ?? middleY + (-halfGap - endExtension) * unitGapY
  const insertionZ = Math.min(params.insertionContext?.z ?? crossbarHeight - heightOffset, 175)
  const toWorldPoint = (u: number, w: number) => ({ x: middleX + u * unitGapX, y: middleY + u * unitGapY, z: crossbarHeight + w })
  const baseLoopPoints = [
    toWorldPoint(-halfGap - endExtension, -heightOffset),
    toWorldPoint(0, -heightOffset),
    toWorldPoint(0, heightOffset),
    toWorldPoint(halfGap + endExtension, heightOffset),
    toWorldPoint(halfGap + endExtension, -heightOffset),
    toWorldPoint(0, -heightOffset),
    toWorldPoint(0, heightOffset),
    toWorldPoint(-halfGap - endExtension, heightOffset),
  ]
  const startPathIndex = [0, 3, 4, 7].reduce((bestIndex, currentIndex) => {
    const best = baseLoopPoints[bestIndex]
    const current = baseLoopPoints[currentIndex]
    const bestDistance = Math.hypot(best.x - insertionX, best.y - insertionY, best.z - insertionZ)
    const currentDistance = Math.hypot(current.x - insertionX, current.y - insertionY, current.z - insertionZ)
    return currentDistance < bestDistance ? currentIndex : bestIndex
  }, 0)
  const orderedLoopPoints = Array.from({ length: baseLoopPoints.length + 1 }, (_, offset) => baseLoopPoints[(startPathIndex + offset) % baseLoopPoints.length])
  const flightSegments: Array<{
    from: { x: number; y: number; z: number }
    to: { x: number; y: number; z: number }
  }> = []
  if (Math.hypot(orderedLoopPoints[0].x - insertionX, orderedLoopPoints[0].y - insertionY, orderedLoopPoints[0].z - insertionZ) > EPSILON) {
    flightSegments.push({ from: { x: insertionX, y: insertionY, z: insertionZ }, to: orderedLoopPoints[0] })
  }
  flightSegments.push(...Array.from({ length: orderedLoopPoints.length - 1 }, (_, index) => ({
    from: orderedLoopPoints[index],
    to: orderedLoopPoints[index + 1],
  })))

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目六 Begin' }),
    ...flightSegments.map((segment) => createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(segment.to.z),
      time: '800',
    })),
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目六 End' }),
  ]
}

export const buildSubject7ThreeColorRingsBlocks = (params: Subject7ThreeColorRingsParams): ParsedBlock[] => {
  const centerX = (params.subject7RodAX + params.subject7RodBX) / 2
  const centerY = (params.subject7RodAY + params.subject7RodBY) / 2

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目七 Begin' }),
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(centerX),
      Y: toFieldNumber(centerY),
      Z: '80',
      time: '1200',
    }),
    createInsertedBlockByType('Goertek_MoveToCoord2', {
      X: toFieldNumber(centerX),
      Y: toFieldNumber(centerY),
      Z: '170',
    }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor2', { color1: '#FF0000' }),
    createInsertedBlockByType('block_delay', { time: '500' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor2', { color1: '#00FF00' }),
    createInsertedBlockByType('block_delay', { time: '500' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor2', { color1: '#0000FF' }),
    createInsertedBlockByType('block_delay', { time: '500' }),
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目七 End' }),
  ]
}
