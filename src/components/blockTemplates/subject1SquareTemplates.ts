import type { ParsedBlock } from '../../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'
import { COMMENT_BLOCK_TYPE } from '../../utils/commentBlocks'
import { createInsertedBlockByType } from '../blockInsertCatalog'
import type {
  Subject1SquareStableParams,
  Subject1SquareTurnAndFlyParams,
} from './templateParams'

type Subject1SquarePoint = { x: number; y: number }
type Subject1SquareSegment = { from: Subject1SquarePoint; to: Subject1SquarePoint }

const EPSILON = 1e-6
const toFieldNumber = (value: number) => String(Math.round(value))
const normalizeHeadingDeg = (headingDeg: number) => ((headingDeg % 360) + 360) % 360

const headingToDeg = (from: Subject1SquarePoint, to: Subject1SquarePoint) => {
  if (Math.abs(to.x - from.x) < EPSILON && Math.abs(to.y - from.y) < EPSILON) {
    return null
  }
  const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
  return Math.round(normalizeHeadingDeg(deg) * 100) / 100
}

const getRelativeTurn = (currentHeadingDeg: number, targetHeadingDeg: number) => {
  const current = normalizeHeadingDeg(currentHeadingDeg)
  const target = normalizeHeadingDeg(targetHeadingDeg)
  const clockwise = normalizeHeadingDeg(target - current)
  const counterClockwise = normalizeHeadingDeg(current - target)

  if (clockwise <= counterClockwise) {
    return { turnDirection: 'r', angle: clockwise, nextHeading: target }
  }
  return { turnDirection: 'l', angle: counterClockwise, nextHeading: target }
}

const buildSubject1SquareGeometry = (params: Subject1SquareStableParams) => {
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
  const startCorner = orderedLoopCorners[0]
  const approachSegment = Math.hypot(startCorner.x - insertionX, startCorner.y - insertionY) > EPSILON
    ? { from: { x: insertionX, y: insertionY }, to: startCorner }
    : null
  const squareSegments: Subject1SquareSegment[] = Array.from({ length: orderedLoopCorners.length - 1 }, (_, index) => ({
    from: orderedLoopCorners[index],
    to: orderedLoopCorners[index + 1],
  }))

  return {
    z,
    startHeadingDeg: params.insertionContext?.orientationDeg ?? 0,
    approachSegment,
    squareSegments,
  }
}

const createSubject1RelativeTurnBlocks = (
  squareSegments: Subject1SquareSegment[],
  startHeadingDeg: number,
  delayMs: string,
) => {
  let currentHeadingDeg = startHeadingDeg

  return squareSegments.map((segment) => {
    const targetHeadingDeg = headingToDeg(segment.from, segment.to)
    if (targetHeadingDeg === null) {
      return []
    }

    const turn = getRelativeTurn(currentHeadingDeg, targetHeadingDeg)
    currentHeadingDeg = turn.nextHeading
    if (turn.angle <= EPSILON) {
      return []
    }
    return [
      createInsertedBlockByType('Goertek_Turn', {
        turnDirection: turn.turnDirection,
        angle: toFieldNumber(turn.angle),
      }),
      createInsertedBlockByType('block_delay', { time: delayMs }),
    ]
  })
}

export const buildSubject1SquareTurnAndFlyBlocks = (params: Subject1SquareTurnAndFlyParams): ParsedBlock[] => {
  const { z, startHeadingDeg, approachSegment, squareSegments } = buildSubject1SquareGeometry(params)
  const approachMoveBlock = approachSegment
    ? createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(approachSegment.to.x),
      Y: toFieldNumber(approachSegment.to.y),
      Z: toFieldNumber(z),
      time: '800',
    })
    : null
  const turnBlocks = createSubject1RelativeTurnBlocks(squareSegments, startHeadingDeg, '1500')
  const squareMoveBlocks = squareSegments.map((segment) =>
    createInsertedBlockByType('Goertek_MoveToCoord2', {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(z),
    }))

  const flightBlocks = squareSegments.flatMap((_, index) => {
    const blocks: ParsedBlock[] = []
    blocks.push(...turnBlocks[index])
    blocks.push(squareMoveBlocks[index])
    if (index === squareSegments.length - 1) {
      blocks.push(createInsertedBlockByType('block_delay', { time: '1000' }))
    }
    return blocks
  })

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 Begin' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '1', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '2', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    ...(approachMoveBlock ? [approachMoveBlock] : []),
    ...flightBlocks,
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 End' }),
  ]
}

export const buildSubject1SquareStableBlocks = (params: Subject1SquareStableParams): ParsedBlock[] => {
  const { z, startHeadingDeg, approachSegment, squareSegments } = buildSubject1SquareGeometry(params)
  const approachMoveBlock = approachSegment
    ? createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(approachSegment.to.x),
      Y: toFieldNumber(approachSegment.to.y),
      Z: toFieldNumber(z),
      time: '800',
    })
    : null
  const turnBlocks = createSubject1RelativeTurnBlocks(squareSegments, startHeadingDeg, '1000')
  const squareMoveBlocks = squareSegments.map((segment) =>
    createInsertedBlockByType(AUTO_DELAY_BLOCK_TYPE, {
      X: toFieldNumber(segment.to.x),
      Y: toFieldNumber(segment.to.y),
      Z: toFieldNumber(z),
      time: '800',
    }))

  const flightBlocks = squareSegments.flatMap((_, index) => [...turnBlocks[index], squareMoveBlocks[index]])

  return [
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 Begin' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '1', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    createInsertedBlockByType('Goertek_LEDTurnOnAllSingleColor4', { motor: '2', color1: '#00ff00' }),
    createInsertedBlockByType('block_delay', { time: '100' }),
    ...(approachMoveBlock ? [approachMoveBlock] : []),
    ...flightBlocks,
    createInsertedBlockByType(COMMENT_BLOCK_TYPE, { content: '科目一 End' }),
  ]
}
