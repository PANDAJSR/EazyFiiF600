import { ROD_SUBJECT_SPECS, type RodConfig } from './rodConfig'

type XYPoint = {
  x: number
  y: number
}

type XYPointLike = {
  x?: number
  y?: number
}

type ObstacleLineDecoration = {
  kind: 'line'
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

type ObstacleCircleDecoration = {
  kind: 'circle'
  key: string
  cx: number
  cy: number
  r: number
}

export type RodObstacleDecoration = ObstacleLineDecoration | ObstacleCircleDecoration
export type RodRingOccluder = {
  key: string
  cx: number
  cy: number
  r: number
  centerHeight: number
}
export type RodLineOccluder = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  height: number
}

const SUBJECT_RING_DIAMETER = 65
const SUBJECT_RING_RADIUS = SUBJECT_RING_DIAMETER / 2
const SUBJECT9_FIRST_CROSSBAR_HEIGHT = 150
const SUBJECT4_RING_CENTER_HEIGHT = 120
const SUBJECT7_RING_HEIGHTS = [100, 125, 150] as const
const SUBJECT8_HIGH_RING_CENTER_HEIGHT = 150
const SUBJECT8_LOW_RING_CENTER_HEIGHT = 110

const sortPointsAroundCenter = (points: XYPoint[]): XYPoint[] => {
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 },
  )

  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x)
    const angleB = Math.atan2(b.y - center.y, b.x - center.x)

    if (angleA === angleB) {
      const distanceA = (a.x - center.x) ** 2 + (a.y - center.y) ** 2
      const distanceB = (b.x - center.x) ** 2 + (b.y - center.y) ** 2
      return distanceA - distanceB
    }

    return angleA - angleB
  })
}

export const buildRodMarkers = (rodConfig?: RodConfig): Array<XYPoint & { marker: string }> => {
  if (!rodConfig) {
    return []
  }

  return ROD_SUBJECT_SPECS.flatMap((subject) =>
    rodConfig[subject.id]
      .map((point) => ({ marker: subject.marker, x: point.x, y: point.y }))
      .filter((point): point is XYPoint & { marker: string } => Number.isFinite(point.x) && Number.isFinite(point.y)),
  )
}

export const buildTakeoffZone = (rodConfig?: RodConfig): XYPoint[] => {
  if (!rodConfig || rodConfig.takeoffZone.length < 4) {
    return []
  }

  const points = rodConfig.takeoffZone
    .slice(0, 4)
    .filter((point): point is XYPoint => Number.isFinite(point.x) && Number.isFinite(point.y))

  return points.length === 4 ? sortPointsAroundCenter(points) : []
}

const isFinitePoint = (point?: XYPointLike): point is XYPoint =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))

const buildCrossbarLine = (
  start: XYPointLike | undefined,
  end: XYPointLike | undefined,
  key: string,
): ObstacleLineDecoration | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return null
  }
  return {
    kind: 'line',
    key,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
  }
}

const buildHorizontalRing = (
  start: XYPointLike | undefined,
  end: XYPointLike | undefined,
  key: string,
): ObstacleCircleDecoration | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return null
  }
  return {
    kind: 'circle',
    key,
    cx: (start.x + end.x) / 2,
    cy: (start.y + end.y) / 2,
    r: SUBJECT_RING_RADIUS,
  }
}

const buildVerticalRingProjection = (
  start: XYPointLike | undefined,
  end: XYPointLike | undefined,
  key: string,
): ObstacleLineDecoration | null => {
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
  const half = SUBJECT_RING_RADIUS
  const ux = axisX / axisLength
  const uy = axisY / axisLength
  return {
    kind: 'line',
    key,
    x1: centerX - ux * half,
    y1: centerY - uy * half,
    x2: centerX + ux * half,
    y2: centerY + uy * half,
  }
}

