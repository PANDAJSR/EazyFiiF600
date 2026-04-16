import type { ParsedBlock } from '../../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from '../../utils/autoDelayBlocks'
import type { RodConfig } from './rodConfig'
import { checkSubject1ClosedLoopUnder150 } from './subject1Issues'
import { checkSubject2ClosedLoopAroundRod } from './subject2Issues'
import { checkSubject3PassThroughVerticalRing, checkSubject4PassThroughHorizontalRing } from './subject34Issues'
import { checkSubject5FigureEightAroundVerticalRods } from './subject5Issues'
import { checkSubject6VerticalFigureEightAroundCrossbars } from './subject6Issues'
import { checkSubject7PassThreeRingsWithColorChanges } from './subject7Issues'
import { checkSubject8PassHighLowRings } from './subject8Issues'
import { checkSubject9VerticalFigureEightAroundDifferentHeightCrossbars } from './subject9Issues'
import type { XYZ } from './trajectoryUtils'
import { checkRodCollisionIssues } from './collisionDetection'

const ASYNC_MOVE_BLOCK_TYPE = 'Goertek_MoveToCoord2'
const RELATIVE_MOVE_BLOCK_TYPE = 'Goertek_Move'
const LAND_BLOCK_TYPE = 'Goertek_Land'
const DELAY_BLOCK_TYPE = 'block_delay'

type Position3D = {
  x: number
  y: number
  z: number
}

type DelayAnchor = {
  distance: number
  minDelayMs: number
}

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

