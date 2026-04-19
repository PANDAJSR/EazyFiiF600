import { Modal, Form, InputNumber, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import {
  DEFAULT_AUTO_DELAY_OFFSET_MS,
  DEFAULT_SAFETY_DISTANCE,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from '../utils/appSettings'

type Props = {
  open: boolean
  onClose: () => void
  onSettingsChange?: (settings: AppSettings) => void
}

function SettingsModal({ open, onClose, onSettingsChange }: Props) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      const current = loadAppSettings()
      form.setFieldsValue(current)
    }
  }, [open, form])

  const handleOk = () => {
    form.validateFields().then((values) => {
      const newSettings: AppSettings = {
        safetyDistance: values.safetyDistance ?? DEFAULT_SAFETY_DISTANCE,
        autoDelayOffsetMs: values.autoDelayOffsetMs ?? DEFAULT_AUTO_DELAY_OFFSET_MS,
      }
      saveAppSettings(newSettings)
      onSettingsChange?.(newSettings)
      onClose()
    })
  }

  return (
    <Modal
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          设置
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={loadAppSettings()}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="safetyDistance"
          label="飞机与杆子安全距离"
          extra={<Typography.Text type="secondary">用于撞杆检测，单位为厘米(cm)</Typography.Text>}
          rules={[
            { required: true, message: '请输入安全距离' },
            { type: 'number', min: 0, max: 100, message: '安全距离范围 0-100 cm' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入安全距离"
            min={0}
            max={100}
            precision={1}
            addonAfter="cm"
          />
        </Form.Item>
        <Form.Item
          name="autoDelayOffsetMs"
          label="自动延时偏差"
          extra={<Typography.Text type="secondary">正数会在自动计算后增加，负数会减少，单位毫秒(ms)</Typography.Text>}
          rules={[
            { required: true, message: '请输入自动延时偏差' },
            { type: 'number', min: -10000, max: 10000, message: '自动延时偏差范围 -10000 到 10000 ms' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入自动延时偏差"
            min={-10000}
            max={10000}
            precision={0}
            step={100}
            addonAfter="ms"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default SettingsModal
