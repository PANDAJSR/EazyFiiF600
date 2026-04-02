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
