import type { ParsedBlock } from '../../types/fii'
import type { RodConfig } from './rodConfig'
import { buildPathVisits, type XYZ } from './trajectoryUtils'
import type { TrajectoryIssue } from './trajectoryIssues'

const ROD_RADIUS = 1.8
const ROD_HEIGHT = 170
const CROSSBAR_RADIUS = 1.8 * 0.72
const SUBJECT2_CROSSBAR_HEIGHT = 150
const SUBJECT6_CROSSBAR_HEIGHT = 150
const SUBJECT9_FIRST_CROSSBAR_HEIGHT = 150
const RING_MAJOR_RADIUS = 65 / 2 // 圈的大半径
const RING_MINOR_RADIUS = 1.35 // 圈的管半径
const SUBJECT4_RING_CENTER_HEIGHT = 120
const SUBJECT7_RING_HEIGHTS = [100, 125, 150]
const SUBJECT8_HIGH_RING_CENTER_HEIGHT = 150
const SUBJECT8_LOW_RING_CENTER_HEIGHT = 110

// 默认碰撞阈值（10cm安全距离）
const DEFAULT_COLLISION_THRESHOLD = 10

// 3D向量类型
type Vector3 = { x: number; y: number; z: number }

// 线段类型
type Segment = { start: Vector3; end: Vector3 }

// 障碍物类型
type Obstacle =
  | { type: 'vertical-rod'; x: number; y: number; radius: number; height: number }
  | { type: 'crossbar'; start: Vector3; end: Vector3; radius: number }
  | { type: 'vertical-ring'; center: Vector3; normal: Vector3; majorRadius: number; minorRadius: number }
  | { type: 'horizontal-ring'; center: Vector3; majorRadius: number; minorRadius: number }

const isFiniteNumber = (value: number | undefined): value is number => Number.isFinite(value)
const isFiniteRodPoint = (point?: { x?: number; y?: number }): point is { x: number; y: number } =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))

/**
 * 计算三维空间中点到线段的最近点
 */
const closestPointOnSegment = (point: Vector3, segment: Segment): Vector3 => {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const dz = segment.end.z - segment.start.z
  const lengthSq = dx * dx + dy * dy + dz * dz

  if (lengthSq === 0) {
    return segment.start
  }

  let t = ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy + (point.z - segment.start.z) * dz) / lengthSq
  t = Math.max(0, Math.min(1, t))

  return {
    x: segment.start.x + t * dx,
    y: segment.start.y + t * dy,
    z: segment.start.z + t * dz,
  }
}

/**
 * 计算两点间距离
 */
