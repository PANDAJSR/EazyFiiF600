import type { ParsedBlock } from '../../types/fii'
import type { RodConfig } from './rodConfig'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'
import type { XYZ } from './trajectoryUtils'

const SUBJECT1_MAX_HEIGHT = 150
const SUBJECT1_HEADING_TOLERANCE_DEG = 1
const ASYNC_MOVE_BLOCK_TYPE = 'Goertek_MoveToCoord2'
const RELATIVE_MOVE_BLOCK_TYPE = 'Goertek_Move'
const TURN_BLOCK_TYPE = 'Goertek_Turn'
const LAND_BLOCK_TYPE = 'Goertek_Land'
const DELAY_BLOCK_TYPE = 'block_delay'
const DEFAULT_HEADING_DEG = 0

type XYPoint = {
  x: number
  y: number
}

type Position3D = {
  x: number
  y: number
  z: number
}

type DelayAnchor = {
  distance: number
  minDelayMs: number
}

type Subject1Visit = {
  x: number
  y: number
  z: number
  moveDirectionDeg?: number
  headingDeg?: number
}

type Subject1LoopCheckResult = 'ok' | 'no-loop' | 'heading-not-forward'

export type TrajectoryIssue = {
  key: string
  message: string
  blockId?: string
}

const ASYNC_MOVE_DELAY_ANCHORS: DelayAnchor[] = [
  { distance: 40, minDelayMs: 500 },
  { distance: 60, minDelayMs: 700 },
  { distance: 80, minDelayMs: 800 },
  { distance: 100, minDelayMs: 1000 },
  { distance: 120, minDelayMs: 1000 },
  { distance: 140, minDelayMs: 1100 },
]

const hasFiniteXY = (point: { x?: number; y?: number }): point is { x: number; y: number } =>
  Number.isFinite(point.x) && Number.isFinite(point.y)

const isSameXY = (a: XYPoint, b: XYPoint) => a.x === b.x && a.y === b.y

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const readPosition = (block: ParsedBlock, current: Position3D): Position3D | null => {
  if (block.type === ASYNC_MOVE_BLOCK_TYPE || block.type === AUTO_DELAY_BLOCK_TYPE) {
    const x = toNumber(block.fields.X)
    const y = toNumber(block.fields.Y)
    const z = toNumber(block.fields.Z)
    if (x === null || y === null || z === null) {
      return null
    }
    return { x, y, z }
  }

  if (block.type === RELATIVE_MOVE_BLOCK_TYPE) {
    const deltaX = toNumber(block.fields.X)
    const deltaY = toNumber(block.fields.Y)
    const deltaZ = toNumber(block.fields.Z)
    if (deltaX === null || deltaY === null || deltaZ === null) {
      return null
    }
    return {
      x: current.x + deltaX,
      y: current.y + deltaY,
      z: current.z + deltaZ,
    }
  }

  if (block.type === LAND_BLOCK_TYPE) {
    return {
      x: current.x,
      y: current.y,
      z: 0,
    }
  }

  if (block.type === 'Goertek_TakeOff2') {
    const alt = toNumber(block.fields.alt)
    if (alt === null) {
      return null
    }
    return {
      x: current.x,
      y: current.y,
      z: alt,
    }
  }

  return current
}

const normalizePolygon = (points: XYPoint[]): XYPoint[] => {
  const compact = points.filter((point, index) => {
    if (index === 0) {
      return true
    }
    return !isSameXY(point, points[index - 1])
  })

  if (compact.length > 1 && isSameXY(compact[0], compact[compact.length - 1])) {
    compact.pop()
  }

  return compact
}

const pointInPolygon = (point: XYPoint, polygon: XYPoint[]): boolean => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]

    const intersect =
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x

    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

const normalizeHeadingDeg = (headingDeg: number): number => {
  const normalized = headingDeg % 360
  return normalized >= 0 ? normalized : normalized + 360
}

const calcMoveDirectionDeg = (deltaX: number, deltaY: number): number | null => {
  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
    return null
  }
  return normalizeHeadingDeg((Math.atan2(deltaX, deltaY) * 180) / Math.PI)
}

const shortestAngleDiffDeg = (a: number, b: number): number => {
  const diff = Math.abs(normalizeHeadingDeg(a) - normalizeHeadingDeg(b))
  return Math.min(diff, 360 - diff)
}

const isHeadingFacingMoveDirection = (moveDirectionDeg: number, headingDeg: number): boolean =>
  shortestAngleDiffDeg(moveDirectionDeg, headingDeg) <= SUBJECT1_HEADING_TOLERANCE_DEG

