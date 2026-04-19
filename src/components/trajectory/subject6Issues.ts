import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type LocalVisit = {
  u: number
  v: number
  w: number
}

type LocalContext = {
  visits: LocalVisit[]
  halfGap: number
}

export type Subject6CheckResult = 'ok' | 'no-eight' | 'entry-exit-invalid'

const SUBJECT6_CROSSBAR_HEIGHT_CM = 150
const SUBJECT6_MIN_LOOP_POINTS = 6
const SUBJECT6_CLOSURE_TOLERANCE_CM = 8
const SUBJECT6_MIN_SWEEP_RAD = Math.PI * 1.6
const SUBJECT6_CENTER_CROSS_TOLERANCE_CM = 8
const SUBJECT6_CENTER_CROSS_HEIGHT_TOLERANCE_CM = 45
const SUBJECT6_ENTRY_SIDE_MARGIN_CM = 10
const SUBJECT6_BAR_DIRECTION_TOLERANCE_CM = 70
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

const normalize2D = (x: number, y: number): { x: number; y: number } | null => {
  const length = Math.hypot(x, y)
  if (length < AXIS_EPSILON) {
    return null
  }
  return { x: x / length, y: y / length }
}

const buildLocalContext = (
  rodA: XYPoint,
  rodB: XYPoint,
  rodC: XYPoint,
  rodD: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): LocalContext | null => {
  const center1X = (rodA.x + rodB.x) / 2
  const center1Y = (rodA.y + rodB.y) / 2
  const center2X = (rodC.x + rodD.x) / 2
  const center2Y = (rodC.y + rodD.y) / 2

  const gapAxis = normalize2D(center2X - center1X, center2Y - center1Y)
  if (!gapAxis) {
    return null
  }

  const dir1 = normalize2D(rodB.x - rodA.x, rodB.y - rodA.y)
  const dir2 = normalize2D(rodD.x - rodC.x, rodD.y - rodC.y)
  let barAxis = null as { x: number; y: number } | null
  if (dir1 && dir2) {
    barAxis = normalize2D(dir1.x + dir2.x, dir1.y + dir2.y)
  } else if (dir1 || dir2) {
    barAxis = dir1 ?? dir2
  }
  if (!barAxis) {
    barAxis = { x: -gapAxis.y, y: gapAxis.x }
  }

  const middleX = (center1X + center2X) / 2
  const middleY = (center1Y + center2Y) / 2
  const halfGap = Math.hypot(center2X - center1X, center2Y - center1Y) / 2

  const visits = buildPathVisits(startPos, blocks).map((visit) => {
    const relX = visit.x - middleX
    const relY = visit.y - middleY
    return {
      u: relX * gapAxis.x + relY * gapAxis.y,
      v: relX * barAxis.x + relY * barAxis.y,
      w: visit.z - SUBJECT6_CROSSBAR_HEIGHT_CM,
    }
  })

  return { visits, halfGap }
}

const isClosedIn3D = (start: LocalVisit, end: LocalVisit): boolean =>
  Math.hypot(end.u - start.u, end.v - start.v, end.w - start.w) <= SUBJECT6_CLOSURE_TOLERANCE_CM

const calcWindingSweep = (points: LocalVisit[], centerU: number): number => {
  let sweep = 0
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const prevAngle = Math.atan2(prev.w, prev.u - centerU)
    const currAngle = Math.atan2(curr.w, curr.u - centerU)
    sweep += shortestAngleDelta(prevAngle, currAngle)
  }
  return sweep
}

const hasCenterCrossing = (points: LocalVisit[]): boolean => {
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const curr = points[index]
    const reachCenter = Math.abs(prev.u) <= SUBJECT6_CENTER_CROSS_TOLERANCE_CM || Math.abs(curr.u) <= SUBJECT6_CENTER_CROSS_TOLERANCE_CM
    const throughCenter = prev.u * curr.u < 0
    const centerHeightOk =
      Math.abs(prev.w) <= SUBJECT6_CENTER_CROSS_HEIGHT_TOLERANCE_CM ||
      Math.abs(curr.w) <= SUBJECT6_CENTER_CROSS_HEIGHT_TOLERANCE_CM
    if ((reachCenter || throughCenter) && centerHeightOk) {
      return true
    }
  }
  return false
}

const isVerticalFigureEightLoop = (points: LocalVisit[], halfGap: number): boolean => {
  if (!points.every((visit) => Math.abs(visit.v) <= SUBJECT6_BAR_DIRECTION_TOLERANCE_CM)) {
    return false
  }

  const leftSweep = calcWindingSweep(points, -halfGap)
  const rightSweep = calcWindingSweep(points, halfGap)
  if (Math.abs(leftSweep) < SUBJECT6_MIN_SWEEP_RAD || Math.abs(rightSweep) < SUBJECT6_MIN_SWEEP_RAD) {
    return false
  }
  if (leftSweep * rightSweep >= 0) {
    return false
  }

  return hasCenterCrossing(points)
}

const isEntryExitFromSameSide = (points: LocalVisit[], halfGap: number): boolean => {
  const entry = points[0]
  const exit = points[points.length - 1]
  const sideBoundary = halfGap + SUBJECT6_ENTRY_SIDE_MARGIN_CM
  const enteredFromLeft = entry.u <= -sideBoundary
  const enteredFromRight = entry.u >= sideBoundary
  const exitedToLeft = exit.u <= -sideBoundary
  const exitedToRight = exit.u >= sideBoundary
  return (enteredFromLeft && exitedToLeft) || (enteredFromRight && exitedToRight)
}

export const checkSubject6VerticalFigureEightAroundCrossbars = (
  rodA: XYPoint,
  rodB: XYPoint,
  rodC: XYPoint,
  rodD: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): Subject6CheckResult => {
  const local = buildLocalContext(rodA, rodB, rodC, rodD, startPos, blocks)
  if (!local || local.visits.length < SUBJECT6_MIN_LOOP_POINTS) {
    return 'no-eight'
  }

  let hasEightShapeLoop = false
  const requiredEndIndex = local.visits.length - 1

  for (let startIndex = 0; startIndex < local.visits.length; startIndex += 1) {
    const loopPointCount = requiredEndIndex - startIndex + 1
    if (loopPointCount < SUBJECT6_MIN_LOOP_POINTS) {
      continue
    }

    const start = local.visits[startIndex]
    const end = local.visits[requiredEndIndex]
    if (!isClosedIn3D(start, end)) {
      continue
    }

    const loop = local.visits.slice(startIndex, requiredEndIndex + 1)
    if (!isVerticalFigureEightLoop(loop, local.halfGap)) {
      continue
    }

    hasEightShapeLoop = true
    if (isEntryExitFromSameSide(loop, local.halfGap)) {
      return 'ok'
    }
  }

  if (hasEightShapeLoop) {
    return 'entry-exit-invalid'
  }
  return 'no-eight'
}