const distance = (a: Vector3, b: Vector3): number => {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/**
 * 计算线段到点的最短距离
 */
const segmentToPointDistance = (segment: Segment, point: Vector3): number => {
  const closest = closestPointOnSegment(point, segment)
  return distance(closest, point)
}

/**
 * 计算两条空间线段之间的最短距离
 * 使用数值优化方法
 */
const segmentToSegmentDistance = (s1: Segment, s2: Segment): number => {
  // 使用参数化方法计算两线段间最短距离
  const dx1 = s1.end.x - s1.start.x
  const dy1 = s1.end.y - s1.start.y
  const dz1 = s1.end.z - s1.start.z
  const dx2 = s2.end.x - s2.start.x
  const dy2 = s2.end.y - s2.start.y
  const dz2 = s2.end.z - s2.start.z

  const wx = s1.start.x - s2.start.x
  const wy = s1.start.y - s2.start.y
  const wz = s1.start.z - s2.start.z

  const a = dx1 * dx1 + dy1 * dy1 + dz1 * dz1
  const b = dx1 * dx2 + dy1 * dy2 + dz1 * dz2
  const c = dx2 * dx2 + dy2 * dy2 + dz2 * dz2
  const d = dx1 * wx + dy1 * wy + dz1 * wz
  const e = dx2 * wx + dy2 * wy + dz2 * wz

  const D = a * c - b * b
  let sD = 1
  let tD = 1
  let sN = 0
  let tN = 0

  const SMALL_NUM = 1e-10

  if (D < SMALL_NUM) {
    sN = 0
    tN = e
    tD = c
  } else {
    sN = b * e - c * d
    tN = a * e - b * d
    if (sN < 0) {
      sN = 0
      tN = e
      tD = c
    } else if (sN > sD) {
      sN = sD
      tN = e + b
      tD = c
    }
  }

  if (tN < 0) {
    tN = 0
    if (-d < 0) {
      sN = 0
    } else if (-d > a) {
      sN = sD
    } else {
      sN = -d
      sD = a
    }
  } else if (tN > tD) {
    tN = tD
    if ((-d + b) < 0) {
      sN = 0
    } else if ((-d + b) > a) {
      sN = sD
    } else {
      sN = -d + b
      sD = a
    }
  }

  const sc = Math.abs(sN) < SMALL_NUM ? 0 : sN / sD
  const tc = Math.abs(tN) < SMALL_NUM ? 0 : tN / tD

  const closest1 = {
    x: s1.start.x + sc * dx1,
    y: s1.start.y + sc * dy1,
    z: s1.start.z + sc * dz1,
  }
  const closest2 = {
    x: s2.start.x + tc * dx2,
    y: s2.start.y + tc * dy2,
    z: s2.start.z + tc * dz2,
  }

  return distance(closest1, closest2)
}

/**
 * 计算线段到竖杆（圆柱体）的最短距离
 */
const segmentToVerticalRodDistance = (segment: Segment, rod: Obstacle & { type: 'vertical-rod' }): number => {
  const segMinZ = Math.min(segment.start.z, segment.end.z)
  const segMaxZ = Math.max(segment.start.z, segment.end.z)
  const rodMinZ = 0
  const rodMaxZ = rod.height

  // 计算XY平面上的距离
  const startXY = { x: segment.start.x, y: segment.start.y, z: 0 }
  const endXY = { x: segment.end.x, y: segment.end.y, z: 0 }
  const rodCenterXY = { x: rod.x, y: rod.y, z: 0 }

  const xySegment: Segment = { start: startXY, end: endXY }
  const xyDistance = segmentToPointDistance(xySegment, rodCenterXY)

  // 计算Z方向上的距离
  let zDistance = 0
  if (segMaxZ < rodMinZ) {
    zDistance = rodMinZ - segMaxZ
  } else if (segMinZ > rodMaxZ) {
    zDistance = segMinZ - rodMaxZ
  }

  // 3D距离
  const distance3D = Math.hypot(xyDistance, zDistance)
  return Math.max(0, distance3D - rod.radius)
}

/**
 * 计算线段到横杆（水平圆柱体）的最短距离
 */
const segmentToCrossbarDistance = (segment: Segment, crossbar: Obstacle & { type: 'crossbar' }): number => {
  const crossbarSegment: Segment = {
    start: crossbar.start,
    end: crossbar.end,
  }
  const minDist = segmentToSegmentDistance(segment, crossbarSegment)
  return Math.max(0, minDist - crossbar.radius)
}

/**
 * 计算点到圆环的距离
 */
const pointToRingDistance = (point: Vector3, center: Vector3, normal: Vector3, majorRadius: number): number => {
  // 将点投影到圆环平面
  const toPoint = {
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }

  // 计算点在法向量上的投影距离
  const dotProduct = toPoint.x * normal.x + toPoint.y * normal.y + toPoint.z * normal.z

  // 点到平面的距离
  const distToPlane = Math.abs(dotProduct)

  // 点在平面上的投影
  const projected = {
    x: toPoint.x - dotProduct * normal.x,
    y: toPoint.y - dotProduct * normal.y,
    z: toPoint.z - dotProduct * normal.z,
  }

  // 投影点到圆心的距离
  const distFromCenter = Math.hypot(projected.x, projected.y, projected.z)

  // 点到圆环中心圆的距离
  const distToTorusCenter = Math.abs(distFromCenter - majorRadius)

  // 3D距离
  return Math.hypot(distToTorusCenter, distToPlane)
}

/**
 * 计算线段到竖圈（垂直圆环）的最短距离
 * 使用采样点方法
 */
const segmentToVerticalRingDistance = (segment: Segment, ring: Obstacle & { type: 'vertical-ring' }): number => {
  // 对线段进行采样（5个采样点）
  const sampleCount = 5
  let minDistance = Infinity

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount
    const point = {
      x: segment.start.x + t * (segment.end.x - segment.start.x),
      y: segment.start.y + t * (segment.end.y - segment.start.y),
      z: segment.start.z + t * (segment.end.z - segment.start.z),
    }

    const dist = pointToRingDistance(point, ring.center, ring.normal, ring.majorRadius)
    minDistance = Math.min(minDistance, dist)
  }

  return Math.max(0, minDistance - ring.minorRadius)
}