const buildSubject1Visits = (startPos: XYZ, blocks: ParsedBlock[]): Subject1Visit[] => {
  const startX = toNumber(startPos.x) ?? 0
  const startY = toNumber(startPos.y) ?? 0
  const startZ = toNumber(startPos.z) ?? 0
  const visits: Subject1Visit[] = [{ x: startX, y: startY, z: startZ }]
  let currentX = startX
  let currentY = startY
  let currentZ = startZ
  let headingDeg = DEFAULT_HEADING_DEG

  for (const block of blocks) {
    if (block.type === TURN_BLOCK_TYPE) {
      const angle = toNumber(block.fields.angle)
      if (angle === null) {
        continue
      }
      const direction = block.fields.turnDirection?.trim().toLowerCase()
      if (direction === 'r') {
        headingDeg = normalizeHeadingDeg(headingDeg + angle)
      } else if (direction === 'l') {
        headingDeg = normalizeHeadingDeg(headingDeg - angle)
      }
      continue
    }

    if (block.type === 'Goertek_TakeOff2') {
      const nextZ = toNumber(block.fields.alt)
      if (nextZ === null) {
        continue
      }
      currentZ = nextZ
      visits.push({ x: currentX, y: currentY, z: currentZ })
      continue
    }

    if (block.type === ASYNC_MOVE_BLOCK_TYPE || block.type === AUTO_DELAY_BLOCK_TYPE) {
      const nextX = toNumber(block.fields.X)
      const nextY = toNumber(block.fields.Y)
      if (nextX === null || nextY === null) {
        continue
      }
      const nextZ = toNumber(block.fields.Z) ?? currentZ
      const moveDirectionDeg = calcMoveDirectionDeg(nextX - currentX, nextY - currentY)
      currentX = nextX
      currentY = nextY
      currentZ = nextZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        moveDirectionDeg: moveDirectionDeg ?? undefined,
        headingDeg: moveDirectionDeg === null ? undefined : headingDeg,
      })
      continue
    }

    if (block.type === RELATIVE_MOVE_BLOCK_TYPE) {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        continue
      }
      const deltaZ = toNumber(block.fields.Z) ?? 0
      const moveDirectionDeg = calcMoveDirectionDeg(deltaX, deltaY)
      currentX += deltaX
      currentY += deltaY
      currentZ += deltaZ
      visits.push({
        x: currentX,
        y: currentY,
        z: currentZ,
        moveDirectionDeg: moveDirectionDeg ?? undefined,
        headingDeg: moveDirectionDeg === null ? undefined : headingDeg,
      })
      continue
    }

    if (block.type === LAND_BLOCK_TYPE) {
      currentZ = 0
      visits.push({ x: currentX, y: currentY, z: currentZ })
    }
  }

  return visits
}

const isLoopFacingMoveDirection = (loopVisits: Subject1Visit[]): boolean => {
  for (let index = 1; index < loopVisits.length; index += 1) {
    const visit = loopVisits[index]
    if (visit.moveDirectionDeg === undefined || visit.headingDeg === undefined) {
      continue
    }
    if (!isHeadingFacingMoveDirection(visit.moveDirectionDeg, visit.headingDeg)) {
      return false
    }
  }
  return true
}

