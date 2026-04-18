import { Button, InputNumber, Typography, Radio } from 'antd'
import { useCallback, useState } from 'react'
import { createDefaultRodConfig, ROD_SUBJECT_SPECS } from './rodConfig'
import type { RodConfig, RodSubjectId, VerticalRodHeight } from './rodConfig'

type Props = {
  config: RodConfig
  onChange: (nextConfig: RodConfig) => void
}

type GroupId = RodSubjectId | 'takeoffZone'

type FieldTarget = {
  group: GroupId
  pointIndex: number
  axis: 'x' | 'y'
}

type CoordPair = {
  x: number
  y: number
}

type DeferredNumberInputProps = {
  className?: string
  value?: number
  placeholder?: string
  onCommit: (value: number | null) => void
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void
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

const cloneConfig = (source: RodConfig): RodConfig => {
  const nextConfig: RodConfig = {
    ...source,
    subject3Ring: { ...source.subject3Ring },
    subject9Config: { ...source.subject9Config },
    takeoffZone: source.takeoffZone.map((point) => ({ ...point })),
  }

  for (const spec of ROD_SUBJECT_SPECS) {
    nextConfig[spec.id] = source[spec.id].map((point) => ({ ...point }))
  }

  return nextConfig
}

const parseLabeledCoordinates = (rawText: string): Partial<Record<GroupId, CoordPair[]>> => {
  const normalizedText = rawText
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/\u3000/g, ' ')

  const sectionMatches = [...normalizedText.matchAll(/(起降区|科目\s*(10|[1-9]))/g)]
  if (sectionMatches.length === 0) {
    return {}
  }

  const parsed: Partial<Record<GroupId, CoordPair[]>> = {}

  sectionMatches.forEach((match, index) => {
    const [label, , subjectNumber] = match
    const start = (match.index ?? 0) + label.length
    const end = sectionMatches[index + 1]?.index ?? normalizedText.length
    const sectionText = normalizedText.slice(start, end)

    const group: GroupId =
      label === '起降区' ? 'takeoffZone' : SUBJECT_NUMBER_TO_ID[Number(subjectNumber)]

    if (!group) {
      return
    }

    const pairs: CoordPair[] = [...sectionText.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)]
      .map((coordMatch) => ({ x: Number(coordMatch[1]), y: Number(coordMatch[2]) }))
      .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))

    if (pairs.length > 0) {
      parsed[group] = pairs
    }
  })

  return parsed
}

function DeferredNumberInput({ className, value, placeholder, onCommit, onPaste }: DeferredNumberInputProps) {
  const [draft, setDraft] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const commit = useCallback(() => {
    const nextValue = typeof draft === 'number' && Number.isFinite(draft) ? draft : null
    onCommit(nextValue)
    setIsEditing(false)
  }, [draft, onCommit])

  const displayValue = isEditing ? draft : (value ?? null)

  return (
    <InputNumber
      className={className}
      value={displayValue}
      placeholder={placeholder}
      onFocus={() => {
        setIsEditing(true)
        setDraft(value ?? null)
      }}
      onChange={(nextValue) => {
        setDraft(typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : null)
      }}
      onBlur={commit}
      onPressEnter={commit}
      onPaste={onPaste}
    />
  )
}

