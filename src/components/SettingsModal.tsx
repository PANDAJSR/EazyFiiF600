import { Modal, Form, InputNumber, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'

export interface SafetySettings {
  safetyDistance: number
}

const DEFAULT_SAFETY_DISTANCE = 15

const STORAGE_KEY = 'fii-safety-settings'

export function loadSafetySettings(): SafetySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        safetyDistance: typeof parsed.safetyDistance === 'number' ? parsed.safetyDistance : DEFAULT_SAFETY_DISTANCE,
      }
    }
  } catch {
    // ignore
  }
  return { safetyDistance: DEFAULT_SAFETY_DISTANCE }
}

export function saveSafetySettings(settings: SafetySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

type Props = {
  open: boolean
  onClose: () => void
  onSettingsChange?: (settings: SafetySettings) => void
}

function SettingsModal({ open, onClose, onSettingsChange }: Props) {
  const [form] = Form.useForm()
  const [settings, setSettings] = useState<SafetySettings>(() => loadSafetySettings())

  useEffect(() => {
    if (open) {
      const current = loadSafetySettings()
      setSettings(current)
      form.setFieldsValue(current)
    }
  }, [open, form])

  const handleOk = () => {
    form.validateFields().then((values) => {
      const newSettings: SafetySettings = {
        safetyDistance: values.safetyDistance ?? DEFAULT_SAFETY_DISTANCE,
      }
      saveSafetySettings(newSettings)
      setSettings(newSettings)
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
        initialValues={settings}
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
      </Form>
    </Modal>
  )
}

export default SettingsModal