const checkSubject1ClosedLoopUnder150 = (
  subjectPoint: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject1LoopCheckResult => {
  const visits = buildSubject1Visits(startPos, blocks)
  const indexByXY = new Map<string, number[]>()
  let hasClosedLoopIncludingSubject = false

  for (let endIndex = 0; endIndex < visits.length; endIndex += 1) {
    const endVisit = visits[endIndex]
    const key = `${endVisit.x},${endVisit.y}`
    const seen = indexByXY.get(key) ?? []

    for (const startIndex of seen) {
      if (endIndex - startIndex < 3) {
        continue
      }

      const loopVisits = visits.slice(startIndex, endIndex + 1)
      if (!loopVisits.every((visit) => visit.z < SUBJECT1_MAX_HEIGHT)) {
        continue
      }

      const polygon = normalizePolygon(loopVisits.map((visit) => ({ x: visit.x, y: visit.y })))
      if (polygon.length < 3) {
        continue
      }

      if (pointInPolygon(subjectPoint, polygon)) {
        hasClosedLoopIncludingSubject = true
        if (isLoopFacingMoveDirection(loopVisits)) {
          return 'ok'
        }
      }
    }

    seen.push(endIndex)
    indexByXY.set(key, seen)
  }

  return hasClosedLoopIncludingSubject ? 'heading-not-forward' : 'no-loop'
}

const findMinDelayByDistance = (distanceCm: number): number => {
  const safeDistance = Number.isFinite(distanceCm) ? Math.max(0, distanceCm) : 0
  if (Math.abs(safeDistance - 40) < 1e-6) {
    return 501
  }
  const first = ASYNC_MOVE_DELAY_ANCHORS[0]
  const last = ASYNC_MOVE_DELAY_ANCHORS[ASYNC_MOVE_DELAY_ANCHORS.length - 1]

  if (safeDistance <= first.distance) {
    const ratio = safeDistance / first.distance
    return Math.ceil(first.minDelayMs * ratio)
  }

  if (safeDistance >= last.distance) {
    const prev = ASYNC_MOVE_DELAY_ANCHORS[ASYNC_MOVE_DELAY_ANCHORS.length - 2]
    const slope = (last.minDelayMs - prev.minDelayMs) / (last.distance - prev.distance)
    return Math.ceil(last.minDelayMs + (safeDistance - last.distance) * slope)
  }

  for (let i = 1; i < ASYNC_MOVE_DELAY_ANCHORS.length; i += 1) {
    const left = ASYNC_MOVE_DELAY_ANCHORS[i - 1]
    const right = ASYNC_MOVE_DELAY_ANCHORS[i]
    if (safeDistance > right.distance) {
      continue
    }
    if (safeDistance === right.distance) {
      return right.minDelayMs
    }
    const ratio = (safeDistance - left.distance) / (right.distance - left.distance)
    return Math.ceil(left.minDelayMs + (right.minDelayMs - left.minDelayMs) * ratio)
  }

  return last.minDelayMs
}

const findAsyncMoveDelayIssues = (startPos: XYZ, blocks: ParsedBlock[]): TrajectoryIssue[] => {
  const issues: TrajectoryIssue[] = []
  let runtimePosition: Position3D = {
    x: toNumber(startPos.x) ?? 0,
    y: toNumber(startPos.y) ?? 0,
    z: toNumber(startPos.z) ?? 0,
  }

  const positionsAfterEachBlock = blocks.map((block) => {
    const next = readPosition(block, runtimePosition)
    if (next) {
      runtimePosition = next
    }
    return runtimePosition
  })

  for (let startIndex = 0; startIndex < blocks.length; startIndex += 1) {
    const current = blocks[startIndex]
    if (current.type !== ASYNC_MOVE_BLOCK_TYPE) {
      continue
    }

    let nextMoveIndex = -1
    let accumulatedDelayMs = 0

    for (let cursor = startIndex + 1; cursor < blocks.length; cursor += 1) {
      const candidate = blocks[cursor]
      if (candidate.type === DELAY_BLOCK_TYPE) {
        accumulatedDelayMs += Math.max(0, toNumber(candidate.fields.time) ?? 0)
        continue
      }
      if (
        candidate.type === ASYNC_MOVE_BLOCK_TYPE ||
        candidate.type === AUTO_DELAY_BLOCK_TYPE ||
        candidate.type === RELATIVE_MOVE_BLOCK_TYPE ||
        candidate.type === LAND_BLOCK_TYPE
      ) {
        nextMoveIndex = cursor
        break
      }
    }

    if (nextMoveIndex < 0) {
      continue
    }

    const startPosition = positionsAfterEachBlock[startIndex]
    const nextPosition = positionsAfterEachBlock[nextMoveIndex]
    if (!startPosition || !nextPosition) {
      continue
    }

    const distance = Math.hypot(
      nextPosition.x - startPosition.x,
      nextPosition.y - startPosition.y,
      nextPosition.z - startPosition.z,
    )
    const requiredDelayMs = findMinDelayByDistance(distance)
    if (accumulatedDelayMs >= requiredDelayMs) {
      continue
    }

    issues.push({
      key: `async-delay-${current.id}-${blocks[nextMoveIndex].id}`,
      blockId: current.id,
      message: `异步平移延时不足：第${startIndex + 1}到第${nextMoveIndex + 1}个平移到距离${distance.toFixed(1)}cm，需≥${requiredDelayMs}ms，当前${Math.round(accumulatedDelayMs)}ms`,
    })
  }

  return issues
}

export const buildTrajectoryIssues = (
  startPos: XYZ,
  blocks: ParsedBlock[],
  rodConfig: RodConfig,
): TrajectoryIssue[] => {
  const issues: TrajectoryIssue[] = []
  const subject1 = rodConfig.subject1[0]

  if (subject1 && hasFiniteXY(subject1)) {
    const subject1Result = checkSubject1ClosedLoopUnder150(subject1, startPos, blocks)
    if (subject1Result === 'no-loop') {
      issues.push({
        key: 'subject1-not-completed',
        message: '科目一未完成',
      })
    } else if (subject1Result === 'heading-not-forward') {
      issues.push({
        key: 'subject1-heading-not-forward',
        message: '科目一未完成：机头没有朝向飞行方向',
      })
    }
  }

  issues.push(...findAsyncMoveDelayIssues(startPos, blocks))
  return issues
}
