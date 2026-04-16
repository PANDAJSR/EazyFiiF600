import type { ParsedBlock } from '../types/fii'
import { AUTO_DELAY_BLOCK_TYPE } from './autoDelayBlocks'

export type XYZ = {
  x: number
  y: number
  z: number
}

export type DroneState = {
  position: XYZ
  orientation: number
  lights: [string, string, string, string]
}

const toNumber = (value?: string): number | null => {
  if (!value) {
    return null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const normalizeColor = (value?: string): string => {
  if (!value) {
    return '#ffffff'
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return '#ffffff'
  }
  if (normalized === 'green') {
    return '#008000'
  }
  if (normalized === 'lime') {
    return '#00ff00'
  }

  const withoutPrefix = normalized.startsWith('#')
    ? normalized.slice(1)
    : normalized.startsWith('0x')
      ? normalized.slice(2)
      : normalized

  const hex =
    withoutPrefix.length === 3
      ? withoutPrefix
          .split('')
          .map((char) => char + char)
          .join('')
      : withoutPrefix

  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `#${hex}`
  }

  return normalized
}

export const calculateBlockEndState = (
  startPos: { x: string; y: string; z: string },
  blocks: ParsedBlock[],
  targetBlockId: string,
): DroneState | null => {
  const targetIndex = blocks.findIndex((b) => b.id === targetBlockId)
  if (targetIndex === -1) {
    return null
  }

  const startX = toNumber(startPos.x) ?? 0
  const startY = toNumber(startPos.y) ?? 0
  const startZ = toNumber(startPos.z) ?? 0

  let currentX = startX
  let currentY = startY
  let currentZ = startZ
  let currentOrientation = 0
  const lights: [string, string, string, string] = ['#ffffff', '#ffffff', '#ffffff', '#ffffff']

  for (let i = 0; i <= targetIndex; i++) {
    const block = blocks[i]

    switch (block.type) {
      case 'Goertek_TakeOff2': {
        const nextZ = toNumber(block.fields.alt)
        if (nextZ !== null) {
          currentZ = nextZ
        }
        break
      }

      case 'Goertek_MoveToCoord2':
      case AUTO_DELAY_BLOCK_TYPE: {
        const nextX = toNumber(block.fields.X)
        const nextY = toNumber(block.fields.Y)
        if (nextX !== null) {
          currentX = nextX
        }
        if (nextY !== null) {
          currentY = nextY
        }
        const nextZ = toNumber(block.fields.Z)
        if (nextZ !== null) {
          currentZ = nextZ
        }
        break
      }

      case 'Goertek_Move': {
        const deltaX = toNumber(block.fields.X)
        const deltaY = toNumber(block.fields.Y)
        const deltaZ = toNumber(block.fields.Z) ?? 0
        if (deltaX !== null) {
          currentX += deltaX
        }
        if (deltaY !== null) {
          currentY += deltaY
        }
        currentZ += deltaZ
        break
      }

      case 'Goertek_Land': {
        currentZ = 0
        break
      }

      case 'Goertek_Turn': {
        const turnDirection = block.fields.turnDirection ?? 'r'
        const angle = toNumber(block.fields.angle) ?? 90
        if (turnDirection === 'r') {
          currentOrientation = (currentOrientation + angle) % 360
        } else {
          currentOrientation = (currentOrientation - angle + 360) % 360
        }
        break
      }

      case 'Goertek_TurnTo': {
        const turnDirection = block.fields.turnDirection ?? 'r'
        const angle = toNumber(block.fields.angle) ?? 90
        if (turnDirection === 'r') {
          currentOrientation = angle
        } else {
          currentOrientation = (360 - angle) % 360
        }
        break
      }

      case 'Goertek_LEDTurnOnAllSingleColor4': {
        const motorIndex = parseInt(block.fields.motor ?? '1', 10) - 1
        const color = normalizeColor(block.fields.color1)
        if (motorIndex >= 0 && motorIndex < 4) {
          lights[motorIndex] = color
        }
        break
      }

      case 'Goertek_LEDTurnOnAllSingleColor2': {
        const color = normalizeColor(block.fields.color1)
        lights[0] = color
        lights[1] = color
        lights[2] = color
        lights[3] = color
        break
      }

      default:
        break
    }
  }

  return {
    position: {
      x: currentX,
      y: currentY,
      z: currentZ,
    },
    orientation: currentOrientation,
    lights,
  }
}
