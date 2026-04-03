import type { ParsedBlock } from '../../types/fii'
import { buildPathVisits, type XYZ } from './trajectoryUtils'

type XYPoint = {
  x: number
  y: number
}

type Point3D = {
  x: number
  y: number
  z: number
}

const SUBJECT_RING_DIAMETER_CM = 65
const SUBJECT_RING_RADIUS_CM = SUBJECT_RING_DIAMETER_CM / 2
const SUBJECT4_RING_CENTER_HEIGHT_CM = 120
const RING_RADIUS_TOLERANCE_CM = 3
const PLANE_TOLERANCE_CM = 1
const AXIS_EPSILON = 1e-6

const dot = (a: Point3D, b: Point3D) => a.x * b.x + a.y * b.y + a.z * b.z

const sub = (a: Point3D, b: Point3D): Point3D => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
})

const add = (a: Point3D, b: Point3D): Point3D => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})

const scale = (value: Point3D, ratio: number): Point3D => ({
  x: value.x * ratio,
  y: value.y * ratio,
  z: value.z * ratio,
})

const normalize = (value: Point3D): Point3D | null => {
  const length = Math.hypot(value.x, value.y, value.z)
  if (length < AXIS_EPSILON) {
    return null
  }
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  }
}

const isPointInsideRingPlaneCircle = (
  point: Point3D,
  center: Point3D,
  planeNormalUnit: Point3D,
): boolean => {
  const rel = sub(point, center)
  const planeDistance = Math.abs(dot(rel, planeNormalUnit))
  if (planeDistance > PLANE_TOLERANCE_CM) {
    return false
  }

  const relLengthSq = dot(rel, rel)
  const projectedSq = relLengthSq - planeDistance * planeDistance
  return projectedSq <= (SUBJECT_RING_RADIUS_CM + RING_RADIUS_TOLERANCE_CM) ** 2
}

const segmentPassThroughRing = (
  start: Point3D,
  end: Point3D,
  center: Point3D,
  planeNormalUnit: Point3D,
): boolean => {
  if (
    isPointInsideRingPlaneCircle(start, center, planeNormalUnit) ||
    isPointInsideRingPlaneCircle(end, center, planeNormalUnit)
  ) {
    return true
  }

  const startSignedDistance = dot(sub(start, center), planeNormalUnit)
  const endSignedDistance = dot(sub(end, center), planeNormalUnit)
  if (startSignedDistance * endSignedDistance > 0) {
    return false
  }

  const denominator = startSignedDistance - endSignedDistance
  if (Math.abs(denominator) < AXIS_EPSILON) {
    return false
  }

  const ratio = startSignedDistance / denominator
  if (ratio < 0 || ratio > 1) {
    return false
  }

  const intersection = add(start, scale(sub(end, start), ratio))
  return isPointInsideRingPlaneCircle(intersection, center, planeNormalUnit)
}

const findPassThroughRingBlockId = (
  center: Point3D,
  planeNormalUnit: Point3D,
  startPos: XYZ,
  blocks: ParsedBlock[],
): string | undefined => {
  const visits = buildPathVisits(startPos, blocks)
  for (let index = 1; index < visits.length; index += 1) {
    const start = visits[index - 1]
    const end = visits[index]
    if (segmentPassThroughRing(start, end, center, planeNormalUnit)) {
      return end.blockId
    }
  }
  return undefined
}

export const checkSubject3PassThroughVerticalRing = (
  rodA: XYPoint,
  rodB: XYPoint,
  centerHeight: number,
  startPos: XYZ,
  blocks: ParsedBlock[],
): string | undefined => {
  const center: Point3D = {
    x: (rodA.x + rodB.x) / 2,
    y: (rodA.y + rodB.y) / 2,
    z: centerHeight,
  }
  const axis = { x: rodB.x - rodA.x, y: rodB.y - rodA.y, z: 0 }
  const planeNormal = {
    x: axis.y,
    y: -axis.x,
    z: 0,
  }
  const normalUnit = normalize(planeNormal)
  if (!normalUnit) {
    return undefined
  }

  return findPassThroughRingBlockId(center, normalUnit, startPos, blocks)
}

export const checkSubject4PassThroughHorizontalRing = (
  rodA: XYPoint,
  rodB: XYPoint,
  startPos: XYZ,
  blocks: ParsedBlock[],
): string | undefined => {
  const center: Point3D = {
    x: (rodA.x + rodB.x) / 2,
    y: (rodA.y + rodB.y) / 2,
    z: SUBJECT4_RING_CENTER_HEIGHT_CM,
  }
  const horizontalPlaneNormal = { x: 0, y: 0, z: 1 }
  return findPassThroughRingBlockId(center, horizontalPlaneNormal, startPos, blocks)
}
