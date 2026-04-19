import { useMemo, useState } from 'react'
import { InputNumber, Modal, Space, Typography } from 'antd'
import {
  SUBJECT1_SQUARE_STABLE_TEMPLATE_ID,
  SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID,
  type InsertableTemplateDefinition,
} from './blockTemplateCatalog'

export type TemplateModalConfirmPayload = {
  subject1X: number
  subject1Y: number
  subject2RodAX: number
  subject2RodAY: number
  subject2RodBX: number
  subject2RodBY: number
}

type Props = {
  template?: InsertableTemplateDefinition
  defaultSubject1X: number
  defaultSubject1Y: number
  defaultSubject2RodAX: number
  defaultSubject2RodAY: number
  defaultSubject2RodBX: number
  defaultSubject2RodBY: number
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
  onCancel,
  onConfirm,
}: Props) {
  const [subject1X, setSubject1X] = useState<number | null>(defaultSubject1X)
  const [subject1Y, setSubject1Y] = useState<number | null>(defaultSubject1Y)
  const [subject2RodAX, setSubject2RodAX] = useState<number | null>(defaultSubject2RodAX)
  const [subject2RodAY, setSubject2RodAY] = useState<number | null>(defaultSubject2RodAY)
  const [subject2RodBX, setSubject2RodBX] = useState<number | null>(defaultSubject2RodBX)
  const [subject2RodBY, setSubject2RodBY] = useState<number | null>(defaultSubject2RodBY)
  const isSubject1Template = template?.id === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID
  const isSubject2Template = template?.id === SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID

  const valid = useMemo(() => {
    if (isSubject2Template) {
      return Number.isFinite(subject2RodAX)
        && Number.isFinite(subject2RodAY)
        && Number.isFinite(subject2RodBX)
        && Number.isFinite(subject2RodBY)
    }
    return Number.isFinite(subject1X) && Number.isFinite(subject1Y)
  }, [isSubject2Template, subject1X, subject1Y, subject2RodAX, subject2RodAY, subject2RodBX, subject2RodBY])

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
          subject2RodBY === null
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
        {!isSubject1Template && !isSubject2Template && (
          <Typography.Text type="secondary">该模板暂未定义参数表单。</Typography.Text>
        )}
      </Space>
    </Modal>
  )
}

export default BlockTemplateInsertModal
