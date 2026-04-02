import { InputNumber, Typography } from 'antd'
import type { RodConfig, RodSubjectId } from './rodConfig'
import { ROD_SUBJECT_SPECS } from './rodConfig'

type Props = {
  config: RodConfig
  onChange: (nextConfig: RodConfig) => void
}

function RodConfigPanel({ config, onChange }: Props) {
  const flatFieldOrder = ROD_SUBJECT_SPECS.flatMap((subject) =>
    Array.from({ length: subject.count }).flatMap((_, pointIndex) => [
      { subjectId: subject.id, pointIndex, axis: 'x' as const },
      { subjectId: subject.id, pointIndex, axis: 'y' as const },
    ]),
  )

  const updatePoint = (subjectId: RodSubjectId, pointIndex: number, axis: 'x' | 'y', value: number | null) => {
    onChange({
      ...config,
      [subjectId]: config[subjectId].map((point, index) => {
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

  const spreadPasteValues = (
    event: React.ClipboardEvent<HTMLInputElement>,
    subjectId: RodSubjectId,
    pointIndex: number,
    axis: 'x' | 'y',
  ) => {
    const pastedText = event.clipboardData.getData('text')
    const numbers = pastedText
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map((value) => Number(value))
      .filter((value) => Number.isFinite(value))

    if (!numbers || numbers.length === 0) {
      return
    }

    const startIndex = flatFieldOrder.findIndex(
      (field) => field.subjectId === subjectId && field.pointIndex === pointIndex && field.axis === axis,
    )
    if (startIndex < 0) {
      return
    }

    event.preventDefault()

    const nextConfig: RodConfig = { ...config }
    for (const spec of ROD_SUBJECT_SPECS) {
      nextConfig[spec.id] = config[spec.id].map((point) => ({ ...point }))
    }

    numbers.forEach((value, offset) => {
      const targetField = flatFieldOrder[startIndex + offset]
      if (!targetField) {
        return
      }
      nextConfig[targetField.subjectId][targetField.pointIndex][targetField.axis] = value
    })

    onChange(nextConfig)
  }

  return (
    <div className="rod-config-panel">
      <Typography.Text className="rod-config-tip">配置杆子坐标后，会在 2D 轨迹图中以黄色科目标记显示。</Typography.Text>
      <div className="rod-config-list">
        {ROD_SUBJECT_SPECS.map((subject) => (
          <section key={subject.id} className="rod-config-subject">
            <div className="rod-config-subject-title">
              <span className="rod-config-subject-marker">{subject.marker}</span>
              <span>{subject.label}</span>
            </div>
            <div className="rod-config-points">
              {config[subject.id].map((point, pointIndex) => (
                <div key={`${subject.id}-${pointIndex}`} className="rod-config-point-row">
                  <span className="rod-config-point-label">点{pointIndex + 1}</span>
                  <InputNumber
                    className="rod-config-input"
                    value={point.x}
                    placeholder="X"
                    onChange={(value) => updatePoint(subject.id, pointIndex, 'x', value)}
                    onPaste={(event) => spreadPasteValues(event, subject.id, pointIndex, 'x')}
                  />
                  <InputNumber
                    className="rod-config-input"
                    value={point.y}
                    placeholder="Y"
                    onChange={(value) => updatePoint(subject.id, pointIndex, 'y', value)}
                    onPaste={(event) => spreadPasteValues(event, subject.id, pointIndex, 'y')}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default RodConfigPanel
