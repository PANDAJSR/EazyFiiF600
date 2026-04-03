import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type LocalVisit = {
  u: number
  v: number
  z: number
}

export type Subject5CheckResult = 'ok' | 'no-eight' | 'height-too-high' | 'entry-exit-invalid'

const SUBJECT5_MAX_HEIGHT_CM = 150
const SUBJECT5_MIN_LOOP_POINTS = 6
const SUBJECT5_CLOSURE_TOLERANCE_CM = 20
const SUBJECT5_MIN_SWEEP_RAD = Math.PI * 1.6
const SUBJECT5_CENTER_CROSS_TOLERANCE_CM = 6
const SUBJECT5_ENTRY_SIDE_MARGIN_CM = 8
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

const buildLocalVisits = (
  rodA: XYPoint,
  rodB: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): { visits: LocalVisit[]; rodHalfSpan: number } | null => {
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
  const visits = buildPathVisits(startPos, blocks).map((visit) => {
    const relX = visit.x - centerX
    const relY = visit.y - centerY
    return {
      u: relX * unitX + relY * unitY,
      v: -relX * unitY + relY * unitX,
      z: visit.z,
    }
  })

  return {
    visits,
    rodHalfSpan: axisLength / 2,
  }
}

const isClosedIn3D = (start: LocalVisit, end: LocalVisit): boolean =>
  Math.hypot(end.u - start.u, end.v - start.v, end.z - start.z) <= SUBJECT5_CLOSURE_TOLERANCE_CM

const calcWindingSweep = (points: LocalVisit[], centerU: number): number => {
  let sweep = 0
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const prevAngle = Math.atan2(prev.v, prev.u - centerU)
    const currAngle = Math.atan2(curr.v, curr.u - centerU)
    sweep += shortestAngleDelta(prevAngle, currAngle)
  }
  return sweep
}

const hasCenterCrossing = (points: LocalVisit[]): boolean => {
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    if (Math.abs(prev.u) <= SUBJECT5_CENTER_CROSS_TOLERANCE_CM || Math.abs(curr.u) <= SUBJECT5_CENTER_CROSS_TOLERANCE_CM) {
      return true
    }
    if (prev.u * curr.u < 0) {
      return true
    }
  }
  return false
}

const isEightShapeLoop = (points: LocalVisit[], rodHalfSpan: number): boolean => {
  const leftSweep = calcWindingSweep(points, -rodHalfSpan)
  const rightSweep = calcWindingSweep(points, rodHalfSpan)
  if (Math.abs(leftSweep) < SUBJECT5_MIN_SWEEP_RAD || Math.abs(rightSweep) < SUBJECT5_MIN_SWEEP_RAD) {
    return false
  }
  if (leftSweep * rightSweep >= 0) {
    return false
  }
  return hasCenterCrossing(points)
}

const isEntryExitFromSameSide = (points: LocalVisit[], rodHalfSpan: number): boolean => {
  const entry = points[0]
  const exit = points[points.length - 1]
  const sideBoundary = rodHalfSpan + SUBJECT5_ENTRY_SIDE_MARGIN_CM
  const enteredFromLeft = entry.u <= -sideBoundary
  const enteredFromRight = entry.u >= sideBoundary
  const exitedToLeft = exit.u <= -sideBoundary
  const exitedToRight = exit.u >= sideBoundary
  return (enteredFromLeft && exitedToLeft) || (enteredFromRight && exitedToRight)
}

export const checkSubject5FigureEightAroundVerticalRods = (
  rodA: XYPoint,
  rodB: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject5CheckResult => {
  const local = buildLocalVisits(rodA, rodB, startPos, blocks)
  if (!local || local.visits.length < SUBJECT5_MIN_LOOP_POINTS) {
    return 'no-eight'
  }

  let hasEightShapeLoop = false
  let hasEightShapeLoopUnder150 = false

  for (let startIndex = 0; startIndex < local.visits.length; startIndex += 1) {
    for (
      let endIndex = startIndex + SUBJECT5_MIN_LOOP_POINTS - 1;
      endIndex < local.visits.length;
      endIndex += 1
    ) {
      const start = local.visits[startIndex]
      const end = local.visits[endIndex]
      if (!isClosedIn3D(start, end)) {
        continue
      }

      const loop = local.visits.slice(startIndex, endIndex + 1)
      if (!isEightShapeLoop(loop, local.rodHalfSpan)) {
        continue
      }

      hasEightShapeLoop = true

      if (!loop.every((visit) => visit.z < SUBJECT5_MAX_HEIGHT_CM)) {
        continue
      }

      hasEightShapeLoopUnder150 = true
      if (isEntryExitFromSameSide(loop, local.rodHalfSpan)) {
        return 'ok'
      }
    }
  }

  if (hasEightShapeLoopUnder150) {
    return 'entry-exit-invalid'
  }
  if (hasEightShapeLoop) {
    return 'height-too-high'
  }
  return 'no-eight'
}
