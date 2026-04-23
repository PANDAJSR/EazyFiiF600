import { useMemo, useState } from 'react'
import { InputNumber, Modal, Space, Typography } from 'antd'
import {
  SUBJECT1_SQUARE_STABLE_TEMPLATE_ID,
  SUBJECT1_SQUARE_TURN_AND_FLY_TEMPLATE_ID,
  SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID,
  SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID,
  SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID,
  SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID,
  type InsertableTemplateDefinition,
} from './blockTemplateCatalog'

export type TemplateModalConfirmPayload = {
  subject1X: number
  subject1Y: number
  subject2RodAX: number
  subject2RodAY: number
  subject2RodBX: number
  subject2RodBY: number
  subject5RodAX: number
  subject5RodAY: number
  subject5RodBX: number
  subject5RodBY: number
  subject6RodAX: number
  subject6RodAY: number
  subject6RodBX: number
  subject6RodBY: number
  subject6RodCX: number
  subject6RodCY: number
  subject6RodDX: number
  subject6RodDY: number
}

type Props = {
  template?: InsertableTemplateDefinition
  defaultSubject1X: number
  defaultSubject1Y: number
  defaultSubject2RodAX: number
  defaultSubject2RodAY: number
  defaultSubject2RodBX: number
  defaultSubject2RodBY: number
  defaultSubject5RodAX: number
  defaultSubject5RodAY: number
  defaultSubject5RodBX: number
  defaultSubject5RodBY: number
  defaultSubject6RodAX: number
  defaultSubject6RodAY: number
  defaultSubject6RodBX: number
  defaultSubject6RodBY: number
  defaultSubject6RodCX: number
  defaultSubject6RodCY: number
  defaultSubject6RodDX: number
  defaultSubject6RodDY: number
  onCancel: () => void
  onConfirm: (payload: TemplateModalConfirmPayload) => void
}

