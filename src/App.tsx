import { useMemo, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Layout, message, Typography } from 'antd'
import DroneSidebar from './components/DroneSidebar'
import BlockCanvas from './components/BlockCanvas'
import TrajectoryPlane from './components/TrajectoryPlane'
import type { ParseResult } from './types/fii'
import { parseFiiFromFiles } from './utils/fiiParser'

type FileInputWithDirectory = HTMLInputElement & {
  webkitdirectory?: boolean
  directory?: boolean
}

function App() {
  const [result, setResult] = useState<ParseResult>({
    programs: [],
    warnings: [],
    sourceName: '',
  })
  const [selectedDroneId, setSelectedDroneId] = useState<string>()
  const [loading, setLoading] = useState(false)

  const directoryPickerRef = useRef<HTMLInputElement>(null)
  const filesPickerRef = useRef<HTMLInputElement>(null)

  const selectedProgram = useMemo(
    () => result.programs.find((item) => item.drone.id === selectedDroneId),
    [result.programs, selectedDroneId],
  )

  const handleParseFiles = async (list: FileList | null) => {
    if (!list?.length) {
      return
    }

    setLoading(true)
    try {
      const parsed = await parseFiiFromFiles(Array.from(list))
      setResult(parsed)
      setSelectedDroneId(parsed.programs[0]?.drone.id)
      if (parsed.warnings.length) {
        message.warning(`读取完成，存在 ${parsed.warnings.length} 条提示`)
      } else {
        message.success('文件读取成功')
      }
    } catch {
      message.error('文件解析失败，请确认 XML 格式是否正确')
    } finally {
      setLoading(false)
    }
  }

  const openDirectoryPicker = () => {
    const el = directoryPickerRef.current as FileInputWithDirectory | null
    if (!el) {
      return
    }
    el.setAttribute('webkitdirectory', 'true')
    el.setAttribute('directory', 'true')
    el.click()
  }

  return (
    <ConfigProvider>
      <Layout className="app-root">
        <Layout.Sider width={340} className="app-sider">
          <div className="brand-title">Fii 动作查看器</div>
          <div className="sider-actions">
            <Button type="primary" onClick={openDirectoryPicker} loading={loading} block>
              选择文件夹
            </Button>
            <Button onClick={() => filesPickerRef.current?.click()} disabled={loading} block>
              选择多个文件
            </Button>
          </div>
          {!!result.sourceName && (
            <Typography.Text type="secondary" className="source-tip">
              当前文件: {result.sourceName}
            </Typography.Text>
          )}
          <DroneSidebar
            programs={result.programs}
            selectedId={selectedDroneId}
            onSelect={setSelectedDroneId}
          />
        </Layout.Sider>
        <Layout.Content className="app-content">
          {!!result.warnings.length && (
            <Alert
              className="warning-panel"
              type="warning"
              showIcon
              message="解析提示"
              description={result.warnings.join('；')}
            />
          )}
          <div className="content-title">
            <Typography.Title level={4}>
              {selectedProgram?.drone.name ? `${selectedProgram.drone.name} 的动作积木` : '动作积木'}
            </Typography.Title>
          </div>
          <div className="content-grid">
            <section className="content-panel">
              <BlockCanvas
                droneName={selectedProgram?.drone.name}
                blocks={selectedProgram?.blocks ?? []}
              />
            </section>
            <section className="content-panel trajectory-panel">
              <Typography.Title level={5} className="trajectory-title">
                飞机平面轨迹（XY）
              </Typography.Title>
              <TrajectoryPlane
                startPos={selectedProgram?.drone.startPos ?? { x: '0', y: '0' }}
                blocks={selectedProgram?.blocks ?? []}
              />
            </section>
          </div>
        </Layout.Content>
      </Layout>
      <input
        ref={directoryPickerRef}
        className="hidden-input"
        type="file"
        onChange={(event) => void handleParseFiles(event.target.files)}
      />
      <input
        ref={filesPickerRef}
        className="hidden-input"
        type="file"
        multiple
        onChange={(event) => void handleParseFiles(event.target.files)}
      />
    </ConfigProvider>
  )
}

export default App