export const buildRodObstacleDecorations = (rodConfig?: RodConfig): RodObstacleDecoration[] => {
  if (!rodConfig) {
    return []
  }

  const decorations: RodObstacleDecoration[] = []
  const [subject2A, subject2B] = rodConfig.subject2
  const [subject3A, subject3B] = rodConfig.subject3
  const [subject4A, subject4B] = rodConfig.subject4
  const [subject6A, subject6B, subject6C, subject6D] = rodConfig.subject6
  const [subject7A, subject7B] = rodConfig.subject7
  const [subject8A, subject8B, subject8C] = rodConfig.subject8
  const [subject9A, subject9B] = rodConfig.subject9
  const [subject10A, subject10B, subject10C, subject10D, subject10E, subject10F] = rodConfig.subject10

  const subject2Line = buildCrossbarLine(subject2A, subject2B, 'subject2-crossbar')
  if (subject2Line) {
    decorations.push(subject2Line)
  }

  const subject3RingLine = buildVerticalRingProjection(subject3A, subject3B, 'subject3-vertical-ring')
  if (subject3RingLine) {
    decorations.push(subject3RingLine)
  }

  const subject4Ring = buildHorizontalRing(subject4A, subject4B, 'subject4-horizontal-ring')
  if (subject4Ring) {
    decorations.push(subject4Ring)
  }

  const subject6LineA = buildCrossbarLine(subject6A, subject6B, 'subject6-crossbar-a')
  if (subject6LineA) {
    decorations.push(subject6LineA)
  }
  const subject6LineB = buildCrossbarLine(subject6C, subject6D, 'subject6-crossbar-b')
  if (subject6LineB) {
    decorations.push(subject6LineB)
  }

  const subject7Ring = buildHorizontalRing(subject7A, subject7B, 'subject7-horizontal-rings')
  if (subject7Ring) {
    decorations.push(subject7Ring)
  }

  const subject8HighRing = buildHorizontalRing(subject8A, subject8B, 'subject8-high-ring')
  if (subject8HighRing) {
    decorations.push(subject8HighRing)
  }
  const subject8LowRing = buildHorizontalRing(subject8B, subject8C, 'subject8-low-ring')
  if (subject8LowRing) {
    decorations.push(subject8LowRing)
  }

  const subject9Line = buildCrossbarLine(subject9A, subject9B, 'subject9-crossbar')
  if (subject9Line) {
    decorations.push(subject9Line)
  }

  const subject10RingA = buildHorizontalRing(subject10A, subject10B, 'subject10-ring-a')
  if (subject10RingA) {
    decorations.push(subject10RingA)
  }
  const subject10RingB = buildHorizontalRing(subject10C, subject10D, 'subject10-ring-b')
  if (subject10RingB) {
    decorations.push(subject10RingB)
  }
  const subject10RingC = buildHorizontalRing(subject10E, subject10F, 'subject10-ring-c')
  if (subject10RingC) {
    decorations.push(subject10RingC)
  }

  return decorations
}

const toRingOccluder = (
  key: string,
  start: XYPointLike | undefined,
  end: XYPointLike | undefined,
  centerHeight: number,
): RodRingOccluder | null => {
  const ring = buildHorizontalRing(start, end, key)
  if (!ring) {
    return null
  }
  return {
    key: ring.key,
    cx: ring.cx,
    cy: ring.cy,
    r: ring.r,
    centerHeight,
  }
}

export const buildRodRingOccluders = (rodConfig?: RodConfig): RodRingOccluder[] => {
  if (!rodConfig) {
    return []
  }
  const occluders: RodRingOccluder[] = []
  const [subject4A, subject4B] = rodConfig.subject4
  const [subject7A, subject7B] = rodConfig.subject7
  const [subject8A, subject8B, subject8C] = rodConfig.subject8

  const subject4 = toRingOccluder('subject4-occluder', subject4A, subject4B, SUBJECT4_RING_CENTER_HEIGHT)
  if (subject4) {
    occluders.push(subject4)
  }

  SUBJECT7_RING_HEIGHTS.forEach((height, index) => {
    const ring = toRingOccluder(`subject7-occluder-${index}`, subject7A, subject7B, height)
    if (ring) {
      occluders.push(ring)
    }
  })

  const subject8High = toRingOccluder('subject8-occluder-high', subject8A, subject8B, SUBJECT8_HIGH_RING_CENTER_HEIGHT)
  if (subject8High) {
    occluders.push(subject8High)
  }

  const subject8Low = toRingOccluder('subject8-occluder-low', subject8B, subject8C, SUBJECT8_LOW_RING_CENTER_HEIGHT)
  if (subject8Low) {
    occluders.push(subject8Low)
  }

  return occluders
}

export const buildRodLineOccluders = (rodConfig?: RodConfig): RodLineOccluder[] => {
  if (!rodConfig) {
    return []
  }
  const occluders: RodLineOccluder[] = []
  const [subject3A, subject3B] = rodConfig.subject3
  const [subject9A, subject9B] = rodConfig.subject9

  const subject3Line = buildVerticalRingProjection(subject3A, subject3B, 'subject3-line-occluder')
  if (subject3Line && Number.isFinite(rodConfig.subject3Ring.centerHeight)) {
    occluders.push({
      key: subject3Line.key,
      x1: subject3Line.x1,
      y1: subject3Line.y1,
      x2: subject3Line.x2,
      y2: subject3Line.y2,
      height: (rodConfig.subject3Ring.centerHeight as number) + SUBJECT_RING_RADIUS,
    })
  }

  const subject9Line = buildCrossbarLine(subject9A, subject9B, 'subject9-line-occluder')
  if (subject9Line) {
    const secondHeight = rodConfig.subject9Config.secondCrossbarHeight
    const topHeight = Number.isFinite(secondHeight)
      ? Math.max(SUBJECT9_FIRST_CROSSBAR_HEIGHT, secondHeight as number)
      : SUBJECT9_FIRST_CROSSBAR_HEIGHT
    occluders.push({
      key: subject9Line.key,
      x1: subject9Line.x1,
      y1: subject9Line.y1,
      x2: subject9Line.x2,
      y2: subject9Line.y2,
      height: topHeight,
    })
  }

  return occluders
}