/**
 * 计算线段到横圈（水平圆环）的最短距离
 * 使用采样点方法
 */
const segmentToHorizontalRingDistance = (segment: Segment, ring: Obstacle & { type: 'horizontal-ring' }): number => {
  // 水平圆环的法向量是Z轴
  const normal = { x: 0, y: 0, z: 1 }

  // 对线段进行采样
  const sampleCount = 5
  let minDistance = Infinity

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount
    const point = {
      x: segment.start.x + t * (segment.end.x - segment.start.x),
      y: segment.start.y + t * (segment.end.y - segment.start.y),
      z: segment.start.z + t * (segment.end.z - segment.start.z),
    }

    const dist = pointToRingDistance(point, ring.center, normal, ring.majorRadius)
    minDistance = Math.min(minDistance, dist)
  }

  return Math.max(0, minDistance - ring.minorRadius)
}

/**
 * 根据rodConfig构建所有障碍物列表
 */
const buildObstacles = (rodConfig: RodConfig): Obstacle[] => {
  const obstacles: Obstacle[] = []

  // 科目1：竖杆
  const subject1Rod = rodConfig.subject1[0]
  if (isFiniteRodPoint(subject1Rod)) {
    obstacles.push({
      type: 'vertical-rod',
      x: subject1Rod.x,
      y: subject1Rod.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
  }

  // 科目2：两根竖杆 + 横杆
  const subject2RodA = rodConfig.subject2[0]
  const subject2RodB = rodConfig.subject2[1]
  if (isFiniteRodPoint(subject2RodA) && isFiniteRodPoint(subject2RodB)) {
    obstacles.push({
      type: 'vertical-rod',
      x: subject2RodA.x,
      y: subject2RodA.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    obstacles.push({
      type: 'vertical-rod',
      x: subject2RodB.x,
      y: subject2RodB.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    obstacles.push({
      type: 'crossbar',
      start: { x: subject2RodA.x, y: subject2RodA.y, z: SUBJECT2_CROSSBAR_HEIGHT },
      end: { x: subject2RodB.x, y: subject2RodB.y, z: SUBJECT2_CROSSBAR_HEIGHT },
      radius: CROSSBAR_RADIUS,
    })
  }

  // 科目3：两根竖杆 + 竖圈
  const subject3RodA = rodConfig.subject3[0]
  const subject3RodB = rodConfig.subject3[1]
  if (isFiniteRodPoint(subject3RodA) && isFiniteRodPoint(subject3RodB)) {
    obstacles.push({
      type: 'vertical-rod',
      x: subject3RodA.x,
      y: subject3RodA.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    obstacles.push({
      type: 'vertical-rod',
      x: subject3RodB.x,
      y: subject3RodB.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })

    const centerHeight = rodConfig.subject3Ring.centerHeight
    if (isFiniteNumber(centerHeight)) {
      const centerX = (subject3RodA.x + subject3RodB.x) / 2
      const centerY = (subject3RodA.y + subject3RodB.y) / 2
      const dx = subject3RodB.x - subject3RodA.x
      const dy = subject3RodB.y - subject3RodA.y
      const length = Math.hypot(dx, dy)
      if (length > 0.001) {
        const normalX = -dy / length
        const normalY = dx / length
        obstacles.push({
          type: 'vertical-ring',
          center: { x: centerX, y: centerY, z: centerHeight },
          normal: { x: normalX, y: normalY, z: 0 },
          majorRadius: RING_MAJOR_RADIUS,
          minorRadius: RING_MINOR_RADIUS,
        })
      }
    }
  }

  // 科目4：两根竖杆 + 横圈
  const subject4RodA = rodConfig.subject4[0]
  const subject4RodB = rodConfig.subject4[1]
  if (isFiniteRodPoint(subject4RodA) && isFiniteRodPoint(subject4RodB)) {
    obstacles.push({
      type: 'vertical-rod',
      x: subject4RodA.x,
      y: subject4RodA.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    obstacles.push({
      type: 'vertical-rod',
      x: subject4RodB.x,
      y: subject4RodB.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    const centerX = (subject4RodA.x + subject4RodB.x) / 2
    const centerY = (subject4RodA.y + subject4RodB.y) / 2
    obstacles.push({
      type: 'horizontal-ring',
      center: { x: centerX, y: centerY, z: SUBJECT4_RING_CENTER_HEIGHT },
      majorRadius: RING_MAJOR_RADIUS,
      minorRadius: RING_MINOR_RADIUS,
    })
  }

  // 科目5：两根竖杆
  const subject5RodA = rodConfig.subject5[0]
  const subject5RodB = rodConfig.subject5[1]
  if (isFiniteRodPoint(subject5RodA) && isFiniteRodPoint(subject5RodB)) {
    obstacles.push({
      type: 'vertical-rod',
      x: subject5RodA.x,
      y: subject5RodA.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
    obstacles.push({
      type: 'vertical-rod',
      x: subject5RodB.x,
      y: subject5RodB.y,
      radius: ROD_RADIUS,
      height: ROD_HEIGHT,
    })
  }

  // 科目6：四根竖杆 + 两根横杆
  const subject6RodA = rodConfig.subject6[0]
  const subject6RodB = rodConfig.subject6[1]
  const subject6RodC = rodConfig.subject6[2]
  const subject6RodD = rodConfig.subject6[3]
  if (
    isFiniteRodPoint(subject6RodA) &&
    isFiniteRodPoint(subject6RodB) &&
    isFiniteRodPoint(subject6RodC) &&
    isFiniteRodPoint(subject6RodD)
  ) {
    obstacles.push(
      { type: 'vertical-rod', x: subject6RodA.x, y: subject6RodA.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject6RodB.x, y: subject6RodB.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject6RodC.x, y: subject6RodC.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject6RodD.x, y: subject6RodD.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      {
        type: 'crossbar',
        start: { x: subject6RodA.x, y: subject6RodA.y, z: SUBJECT6_CROSSBAR_HEIGHT },
        end: { x: subject6RodB.x, y: subject6RodB.y, z: SUBJECT6_CROSSBAR_HEIGHT },
        radius: CROSSBAR_RADIUS,
      },
      {
        type: 'crossbar',
        start: { x: subject6RodC.x, y: subject6RodC.y, z: SUBJECT6_CROSSBAR_HEIGHT },
        end: { x: subject6RodD.x, y: subject6RodD.y, z: SUBJECT6_CROSSBAR_HEIGHT },
        radius: CROSSBAR_RADIUS,
      },
    )
  }

  // 科目7：两根竖杆 + 三个横圈
  const subject7RodA = rodConfig.subject7[0]
  const subject7RodB = rodConfig.subject7[1]
  if (isFiniteRodPoint(subject7RodA) && isFiniteRodPoint(subject7RodB)) {
    obstacles.push(
      { type: 'vertical-rod', x: subject7RodA.x, y: subject7RodA.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject7RodB.x, y: subject7RodB.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
    )
    const centerX = (subject7RodA.x + subject7RodB.x) / 2
    const centerY = (subject7RodA.y + subject7RodB.y) / 2
    for (const height of SUBJECT7_RING_HEIGHTS) {
      obstacles.push({
        type: 'horizontal-ring',
        center: { x: centerX, y: centerY, z: height },
        majorRadius: RING_MAJOR_RADIUS,
        minorRadius: RING_MINOR_RADIUS,
      })
    }
  }

  // 科目8：三根竖杆 + 两个横圈
  const subject8RodA = rodConfig.subject8[0]
  const subject8RodB = rodConfig.subject8[1]
  const subject8RodC = rodConfig.subject8[2]
  if (isFiniteRodPoint(subject8RodA) && isFiniteRodPoint(subject8RodB) && isFiniteRodPoint(subject8RodC)) {
    obstacles.push(
      { type: 'vertical-rod', x: subject8RodA.x, y: subject8RodA.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject8RodB.x, y: subject8RodB.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject8RodC.x, y: subject8RodC.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
    )
    // 高圈在AB之间
    const centerX1 = (subject8RodA.x + subject8RodB.x) / 2
    const centerY1 = (subject8RodA.y + subject8RodB.y) / 2
    obstacles.push({
      type: 'horizontal-ring',
      center: { x: centerX1, y: centerY1, z: SUBJECT8_HIGH_RING_CENTER_HEIGHT },
      majorRadius: RING_MAJOR_RADIUS,
      minorRadius: RING_MINOR_RADIUS,
    })
    // 低圈在BC之间
    const centerX2 = (subject8RodB.x + subject8RodC.x) / 2
    const centerY2 = (subject8RodB.y + subject8RodC.y) / 2
    obstacles.push({
      type: 'horizontal-ring',
      center: { x: centerX2, y: centerY2, z: SUBJECT8_LOW_RING_CENTER_HEIGHT },
      majorRadius: RING_MAJOR_RADIUS,
      minorRadius: RING_MINOR_RADIUS,
    })
  }

  // 科目9：两根竖杆 + 两根横杆（不同高度）
  const subject9RodA = rodConfig.subject9[0]
  const subject9RodB = rodConfig.subject9[1]
  const subject9SecondHeight = rodConfig.subject9Config.secondCrossbarHeight
  if (isFiniteRodPoint(subject9RodA) && isFiniteRodPoint(subject9RodB)) {
    obstacles.push(
      { type: 'vertical-rod', x: subject9RodA.x, y: subject9RodA.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      { type: 'vertical-rod', x: subject9RodB.x, y: subject9RodB.y, radius: ROD_RADIUS, height: ROD_HEIGHT },
      {
        type: 'crossbar',
        start: { x: subject9RodA.x, y: subject9RodA.y, z: SUBJECT9_FIRST_CROSSBAR_HEIGHT },
        end: { x: subject9RodB.x, y: subject9RodB.y, z: SUBJECT9_FIRST_CROSSBAR_HEIGHT },
        radius: CROSSBAR_RADIUS,
      },
    )
    if (isFiniteNumber(subject9SecondHeight)) {
      obstacles.push({
        type: 'crossbar',
        start: { x: subject9RodA.x, y: subject9RodA.y, z: subject9SecondHeight },
        end: { x: subject9RodB.x, y: subject9RodB.y, z: subject9SecondHeight },
        radius: CROSSBAR_RADIUS,
      })
    }
  }

  return obstacles
}

/**
 * 计算线段到障碍物的最短距离
 */
const segmentToObstacleDistance = (segment: Segment, obstacle: Obstacle): number => {
  switch (obstacle.type) {
    case 'vertical-rod':
      return segmentToVerticalRodDistance(segment, obstacle)
    case 'crossbar':
      return segmentToCrossbarDistance(segment, obstacle)
    case 'vertical-ring':
      return segmentToVerticalRingDistance(segment, obstacle)
    case 'horizontal-ring':
      return segmentToHorizontalRingDistance(segment, obstacle)
    default:
      return Infinity
  }
}

/**
 * 检查所有路径段与障碍物的碰撞
 */
export const checkRodCollisionIssues = (
  rodConfig: RodConfig,
  startPos: XYZ,
  blocks: ParsedBlock[],
  safetyDistance?: number,
): TrajectoryIssue[] => {
  const collisionThreshold = safetyDistance ?? DEFAULT_COLLISION_THRESHOLD
  const issues: TrajectoryIssue[] = []
  const visits = buildPathVisits(startPos, blocks)

  if (visits.length < 2) {
    return issues
  }

  const obstacles = buildObstacles(rodConfig)
  if (obstacles.length === 0) {
    return issues
  }

  // 遍历所有路径段
  for (let i = 0; i < visits.length - 1; i++) {
    const start = visits[i]
    const end = visits[i + 1]

    const segment: Segment = {
      start: { x: start.x, y: start.y, z: start.z },
      end: { x: end.x, y: end.y, z: end.z },
    }

    // 检查每个障碍物
    for (const obstacle of obstacles) {
      const distance = segmentToObstacleDistance(segment, obstacle)

      if (distance < collisionThreshold) {
        const blockId = end.blockId
        const segmentIndex = i + 1

        let obstacleDesc: string
        switch (obstacle.type) {
          case 'vertical-rod':
            obstacleDesc = `竖杆(${obstacle.x.toFixed(0)}, ${obstacle.y.toFixed(0)})`
            break
          case 'crossbar':
            obstacleDesc = `横杆(高度${obstacle.start.z.toFixed(0)}cm)`
            break
          case 'vertical-ring':
            obstacleDesc = `竖圈(高度${obstacle.center.z.toFixed(0)}cm)`
            break
          case 'horizontal-ring':
            obstacleDesc = `横圈(高度${obstacle.center.z.toFixed(0)}cm)`
            break
          default:
            obstacleDesc = '障碍物'
        }

        issues.push({
          key: `collision-${segmentIndex}-${obstacle.type}-${i}`,
          blockId,
          message: `撞杆检测：第${segmentIndex}段路径距离${obstacleDesc}仅${distance.toFixed(1)}cm，小于安全距离${collisionThreshold}cm`,
        })
      }
    }
  }

  return issues
}
