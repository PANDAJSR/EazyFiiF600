const toFiniteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

const normalizeRodPoint = (value) => {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return {
    x: toFiniteNumber(value.x),
    y: toFiniteNumber(value.y),
  }
}

export const normalizeRodConfigSnapshot = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const subjectIds = [
    'subject1',
    'subject2',
    'subject3',
    'subject4',
    'subject5',
    'subject6',
    'subject7',
    'subject8',
    'subject9',
    'subject10',
  ]
  const next = {
    takeoffZone: Array.from({ length: 4 }, (_, i) => normalizeRodPoint(value.takeoffZone?.[i])),
    subject3Ring: {
      centerHeight: toFiniteNumber(value.subject3Ring?.centerHeight),
    },
    subject9Config: {
      secondCrossbarHeight: toFiniteNumber(value.subject9Config?.secondCrossbarHeight),
    },
  }
  for (const subjectId of subjectIds) {
    const list = Array.isArray(value[subjectId]) ? value[subjectId] : []
    next[subjectId] = list.map((point) => normalizeRodPoint(point))
  }
  return next
}
