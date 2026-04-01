import { Input, Modal, Space, Typography } from 'antd'

type StartPos = {
  x: string
  y: string
}

type Props = {
  mode: 'create' | 'edit'
  open: boolean
  draft: StartPos
  onChange: (next: StartPos) => void
  onCancel: () => void
  onConfirm: () => void
}

function DroneStartPosModal({ mode, open, draft, onChange, onCancel, onConfirm }: Props) {
  return (
    <Modal
      title={mode === 'create' ? '新建无人机' : '修改无人机初始坐标'}
      open={open}
      okText={mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      onCancel={onCancel}
      onOk={onConfirm}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text>请输入无人机初始坐标 X/Y（cm）</Typography.Text>
        <Input addonBefore="X" value={draft.x} onChange={(event) => onChange({ ...draft, x: event.target.value })} />
        <Input addonBefore="Y" value={draft.y} onChange={(event) => onChange({ ...draft, y: event.target.value })} />
      </Space>
    </Modal>
  )
}

export default DroneStartPosModal
