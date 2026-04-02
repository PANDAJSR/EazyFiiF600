export type RodSubjectId =
  | 'subject1'
  | 'subject2'
  | 'subject3'
  | 'subject4'
  | 'subject5'
  | 'subject6'
  | 'subject7'
  | 'subject8'
  | 'subject9'
  | 'subject10'

export type RodPoint = {
  x?: number
  y?: number
}

export type RodConfig = Record<RodSubjectId, RodPoint[]> & {
  takeoffZone: RodPoint[]
}

export type RodSubjectSpec = {
  id: RodSubjectId
  label: string
  marker: string
  count: number
}

const ROD_SUBJECT_IDS: RodSubjectId[] = [
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

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return undefined
}

const normalizeRodPoint = (value: unknown): RodPoint => {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const raw = value as Partial<RodPoint>
  return {
    x: toFiniteNumber(raw.x),
    y: toFiniteNumber(raw.y),
  }
}

export const ROD_SUBJECT_SPECS: RodSubjectSpec[] = [
  { id: 'subject1', label: '科目一', marker: '①', count: 1 },
  { id: 'subject2', label: '科目二', marker: '②', count: 2 },
  { id: 'subject3', label: '科目三', marker: '③', count: 2 },
  { id: 'subject4', label: '科目四', marker: '④', count: 2 },
  { id: 'subject5', label: '科目五', marker: '⑤', count: 2 },
  { id: 'subject6', label: '科目六', marker: '⑥', count: 4 },
  { id: 'subject7', label: '科目七', marker: '⑦', count: 2 },
  { id: 'subject8', label: '科目八', marker: '⑧', count: 3 },
  { id: 'subject9', label: '科目九', marker: '⑨', count: 2 },
  { id: 'subject10', label: '科目十', marker: '⑩', count: 6 },
]

export const createDefaultRodConfig = (): RodConfig =>
  ROD_SUBJECT_SPECS.reduce<RodConfig>((acc, spec) => {
    acc[spec.id] = Array.from({ length: spec.count }, () => ({}))
    return acc
  }, { takeoffZone: Array.from({ length: 4 }, () => ({})) } as RodConfig)

export const normalizeRodConfig = (value: unknown): RodConfig => {
  const fallback = createDefaultRodConfig()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const raw = value as Partial<Record<RodSubjectId | 'takeoffZone', unknown>>

  const next: RodConfig = {
    ...fallback,
    takeoffZone: fallback.takeoffZone.map((_, index) => normalizeRodPoint((raw.takeoffZone as unknown[] | undefined)?.[index])),
  }

  for (const subjectId of ROD_SUBJECT_IDS) {
    next[subjectId] = fallback[subjectId].map((_, index) => normalizeRodPoint((raw[subjectId] as unknown[] | undefined)?.[index]))
  }

  return next
}
