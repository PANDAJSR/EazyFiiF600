import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type LocalPoint = {
  u: number
  v: number
  w: number
}

export type Subject2LoopCheckResult = 'ok' | 'no-loop' | 'outside-rod-span'

const SUBJECT2_ROD_LENGTH_CM = 80
const SUBJECT2_ROD_HEIGHT_CM = 150
const SUBJECT2_HALF_ROD_CM = SUBJECT2_ROD_LENGTH_CM / 2
const SUBJECT2_MIN_LOOP_POINTS = 4
const SUBJECT2_CLOSURE_TOLERANCE_CM = 18
const SUBJECT2_SPAN_TOLERANCE_CM = 25
const SUBJECT2_MIN_RADIUS_CM = 10
const SUBJECT2_FULL_LOOP_SWEEP_RAD = Math.PI * 1.8
const AXIS_EPSILON = 1e-6

const shortestAngleDelta = (from: number, to: number): number => {
  let diff = to - from
  while (diff > Math.PI) {
    diff -= Math.PI * 2
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return diff
}

const toLocalPoints = (
  points: Array<{ x: number; y: number; z: number }>,
  rodA: XYPoint,
  rodB: XYPoint,
): LocalPoint[] | null => {
  const axisX = rodB.x - rodA.x
  const axisY = rodB.y - rodA.y
  const axisLength = Math.hypot(axisX, axisY)
  if (axisLength < AXIS_EPSILON) {
    return null
  }

  const unitX = axisX / axisLength
  const unitY = axisY / axisLength
  const centerX = (rodA.x + rodB.x) / 2
  const centerY = (rodA.y + rodB.y) / 2

  return points.map((point) => {
    const relX = point.x - centerX
    const relY = point.y - centerY
    return {
      // u: 平行横杆方向；v: 垂直横杆的水平偏移；w: 相对横杆高度偏移
      u: relX * unitX + relY * unitY,
      v: -relX * unitY + relY * unitX,
      w: point.z - SUBJECT2_ROD_HEIGHT_CM,
    }
  })
}

const isClosedIn3D = (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }) =>
  Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) <= SUBJECT2_CLOSURE_TOLERANCE_CM

const coversFourQuadrants = (points: LocalPoint[]): boolean => {
  let hasPosV = false
  let hasNegV = false
  let hasPosW = false
  let hasNegW = false

  for (const point of points) {
    if (point.v > SUBJECT2_MIN_RADIUS_CM * 0.8) {
      hasPosV = true
    }
    if (point.v < -SUBJECT2_MIN_RADIUS_CM * 0.8) {
      hasNegV = true
    }
    if (point.w > SUBJECT2_MIN_RADIUS_CM * 0.8) {
      hasPosW = true
    }
    if (point.w < -SUBJECT2_MIN_RADIUS_CM * 0.8) {
      hasNegW = true
    }
  }

  return hasPosV && hasNegV && hasPosW && hasNegW
}

const calcAngularSweep = (points: LocalPoint[]): number => {
  let sweep = 0
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const prevAngle = Math.atan2(prev.w, prev.v)
    const currAngle = Math.atan2(curr.w, curr.v)
    sweep += shortestAngleDelta(prevAngle, currAngle)
  }
  return Math.abs(sweep)
}

const isLoopAroundRod = (loop: LocalPoint[]): boolean => {
  if (!loop.every((point) => Math.abs(point.u) <= SUBJECT2_HALF_ROD_CM + SUBJECT2_SPAN_TOLERANCE_CM)) {
    return false
  }

  const minRadius = Math.min(...loop.map((point) => Math.hypot(point.v, point.w)))
  if (minRadius < SUBJECT2_MIN_RADIUS_CM) {
    return false
  }

  if (!coversFourQuadrants(loop)) {
    return false
  }

  return calcAngularSweep(loop) >= SUBJECT2_FULL_LOOP_SWEEP_RAD
}

export const checkSubject2ClosedLoopAroundRod = (
  rodA: XYPoint,
  rodB: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject2LoopCheckResult => {
  const visits = buildPathVisits(startPos, blocks)
  if (visits.length < SUBJECT2_MIN_LOOP_POINTS) {
    return 'no-loop'
  }

  const localPoints = toLocalPoints(visits, rodA, rodB)
  if (!localPoints) {
    return 'no-loop'
  }

  let hasClosedLoop = false
  let hasClosedLoopWithinRodSpan = false

  for (let startIndex = 0; startIndex < visits.length; startIndex += 1) {
    for (
      let endIndex = startIndex + SUBJECT2_MIN_LOOP_POINTS - 1;
      endIndex < visits.length;
      endIndex += 1
    ) {
      if (!isClosedIn3D(visits[startIndex], visits[endIndex])) {
        continue
      }

      hasClosedLoop = true
      const loop = localPoints.slice(startIndex, endIndex + 1)

      if (!loop.every((point) => Math.abs(point.u) <= SUBJECT2_HALF_ROD_CM + SUBJECT2_SPAN_TOLERANCE_CM)) {
        continue
      }
      hasClosedLoopWithinRodSpan = true

      if (isLoopAroundRod(loop)) {
        return 'ok'
      }
    }
  }

  if (hasClosedLoop && !hasClosedLoopWithinRodSpan) {
    return 'outside-rod-span'
  }
  return 'no-loop'
}