function RodConfigPanel({ config, onChange }: Props) {
  const flatFieldOrder: FieldTarget[] = [
    ...config.takeoffZone.flatMap((_, pointIndex) => [
      { group: 'takeoffZone' as const, pointIndex, axis: 'x' as const },
      { group: 'takeoffZone' as const, pointIndex, axis: 'y' as const },
    ]),
    ...ROD_SUBJECT_SPECS.flatMap((subject) =>
      Array.from({ length: subject.count }).flatMap((_, pointIndex) => [
        { group: subject.id, pointIndex, axis: 'x' as const },
        { group: subject.id, pointIndex, axis: 'y' as const },
      ]),
    ),
  ]

  const clearGroup = (group: GroupId) => {
    if (group === 'subject3') {
      onChange({
        ...config,
        [group]: config[group].map(() => ({})),
        subject3Ring: {},
      })
      return
    }

    if (group === 'subject9') {
      onChange({
        ...config,
        [group]: config[group].map(() => ({})),
        subject9Config: {},
      })
      return
    }

    onChange({
      ...config,
      [group]: config[group].map(() => ({})),
    })
  }

  const updatePoint = (
    group: GroupId,
    pointIndex: number,
    axis: 'x' | 'y',
    value: number | null,
  ) => {
    onChange({
      ...config,
      [group]: config[group].map((point, index) => {
        if (index !== pointIndex) {
          return point
        }
        return {
          ...point,
          [axis]: value ?? undefined,
        }
      }),
    })
  }

  const updateSubject3RingHeight = (value: number | null) => {
    onChange({
      ...config,
      subject3Ring: {
        ...config.subject3Ring,
        centerHeight: value ?? undefined,
      },
    })
  }

  const updateSubject9SecondCrossbarHeight = (value: number | null) => {
    onChange({
      ...config,
      subject9Config: {
        ...config.subject9Config,
        secondCrossbarHeight: value ?? undefined,
      },
    })
  }

  const updateVerticalRodHeight = (value: VerticalRodHeight) => {
    onChange({
      ...config,
      verticalRodHeight: value,
    })
  }

  const spreadPasteValues = (
    event: React.ClipboardEvent<HTMLInputElement>,
    group: GroupId,
    pointIndex: number,
    axis: 'x' | 'y',
  ) => {
    const pastedText = event.clipboardData.getData('text')
    const labeledCoordinates = parseLabeledCoordinates(pastedText)

    if (Object.keys(labeledCoordinates).length > 0) {
      event.preventDefault()
      const nextConfig = cloneConfig(config)

      for (const [targetGroup, pairs] of Object.entries(labeledCoordinates) as [GroupId, CoordPair[]][]) {
        nextConfig[targetGroup] = nextConfig[targetGroup].map((_, index) => {
          const pair = pairs[index]
          return pair ? { x: pair.x, y: pair.y } : {}
        })
      }

      onChange(nextConfig)
      return
    }

    const numbers = pastedText
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map((value) => Number(value))
      .filter((value) => Number.isFinite(value))

    if (!numbers || numbers.length === 0) {
      return
    }

    const startIndex = flatFieldOrder.findIndex(
      (field) => field.group === group && field.pointIndex === pointIndex && field.axis === axis,
    )
    if (startIndex < 0) {
      return
    }

    event.preventDefault()

    const nextConfig = cloneConfig(config)

    numbers.forEach((value, offset) => {
      const targetField = flatFieldOrder[startIndex + offset]
      if (!targetField) {
        return
      }
      nextConfig[targetField.group][targetField.pointIndex][targetField.axis] = value
    })

    onChange(nextConfig)
  }

  return (
    <div className="rod-config-panel">
      <div className="rod-config-toolbar">
        <Typography.Text className="rod-config-tip">配置杆子坐标后，会在 2D 轨迹图中以黄色科目标记显示；起降区会显示橙色透明虚线四边形。</Typography.Text>
        <Button size="small" danger onClick={() => onChange(createDefaultRodConfig())}>
          清空全部
        </Button>
      </div>
      <div className="rod-config-list">
        <section className="rod-config-subject">
          <div className="rod-config-subject-title">
            <div className="rod-config-subject-title-main">
              <span className="rod-config-subject-marker">TZ</span>
              <span>起降区（4 点）</span>
            </div>
            <Button size="small" type="link" onClick={() => clearGroup('takeoffZone')}>
              清空
            </Button>
          </div>
          <div className="rod-config-points">
            {config.takeoffZone.map((point, pointIndex) => (
              <div key={`takeoff-zone-${pointIndex}`} className="rod-config-point-row">
                <span className="rod-config-point-label">点{pointIndex + 1}</span>
                <DeferredNumberInput
                  className="rod-config-input"
                  value={point.x}
                  placeholder="X"
                  onCommit={(value) => updatePoint('takeoffZone', pointIndex, 'x', value)}
                  onPaste={(event) => spreadPasteValues(event, 'takeoffZone', pointIndex, 'x')}
                />
                <DeferredNumberInput
                  className="rod-config-input"
                  value={point.y}
                  placeholder="Y"
                  onCommit={(value) => updatePoint('takeoffZone', pointIndex, 'y', value)}
                  onPaste={(event) => spreadPasteValues(event, 'takeoffZone', pointIndex, 'y')}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="rod-config-subject">
          <div className="rod-config-subject-title">
            <div className="rod-config-subject-title-main">
              <span className="rod-config-subject-marker">杆</span>
              <span>竖杆高度</span>
            </div>
          </div>
          <div className="rod-config-points">
            <div className="rod-config-point-row">
              <Radio.Group
                value={config.verticalRodHeight}
                onChange={(e) => updateVerticalRodHeight(e.target.value)}
              >
                <Radio value={150}>150cm</Radio>
                <Radio value={170}>170cm</Radio>
              </Radio.Group>
            </div>
          </div>
        </section>
        {ROD_SUBJECT_SPECS.map((subject) => (
          <section key={subject.id} className="rod-config-subject">
            <div className="rod-config-subject-title">
              <div className="rod-config-subject-title-main">
                <span className="rod-config-subject-marker">{subject.marker}</span>
                <span>{subject.label}</span>
              </div>
              <Button size="small" type="link" onClick={() => clearGroup(subject.id)}>
                清空
              </Button>
            </div>
            <div className="rod-config-points">
              {config[subject.id].map((point, pointIndex) => (
                <div key={`${subject.id}-${pointIndex}`} className="rod-config-point-row">
                  <span className="rod-config-point-label">点{pointIndex + 1}</span>
                  <DeferredNumberInput
                    className="rod-config-input"
                    value={point.x}
                    placeholder="X"
                    onCommit={(value) => updatePoint(subject.id, pointIndex, 'x', value)}
                    onPaste={(event) => spreadPasteValues(event, subject.id, pointIndex, 'x')}
                  />
                  <DeferredNumberInput
                    className="rod-config-input"
                    value={point.y}
                    placeholder="Y"
                    onCommit={(value) => updatePoint(subject.id, pointIndex, 'y', value)}
                    onPaste={(event) => spreadPasteValues(event, subject.id, pointIndex, 'y')}
                  />
                </div>
              ))}
              {subject.id === 'subject3' ? (
                <div className="rod-config-point-row">
                  <span className="rod-config-point-label">圈高</span>
                  <DeferredNumberInput
                    className="rod-config-input"
                    value={config.subject3Ring.centerHeight}
                    placeholder="圈中心离地高度(cm)"
                    onCommit={updateSubject3RingHeight}
                  />
                </div>
              ) : null}
              {subject.id === 'subject9' ? (
                <div className="rod-config-point-row">
                  <span className="rod-config-point-label">二杆高</span>
                  <DeferredNumberInput
                    className="rod-config-input"
                    value={config.subject9Config.secondCrossbarHeight}
                    placeholder="第二横杆离地高度(cm)"
                    onCommit={updateSubject9SecondCrossbarHeight}
                  />
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default RodConfigPanel
