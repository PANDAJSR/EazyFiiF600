const toNumber = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeHeadingDeg = (headingDeg) => {
  const normalized = headingDeg % 360
  return normalized >= 0 ? normalized : normalized + 360
}

const formatHeadingDeg = (headingDeg) => {
  const rounded = Math.round(normalizeHeadingDeg(headingDeg) * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

const calcMoveDirectionDeg = (deltaX, deltaY) => {
  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
    return null
  }
  return normalizeHeadingDeg((Math.atan2(deltaX, deltaY) * 180) / Math.PI)
}

const normalizeColorHex = (value) => {
  if (typeof value !== 'string') {
    return '000000'
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return '000000'
  }
  if (normalized === 'green' || normalized === 'lime') {
    return '00FF00'
  }
  const noPrefix = normalized.startsWith('#')
    ? normalized.slice(1)
    : normalized.startsWith('0x')
      ? normalized.slice(2)
      : normalized
  const hex = noPrefix.length === 3
    ? noPrefix.split('').map((ch) => `${ch}${ch}`).join('')
    : noPrefix
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return '000000'
  }
  return hex.toUpperCase()
}

export const buildTrajectoryDebugSnapshotPayload = ({ project, target, compactDrone }) => {
  let x = toNumber(target.drone.startPos.x) ?? 0
  let y = toNumber(target.drone.startPos.y) ?? 0
  let z = toNumber(target.drone.startPos.z) ?? 0
  let headingDeg = 0
  const motorLight = { '1': '000000', '2': '000000', '3': '000000', '4': '000000' }
  let allLight = '000000'
  const segments = []
  for (const block of target.blocks) {
    if (block.type === 'Goertek_TurnTo') {
      const angle = toNumber(block.fields.angle)
      if (angle !== null) {
        headingDeg = normalizeHeadingDeg(angle)
      }
      continue
    }

    if (block.type === 'Goertek_Turn') {
      const angle = toNumber(block.fields.angle)
      if (angle !== null) {
        const direction = block.fields.turnDirection?.trim().toLowerCase()
        if (direction === 'r') {
          headingDeg = normalizeHeadingDeg(headingDeg + angle)
        } else if (direction === 'l') {
          headingDeg = normalizeHeadingDeg(headingDeg - angle)
        }
      }
      continue
    }

    if (block.type === 'Goertek_TakeOff2') {
      const nextZ = toNumber(block.fields.alt)
      if (nextZ !== null) {
        z = nextZ
      }
      continue
    }

    if (block.type === 'Goertek_LEDTurnOnAllSingleColor4') {
      const motor = block.fields.motor?.trim()
      if (motor && Object.prototype.hasOwnProperty.call(motorLight, motor)) {
        motorLight[motor] = normalizeColorHex(block.fields.color1)
      }
      continue
    }

    if (block.type === 'Goertek_LEDTurnOnAllSingleColor2') {
      allLight = normalizeColorHex(block.fields.color1)
      continue
    }

    if (block.type === 'Goertek_Land') {
      z = 0
      continue
    }

    const isAbsMove = block.type === 'Goertek_MoveToCoord2' || block.type === 'EazyFii_MoveToCoordAutoDelay'
    const isRelMove = block.type === 'Goertek_Move'
    if (!isAbsMove && !isRelMove) {
      continue
    }

    const from = { x, y, z }
    let to = { x, y, z }
    if (isAbsMove) {
      const nextX = toNumber(block.fields.X)
      const nextY = toNumber(block.fields.Y)
      if (nextX === null || nextY === null) {
        continue
      }
      const nextZ = toNumber(block.fields.Z)
      to = { x: nextX, y: nextY, z: nextZ ?? z }
    } else {
      const deltaX = toNumber(block.fields.X)
      const deltaY = toNumber(block.fields.Y)
      if (deltaX === null || deltaY === null) {
        continue
      }
      const deltaZ = toNumber(block.fields.Z) ?? 0
      to = { x: x + deltaX, y: y + deltaY, z: z + deltaZ }
    }

    const moveDirectionDeg = calcMoveDirectionDeg(to.x - from.x, to.y - from.y)
    const line = `${from.x},${from.y},${from.z} -> ${to.x},${to.y},${to.z} (朝向${formatHeadingDeg(headingDeg)}°,电机1/${motorLight['1']},电机2/${motorLight['2']},电机3/${motorLight['3']},电机4/${motorLight['4']},整体灯光/${allLight})`
    segments.push({
      index: segments.length + 1,
      blockId: block.id,
      blockType: block.type,
      from,
      to,
      headingDeg: normalizeHeadingDeg(headingDeg),
      moveDirectionDeg: moveDirectionDeg ?? undefined,
      motorLight: { ...motorLight },
      allLight,
      line,
    })

    x = to.x
    y = to.y
    z = to.z
  }

  return {
    ok: true,
    schema: 'eazyfii.project.trajectoryDebug.v1',
    project: { sourceName: project.sourceName },
    drone: compactDrone(target),
    segmentCount: segments.length,
    previewLines: segments.map((segment) => segment.line),
    segments,
    notes: [
      'headingDeg 为该段平移执行时机头朝向；Goertek_TurnTo 按绝对角设置（以前方/+Y 为 0°），Goertek_Turn 按相对角累加回放。',
      'moveDirectionDeg 为该段位移方向角，按 atan2(ΔX,ΔY) 计算后归一化到 [0,360)。',
    ],
  }
}
