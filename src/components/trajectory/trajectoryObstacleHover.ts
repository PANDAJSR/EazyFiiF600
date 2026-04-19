import type { RodConfig } from './rodConfig'

type XYPoint = {
  x: number
  y: number
}

type XYPointLike = {
  x?: number
  y?: number
}

type ObstacleHitShape =
  | {
      kind: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
    }
  | {
      kind: 'circle'
      cx: number
      cy: number
      r: number
    }

export type RodObstacleHoverInfo = {
  key: string
  subjectLabel: string
  typeLabel: '横杆' | '平圈' | '竖圈'
  details: string[]
  shape: ObstacleHitShape
}

const SUBJECT_RING_DIAMETER = 65
const SUBJECT_RING_RADIUS = SUBJECT_RING_DIAMETER / 2
const COMMON_CROSSBAR_HEIGHT = 150
const SUBJECT4_RING_CENTER_HEIGHT = 120
const SUBJECT7_RING_HEIGHTS = [100, 125, 150] as const
const SUBJECT8_HIGH_RING_CENTER_HEIGHT = 150
const SUBJECT8_LOW_RING_CENTER_HEIGHT = 110

type ObstacleLine = { x1: number; y1: number; x2: number; y2: number }
type ObstacleCircle = { cx: number; cy: number; r: number }

const isFinitePoint = (point?: XYPointLike): point is XYPoint =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))

const buildCrossbarLine = (start: XYPointLike | undefined, end: XYPointLike | undefined): ObstacleLine | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return null
  }
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
}

const buildHorizontalRing = (start: XYPointLike | undefined, end: XYPointLike | undefined): ObstacleCircle | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return null
  }
  return {
    cx: (start.x + end.x) / 2,
    cy: (start.y + end.y) / 2,
    r: SUBJECT_RING_RADIUS,
  }
}

const buildVerticalRingProjection = (start: XYPointLike | undefined, end: XYPointLike | undefined): ObstacleLine | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return null
  }
  const axisX = end.x - start.x
  const axisY = end.y - start.y
  const axisLength = Math.hypot(axisX, axisY)
  if (axisLength < 0.001) {
    return null
  }
  const centerX = (start.x + end.x) / 2
  const centerY = (start.y + end.y) / 2
  const ux = axisX / axisLength
  const uy = axisY / axisLength
  return {
    x1: centerX - ux * SUBJECT_RING_RADIUS,
    y1: centerY - uy * SUBJECT_RING_RADIUS,
    x2: centerX + ux * SUBJECT_RING_RADIUS,
    y2: centerY + uy * SUBJECT_RING_RADIUS,
  }
}

const formatCm = (value: number) => `${Math.round(value)} cm`

const pushLineInfo = (
  list: RodObstacleHoverInfo[],
  key: string,
  subjectLabel: string,
  typeLabel: '横杆' | '竖圈',
  line: ObstacleLine | null,
  details: string[],
) => {
  if (!line) {
    return
  }
  list.push({
    key,
    subjectLabel,
    typeLabel,
    details,
    shape: { kind: 'line', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 },
  })
}

const pushCircleInfo = (
  list: RodObstacleHoverInfo[],
  key: string,
  subjectLabel: string,
  circle: ObstacleCircle | null,
  details: string[],
) => {
  if (!circle) {
    return
  }
  list.push({
    key,
    subjectLabel,
    typeLabel: '平圈',
    details,
    shape: { kind: 'circle', cx: circle.cx, cy: circle.cy, r: circle.r },
  })
}