const hasFiniteNumber = (value: number | undefined): value is number => Number.isFinite(value)

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
  safetyDistance?: number,
): TrajectoryIssue[] => {
  const issues: TrajectoryIssue[] = []
  const subject1 = rodConfig.subject1[0]
  const [subject2RodA, subject2RodB] = rodConfig.subject2
  const [subject3RodA, subject3RodB] = rodConfig.subject3
  const [subject4RodA, subject4RodB] = rodConfig.subject4
  const [subject5RodA, subject5RodB] = rodConfig.subject5
  const [subject6RodA, subject6RodB, subject6RodC, subject6RodD] = rodConfig.subject6
  const [subject7RodA, subject7RodB] = rodConfig.subject7
  const [subject8RodA, subject8RodB, subject8RodC] = rodConfig.subject8
  const [subject9RodA, subject9RodB] = rodConfig.subject9

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
    } else if (subject1Result === 'motor-lights-not-green') {
      issues.push({
        key: 'subject1-motor-light-not-green',
        message: '科目一未完成：封闭图形飞行过程中，1、2号电机灯光未全程近似绿色',
      })
    }
  }

  if (subject2RodA && subject2RodB && hasFiniteXY(subject2RodA) && hasFiniteXY(subject2RodB)) {
    const subject2Result = checkSubject2ClosedLoopAroundRod(subject2RodA, subject2RodB, startPos, blocks)
    if (subject2Result === 'no-loop') {
      issues.push({
        key: 'subject2-not-completed',
        message: '科目二未完成：未检测到绕横杆一圈并闭合',
      })
    } else if (subject2Result === 'outside-rod-span') {
      issues.push({
        key: 'subject2-outside-rod-span',
        message: '科目二未完成：闭合轨迹未在横杆长度范围（0.8m）附近形成有效绕行',
      })
    }
  }

  if (
    subject3RodA &&
    subject3RodB &&
    hasFiniteXY(subject3RodA) &&
    hasFiniteXY(subject3RodB) &&
    hasFiniteNumber(rodConfig.subject3Ring.centerHeight)
  ) {
    const blockId = checkSubject3PassThroughVerticalRing(
      subject3RodA,
      subject3RodB,
      rodConfig.subject3Ring.centerHeight,
      startPos,
      blocks,
    )
    if (!blockId) {
      issues.push({
        key: 'subject3-not-completed',
        message: '科目③穿越竖圈未完成：未穿过圆圈',
      })
    }
  }

  if (subject4RodA && subject4RodB && hasFiniteXY(subject4RodA) && hasFiniteXY(subject4RodB)) {
    const blockId = checkSubject4PassThroughHorizontalRing(subject4RodA, subject4RodB, startPos, blocks)
    if (!blockId) {
      issues.push({
        key: 'subject4-not-completed',
        message: '科目④穿越横圈未完成：未穿过圆圈',
      })
    }
  }

  if (subject5RodA && subject5RodB && hasFiniteXY(subject5RodA) && hasFiniteXY(subject5RodB)) {
    const subject5Result = checkSubject5FigureEightAroundVerticalRods(subject5RodA, subject5RodB, startPos, blocks)
    if (subject5Result === 'height-too-high') {
      issues.push({
        key: 'subject5-height-too-high',
        message: '科目⑤绕横8字未完成：8字飞行高度需低于150cm',
      })
    } else if (subject5Result === 'entry-exit-invalid') {
      issues.push({
        key: 'subject5-entry-exit-invalid',
        message: '科目⑤绕横8字未完成：需从左/右侧进入8字并在同侧改出',
      })
    } else if (subject5Result === 'no-eight') {
      issues.push({
        key: 'subject5-no-eight',
        message: '科目⑤绕横8字未完成：未检测到绕两根竖杆形成8字',
      })
    }
  }

  if (
    subject6RodA &&
    subject6RodB &&
    subject6RodC &&
    subject6RodD &&
    hasFiniteXY(subject6RodA) &&
    hasFiniteXY(subject6RodB) &&
    hasFiniteXY(subject6RodC) &&
    hasFiniteXY(subject6RodD)
  ) {
    const subject6Result = checkSubject6VerticalFigureEightAroundCrossbars(
      subject6RodA,
      subject6RodB,
      subject6RodC,
      subject6RodD,
      startPos,
      blocks,
    )
    if (subject6Result === 'entry-exit-invalid') {
      issues.push({
        key: 'subject6-entry-exit-invalid',
        message: '科目⑥绕竖8字未完成：需从两侧进入并在同侧改出',
      })
    } else if (subject6Result === 'no-eight') {
      issues.push({
        key: 'subject6-no-eight',
        message: '科目⑥绕竖8字未完成：未检测到绕两根同高横杆形成上下8字',
      })
    }
  }

  if (subject7RodA && subject7RodB && hasFiniteXY(subject7RodA) && hasFiniteXY(subject7RodB)) {
    const subject7Result = checkSubject7PassThreeRingsWithColorChanges(subject7RodA, subject7RodB, startPos, blocks)
    if (subject7Result === 'color-not-enough') {
      issues.push({
        key: 'subject7-color-not-enough',
        message: '科目⑦变色穿圈未完成：最小穿圈路径中“设置全部灯光颜色”需出现至少3种颜色',
      })
    } else if (subject7Result === 'no-path') {
      issues.push({
        key: 'subject7-no-path',
        message: '科目⑦变色穿圈未完成：未检测到从最低圈到最高圈上方的连续穿圈路径',
      })
    }
  }

  if (
    subject8RodA &&
    subject8RodB &&
    subject8RodC &&
    hasFiniteXY(subject8RodA) &&
    hasFiniteXY(subject8RodB) &&
    hasFiniteXY(subject8RodC)
  ) {
    const subject8Result = checkSubject8PassHighLowRings(subject8RodA, subject8RodB, subject8RodC, startPos, blocks)
    if (subject8Result === 'high-ring-not-descending') {
      issues.push({
        key: 'subject8-high-ring-not-descending',
        message: '科目⑧穿高低圈未完成：高圈需从高到低穿越',
      })
    } else if (subject8Result === 'low-ring-not-ascending') {
      issues.push({
        key: 'subject8-low-ring-not-ascending',
        message: '科目⑧穿高低圈未完成：低圈需从低到高穿越',
      })
    }
  }

  if (
    subject9RodA &&
    subject9RodB &&
    hasFiniteXY(subject9RodA) &&
    hasFiniteXY(subject9RodB) &&
    hasFiniteNumber(rodConfig.subject9Config.secondCrossbarHeight)
  ) {
    const subject9Result = checkSubject9VerticalFigureEightAroundDifferentHeightCrossbars(
      subject9RodA,
      subject9RodB,
      rodConfig.subject9Config.secondCrossbarHeight,
      startPos,
      blocks,
    )
    if (subject9Result === 'height-invalid') {
      issues.push({
        key: 'subject9-height-invalid',
        message: '科目⑨垂直8字未完成：第二横杆高度需与150cm不同',
      })
    } else if (subject9Result === 'entry-exit-invalid') {
      issues.push({
        key: 'subject9-entry-exit-invalid',
        message: '科目⑨垂直8字未完成：需从两横杆中间进入并在同侧改出',
      })
    } else if (subject9Result === 'no-eight') {
      issues.push({
        key: 'subject9-no-eight',
        message: '科目⑨垂直8字未完成：未检测到绕两根不同高度横杆形成上下8字',
      })
    }
  }

  issues.push(...findAsyncMoveDelayIssues(startPos, blocks))
  issues.push(...checkRodCollisionIssues(rodConfig, startPos, blocks, safetyDistance))
  return issues
}
