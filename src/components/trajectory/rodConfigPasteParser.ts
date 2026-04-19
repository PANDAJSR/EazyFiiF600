import type { RodSubjectId } from './rodConfig'

export type GroupId = RodSubjectId | 'takeoffZone'

export type CoordPair = {
  x: number
  y: number
}

export type ParsedLabeledCoordinates = {
  coordinates: Partial<Record<GroupId, CoordPair[]>>
  subject3RingCenterHeight?: number
  subject9SecondCrossbarHeight?: number
}

const SUBJECT_NUMBER_TO_ID: Record<number, RodSubjectId> = {
  1: 'subject1',
  2: 'subject2',
  3: 'subject3',
  4: 'subject4',
  5: 'subject5',
  6: 'subject6',
  7: 'subject7',
  8: 'subject8',
  9: 'subject9',
  10: 'subject10',
}

const CHINESE_SUBJECT_TO_NUMBER: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

const SECTION_LABEL_PATTERN = /(起降区|科目\s*(?:10|[1-9]|十|一|二|三|四|五|六|七|八|九))/g
const COORD_PAIR_PATTERN = /\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/g
const HEIGHT_WITH_UNIT_PATTERN = /(-?\d+(?:\.\d+)?)\s*(m|cm)\b/i

const toGroupId = (label: string): GroupId | null => {
  if (label === '起降区') {
    return 'takeoffZone'
  }

  const token = label.replace(/^科目\s*/u, '').trim()
  const chineseMapped = CHINESE_SUBJECT_TO_NUMBER[token]
  const subjectNumber = Number.isFinite(chineseMapped) ? chineseMapped : Number(token)
  const subjectId = SUBJECT_NUMBER_TO_ID[subjectNumber]
  return subjectId ?? null
}

const parseHeightInCm = (sectionText: string): number | undefined => {
  const match = sectionText.match(HEIGHT_WITH_UNIT_PATTERN)
  if (!match) {
    return undefined
  }

  const value = Number(match[1])
  if (!Number.isFinite(value)) {
    return undefined
  }

  const unit = match[2].toLowerCase()
  return unit === 'm' ? value * 100 : value
}

export const parseLabeledCoordinates = (rawText: string): ParsedLabeledCoordinates => {
  const normalizedText = rawText
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/\u3000/g, ' ')

  const sectionMatches = [...normalizedText.matchAll(SECTION_LABEL_PATTERN)]
  if (sectionMatches.length === 0) {
    return { coordinates: {} }
  }

  const parsed: ParsedLabeledCoordinates = { coordinates: {} }

  sectionMatches.forEach((match, index) => {
    const label = match[0]
    const start = (match.index ?? 0) + label.length
    const end = sectionMatches[index + 1]?.index ?? normalizedText.length
    const sectionText = normalizedText.slice(start, end)
    const group = toGroupId(label)

    if (!group) {
      return
    }

    const pairs: CoordPair[] = [...sectionText.matchAll(COORD_PAIR_PATTERN)]
      .map((coordMatch) => ({ x: Number(coordMatch[1]), y: Number(coordMatch[2]) }))
      .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))

    if (pairs.length > 0) {
      parsed.coordinates[group] = pairs
    }

    const heightInCm = parseHeightInCm(sectionText)
    if (heightInCm === undefined) {
      return
    }

    if (group === 'subject3') {
      parsed.subject3RingCenterHeight = heightInCm
      return
    }

    if (group === 'subject9') {
      parsed.subject9SecondCrossbarHeight = heightInCm
    }
  })

  return parsed
}