function BlockTemplateInsertModal({
  template,
  defaultSubject1X,
  defaultSubject1Y,
  defaultSubject2RodAX,
  defaultSubject2RodAY,
  defaultSubject2RodBX,
  defaultSubject2RodBY,
  defaultSubject5RodAX,
  defaultSubject5RodAY,
  defaultSubject5RodBX,
  defaultSubject5RodBY,
  defaultSubject6RodAX,
  defaultSubject6RodAY,
  defaultSubject6RodBX,
  defaultSubject6RodBY,
  defaultSubject6RodCX,
  defaultSubject6RodCY,
  defaultSubject6RodDX,
  defaultSubject6RodDY,
  onCancel,
  onConfirm,
}: Props) {
  const [subject1X, setSubject1X] = useState<number | null>(defaultSubject1X)
  const [subject1Y, setSubject1Y] = useState<number | null>(defaultSubject1Y)
  const [subject2RodAX, setSubject2RodAX] = useState<number | null>(defaultSubject2RodAX)
  const [subject2RodAY, setSubject2RodAY] = useState<number | null>(defaultSubject2RodAY)
  const [subject2RodBX, setSubject2RodBX] = useState<number | null>(defaultSubject2RodBX)
  const [subject2RodBY, setSubject2RodBY] = useState<number | null>(defaultSubject2RodBY)
  const [subject5RodAX, setSubject5RodAX] = useState<number | null>(defaultSubject5RodAX)
  const [subject5RodAY, setSubject5RodAY] = useState<number | null>(defaultSubject5RodAY)
  const [subject5RodBX, setSubject5RodBX] = useState<number | null>(defaultSubject5RodBX)
  const [subject5RodBY, setSubject5RodBY] = useState<number | null>(defaultSubject5RodBY)
  const [subject6RodAX, setSubject6RodAX] = useState<number | null>(defaultSubject6RodAX)
  const [subject6RodAY, setSubject6RodAY] = useState<number | null>(defaultSubject6RodAY)
  const [subject6RodBX, setSubject6RodBX] = useState<number | null>(defaultSubject6RodBX)
  const [subject6RodBY, setSubject6RodBY] = useState<number | null>(defaultSubject6RodBY)
  const [subject6RodCX, setSubject6RodCX] = useState<number | null>(defaultSubject6RodCX)
  const [subject6RodCY, setSubject6RodCY] = useState<number | null>(defaultSubject6RodCY)
  const [subject6RodDX, setSubject6RodDX] = useState<number | null>(defaultSubject6RodDX)
  const [subject6RodDY, setSubject6RodDY] = useState<number | null>(defaultSubject6RodDY)
  const isSubject1Template = template?.id === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID || template?.id === SUBJECT1_SQUARE_TURN_AND_FLY_TEMPLATE_ID
  const isSubject2Template = template?.id === SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID
  const isSubject5Template = template?.id === SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID
  const isSubject6Template = template?.id === SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID
  const isSubject7Template = template?.id === SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID

  const valid = useMemo(() => {
    if (isSubject7Template) {
      return true
    }
    if (isSubject6Template) {
      return Number.isFinite(subject6RodAX)
        && Number.isFinite(subject6RodAY)
        && Number.isFinite(subject6RodBX)
        && Number.isFinite(subject6RodBY)
        && Number.isFinite(subject6RodCX)
        && Number.isFinite(subject6RodCY)
        && Number.isFinite(subject6RodDX)
        && Number.isFinite(subject6RodDY)
    }
    if (isSubject5Template) {
      return Number.isFinite(subject5RodAX)
        && Number.isFinite(subject5RodAY)
        && Number.isFinite(subject5RodBX)
        && Number.isFinite(subject5RodBY)
    }
    if (isSubject2Template) {
      return Number.isFinite(subject2RodAX)
        && Number.isFinite(subject2RodAY)
        && Number.isFinite(subject2RodBX)
        && Number.isFinite(subject2RodBY)
    }
    return Number.isFinite(subject1X) && Number.isFinite(subject1Y)
  }, [
    isSubject2Template,
    isSubject5Template,
    isSubject6Template,
    isSubject7Template,
    subject1X,
    subject1Y,
    subject2RodAX,
    subject2RodAY,
    subject2RodBX,
    subject2RodBY,
    subject5RodAX,
    subject5RodAY,
    subject5RodBX,
    subject5RodBY,
    subject6RodAX,
    subject6RodAY,
    subject6RodBX,
    subject6RodBY,
    subject6RodCX,
    subject6RodCY,
    subject6RodDX,
    subject6RodDY,
  ])

  return (
    <Modal
      title={template ? `插入模板：${template.label}` : '插入模板'}
      open
      okText="确定插入"
      cancelText="取消"
      okButtonProps={{ disabled: !valid }}
      onCancel={onCancel}
      onOk={() => {
        if (
          !valid ||
          subject1X === null ||
          subject1Y === null ||
          subject2RodAX === null ||
          subject2RodAY === null ||
          subject2RodBX === null ||
          subject2RodBY === null ||
          subject5RodAX === null ||
          subject5RodAY === null ||
          subject5RodBX === null ||
          subject5RodBY === null ||
          subject6RodAX === null ||
          subject6RodAY === null ||
          subject6RodBX === null ||
          subject6RodBY === null ||
          subject6RodCX === null ||
          subject6RodCY === null ||
          subject6RodDX === null ||
          subject6RodDY === null
        ) {
          return
        }
        onConfirm({
          subject1X,
          subject1Y,
          subject2RodAX,
          subject2RodAY,
          subject2RodBX,
          subject2RodBY,
          subject5RodAX,
          subject5RodAY,
          subject5RodBX,
          subject5RodBY,
          subject6RodAX,
          subject6RodAY,
          subject6RodBX,
          subject6RodBY,
          subject6RodCX,
          subject6RodCY,
          subject6RodDX,
          subject6RodDY,
        })
      }}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {isSubject2Template ? (
          <>
            <Typography.Text type="secondary">
              模板参数：科目二横杆两端点坐标（A/B 的 XY）。默认值来自杆子配置，可手动调整。
            </Typography.Text>
            <Space size={10} wrap>
              <Space size={6} align="center">
                <Typography.Text>A.X</Typography.Text>
                <InputNumber
                  value={subject2RodAX}
                  controls={false}
                  precision={2}
                  placeholder="科目二 A 点 X"
                  onChange={(value) => setSubject2RodAX(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>A.Y</Typography.Text>
                <InputNumber
                  value={subject2RodAY}
                  controls={false}
                  precision={2}
                  placeholder="科目二 A 点 Y"
                  onChange={(value) => setSubject2RodAY(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.X</Typography.Text>
                <InputNumber
                  value={subject2RodBX}
                  controls={false}
                  precision={2}
                  placeholder="科目二 B 点 X"
                  onChange={(value) => setSubject2RodBX(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.Y</Typography.Text>
                <InputNumber
                  value={subject2RodBY}
                  controls={false}
                  precision={2}
                  placeholder="科目二 B 点 Y"
                  onChange={(value) => setSubject2RodBY(typeof value === 'number' ? value : null)}
                />
              </Space>
            </Space>
          </>
        ) : isSubject5Template ? (
          <>
            <Typography.Text type="secondary">
              模板参数：科目五两杆端点坐标（A/B 的 XY）。模板会按杆子实际方向生成，起点仅在两端点里自动选最近点。
            </Typography.Text>
            <Space size={10} wrap>
              <Space size={6} align="center">
                <Typography.Text>A.X</Typography.Text>
                <InputNumber
                  value={subject5RodAX}
                  controls={false}
                  precision={2}
                  placeholder="科目五 A 点 X"
                  onChange={(value) => setSubject5RodAX(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>A.Y</Typography.Text>
                <InputNumber
                  value={subject5RodAY}
                  controls={false}
                  precision={2}
                  placeholder="科目五 A 点 Y"
                  onChange={(value) => setSubject5RodAY(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.X</Typography.Text>
                <InputNumber
                  value={subject5RodBX}
                  controls={false}
                  precision={2}
                  placeholder="科目五 B 点 X"
                  onChange={(value) => setSubject5RodBX(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.Y</Typography.Text>
                <InputNumber
                  value={subject5RodBY}
                  controls={false}
                  precision={2}
                  placeholder="科目五 B 点 Y"
                  onChange={(value) => setSubject5RodBY(typeof value === 'number' ? value : null)}
                />
              </Space>
            </Space>
          </>
        ) : isSubject6Template ? (
          <>
            <Typography.Text type="secondary">
              模板参数：科目六两组横杆的 4 个端点坐标（A/B 与 C/D 的 XY）。模板按两组中点方向生成，并在两端 4 个点中自动选最近起点。
            </Typography.Text>
            <Space size={10} wrap>
              <Space size={6} align="center">
                <Typography.Text>A.X</Typography.Text>
                <InputNumber value={subject6RodAX} controls={false} precision={2} placeholder="科目六 A 点 X" onChange={(value) => setSubject6RodAX(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>A.Y</Typography.Text>
                <InputNumber value={subject6RodAY} controls={false} precision={2} placeholder="科目六 A 点 Y" onChange={(value) => setSubject6RodAY(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.X</Typography.Text>
                <InputNumber value={subject6RodBX} controls={false} precision={2} placeholder="科目六 B 点 X" onChange={(value) => setSubject6RodBX(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>B.Y</Typography.Text>
                <InputNumber value={subject6RodBY} controls={false} precision={2} placeholder="科目六 B 点 Y" onChange={(value) => setSubject6RodBY(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>C.X</Typography.Text>
                <InputNumber value={subject6RodCX} controls={false} precision={2} placeholder="科目六 C 点 X" onChange={(value) => setSubject6RodCX(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>C.Y</Typography.Text>
                <InputNumber value={subject6RodCY} controls={false} precision={2} placeholder="科目六 C 点 Y" onChange={(value) => setSubject6RodCY(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>D.X</Typography.Text>
                <InputNumber value={subject6RodDX} controls={false} precision={2} placeholder="科目六 D 点 X" onChange={(value) => setSubject6RodDX(typeof value === 'number' ? value : null)} />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>D.Y</Typography.Text>
                <InputNumber value={subject6RodDY} controls={false} precision={2} placeholder="科目六 D 点 Y" onChange={(value) => setSubject6RodDY(typeof value === 'number' ? value : null)} />
              </Space>
            </Space>
          </>
        ) : isSubject7Template ? (
          <Typography.Text type="secondary">
            模板参数：默认读取科目七两杆坐标（A/B），按中点生成“先下探再异步上升”的三色穿圈动作，无需手动输入。
          </Typography.Text>
        ) : (
          <>
            <Typography.Text type="secondary">
              模板参数：科目一杆子坐标（XY）。默认值来自杆子配置，可手动调整。
            </Typography.Text>
            <Space size={10} wrap>
              <Space size={6} align="center">
                <Typography.Text>X</Typography.Text>
                <InputNumber
                  value={subject1X}
                  controls={false}
                  precision={2}
                  placeholder="科目一 X"
                  onChange={(value) => setSubject1X(typeof value === 'number' ? value : null)}
                />
              </Space>
              <Space size={6} align="center">
                <Typography.Text>Y</Typography.Text>
                <InputNumber
                  value={subject1Y}
                  controls={false}
                  precision={2}
                  placeholder="科目一 Y"
                  onChange={(value) => setSubject1Y(typeof value === 'number' ? value : null)}
                />
              </Space>
            </Space>
          </>
        )}
        {!isSubject1Template && !isSubject2Template && !isSubject5Template && !isSubject6Template && !isSubject7Template && (
          <Typography.Text type="secondary">该模板暂未定义参数表单。</Typography.Text>
        )}
      </Space>
    </Modal>
  )
}

export default BlockTemplateInsertModal