export const buildRodObstacleHoverInfos = (rodConfig?: RodConfig): RodObstacleHoverInfo[] => {
  if (!rodConfig) {
    return []
  }

  const infos: RodObstacleHoverInfo[] = []
  const [subject2A, subject2B] = rodConfig.subject2
  const [subject3A, subject3B] = rodConfig.subject3
  const [subject4A, subject4B] = rodConfig.subject4
  const [subject6A, subject6B, subject6C, subject6D] = rodConfig.subject6
  const [subject7A, subject7B] = rodConfig.subject7
  const [subject8A, subject8B, subject8C] = rodConfig.subject8
  const [subject9A, subject9B] = rodConfig.subject9
  const [subject10A, subject10B, subject10C, subject10D, subject10E, subject10F] = rodConfig.subject10
  const secondCrossbarHeight = rodConfig.subject9Config.secondCrossbarHeight

  const subject2Line = buildCrossbarLine(subject2A, subject2B)
  if (subject2Line) {
    const length = Math.hypot(subject2Line.x2 - subject2Line.x1, subject2Line.y2 - subject2Line.y1)
    pushLineInfo(infos, 'subject2-hover', '科目二', '横杆', subject2Line, [
      `长度：${formatCm(length)}`,
      `高度：${formatCm(COMMON_CROSSBAR_HEIGHT)}`,
    ])
  }

  const subject3Projection = buildVerticalRingProjection(subject3A, subject3B)
  if (subject3Projection && Number.isFinite(rodConfig.subject3Ring.centerHeight)) {
    const centerHeight = rodConfig.subject3Ring.centerHeight as number
    pushLineInfo(infos, 'subject3-hover', '科目三', '竖圈', subject3Projection, [
      `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
      `圈心高度：${formatCm(centerHeight)}`,
    ])
  }

  pushCircleInfo(infos, 'subject4-hover', '科目四', buildHorizontalRing(subject4A, subject4B), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    `圈心高度：${formatCm(SUBJECT4_RING_CENTER_HEIGHT)}`,
  ])

  const subject6LineA = buildCrossbarLine(subject6A, subject6B)
  if (subject6LineA) {
    const length = Math.hypot(subject6LineA.x2 - subject6LineA.x1, subject6LineA.y2 - subject6LineA.y1)
    pushLineInfo(infos, 'subject6-hover-a', '科目六（上）', '横杆', subject6LineA, [
      `长度：${formatCm(length)}`,
      `高度：${formatCm(COMMON_CROSSBAR_HEIGHT)}`,
    ])
  }
  const subject6LineB = buildCrossbarLine(subject6C, subject6D)
  if (subject6LineB) {
    const length = Math.hypot(subject6LineB.x2 - subject6LineB.x1, subject6LineB.y2 - subject6LineB.y1)
    pushLineInfo(infos, 'subject6-hover-b', '科目六（下）', '横杆', subject6LineB, [
      `长度：${formatCm(length)}`,
      `高度：${formatCm(COMMON_CROSSBAR_HEIGHT)}`,
    ])
  }

  pushCircleInfo(infos, 'subject7-hover', '科目七', buildHorizontalRing(subject7A, subject7B), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    `圈心高度：${SUBJECT7_RING_HEIGHTS.map((height) => Math.round(height)).join(' / ')} cm`,
  ])

  pushCircleInfo(infos, 'subject8-hover-high', '科目八（高圈）', buildHorizontalRing(subject8A, subject8B), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    `圈心高度：${formatCm(SUBJECT8_HIGH_RING_CENTER_HEIGHT)}`,
  ])
  pushCircleInfo(infos, 'subject8-hover-low', '科目八（低圈）', buildHorizontalRing(subject8B, subject8C), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    `圈心高度：${formatCm(SUBJECT8_LOW_RING_CENTER_HEIGHT)}`,
  ])

  const subject9Line = buildCrossbarLine(subject9A, subject9B)
  if (subject9Line) {
    const length = Math.hypot(subject9Line.x2 - subject9Line.x1, subject9Line.y2 - subject9Line.y1)
    const firstHeightText = formatCm(COMMON_CROSSBAR_HEIGHT)
    const secondHeightText = Number.isFinite(secondCrossbarHeight) ? formatCm(secondCrossbarHeight as number) : '待题卡'
    const middleHeightText = Number.isFinite(secondCrossbarHeight)
      ? formatCm((COMMON_CROSSBAR_HEIGHT + (secondCrossbarHeight as number)) / 2)
      : '待题卡'
    pushLineInfo(infos, 'subject9-hover', '科目九', '横杆', subject9Line, [
      `长度：${formatCm(length)}`,
      `第一横杆高度：${firstHeightText}`,
      `第二横杆高度：${secondHeightText}`,
      `中间高度：${middleHeightText}`,
    ])
  }

  pushCircleInfo(infos, 'subject10-hover-a', '科目十（圈1）', buildHorizontalRing(subject10A, subject10B), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    '圈心高度：待题卡',
  ])
  pushCircleInfo(infos, 'subject10-hover-b', '科目十（圈2）', buildHorizontalRing(subject10C, subject10D), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    '圈心高度：待题卡',
  ])
  pushCircleInfo(infos, 'subject10-hover-c', '科目十（圈3）', buildHorizontalRing(subject10E, subject10F), [
    `直径：${formatCm(SUBJECT_RING_DIAMETER)}`,
    '圈心高度：待题卡',
  ])

  return infos
}

const pointToSegmentDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const segmentLengthSquared = dx * dx + dy * dy
  if (segmentLengthSquared < 0.0001) {
    return Math.hypot(px - x1, py - y1)
  }
  const ratio = ((px - x1) * dx + (py - y1) * dy) / segmentLengthSquared
  const clampedRatio = Math.max(0, Math.min(1, ratio))
  const nearestX = x1 + clampedRatio * dx
  const nearestY = y1 + clampedRatio * dy
  return Math.hypot(px - nearestX, py - nearestY)
}

export const findNearestHoveredRodObstacle = (
  infos: RodObstacleHoverInfo[],
  x: number,
  y: number,
  toleranceCm: number,
): RodObstacleHoverInfo | null => {
  let nearest: RodObstacleHoverInfo | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const info of infos) {
    const distance =
      info.shape.kind === 'line'
        ? pointToSegmentDistance(x, y, info.shape.x1, info.shape.y1, info.shape.x2, info.shape.y2)
        : Math.abs(Math.hypot(x - info.shape.cx, y - info.shape.cy) - info.shape.r)

    if (distance > toleranceCm || distance >= nearestDistance) {
      continue
    }
    nearest = info
    nearestDistance = distance
  }

  return nearest
}
