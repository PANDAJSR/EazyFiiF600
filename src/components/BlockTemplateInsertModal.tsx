import { useMemo, useState } from 'react'
import { InputNumber, Modal, Space, Typography } from 'antd'
import type { InsertableTemplateDefinition } from './blockTemplateCatalog'

type Props = {
  template?: InsertableTemplateDefinition
  defaultX: number
  defaultY: number
  onCancel: () => void
  onConfirm: (payload: { x: number; y: number }) => void
}

function BlockTemplateInsertModal({
  template,
  defaultX,
  defaultY,
  onCancel,
  onConfirm,
}: Props) {
  const [x, setX] = useState<number | null>(defaultX)
  const [y, setY] = useState<number | null>(defaultY)

  const valid = useMemo(
    () => Number.isFinite(x) && Number.isFinite(y),
    [x, y],
  )

  return (
    <Modal
      title={template ? `插入模板：${template.label}` : '插入模板'}
      open
      okText="确定插入"
      cancelText="取消"
      okButtonProps={{ disabled: !valid }}
      onCancel={onCancel}
      onOk={() => {
        if (!valid || x === null || y === null) {
          return
        }
        onConfirm({ x, y })
      }}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          模板参数：科目一杆子坐标（XY）。默认值来自杆子配置，可手动调整。
        </Typography.Text>
        <Space size={10} wrap>
          <Space size={6} align="center">
            <Typography.Text>X</Typography.Text>
            <InputNumber
              value={x}
              controls={false}
              precision={2}
              placeholder="科目一 X"
              onChange={(value) => setX(typeof value === 'number' ? value : null)}
            />
          </Space>
          <Space size={6} align="center">
            <Typography.Text>Y</Typography.Text>
            <InputNumber
              value={y}
              controls={false}
              precision={2}
              placeholder="科目一 Y"
              onChange={(value) => setY(typeof value === 'number' ? value : null)}
            />
          </Space>
        </Space>
      </Space>
    </Modal>
  )
}

export default BlockTemplateInsertModal
