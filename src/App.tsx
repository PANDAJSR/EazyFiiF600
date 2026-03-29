import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Layout, Space, message, Typography } from 'antd'
import DroneSidebar from './components/DroneSidebar'
import BlockCanvas from './components/BlockCanvas'
import FloatingTrajectoryPanel from './components/FloatingTrajectoryPanel'
import type { ParseResult } from './types/fii'
import { parseFiiFromFiles } from './utils/fiiParser'

type FileInputWithDirectory = HTMLInputElement & {
  webkitdirectory?: boolean
  directory?: boolean
}

type SavedEdits = {
  [sourceName: string]: {
    [droneId: string]: {
      [blockId: string]: Record<string, string>
    }
  }
}

const EDIT_STORAGE_KEY = 'fii-block-edits-v1'

const readSavedEdits = (): SavedEdits => {
  try {
    const raw = localStorage.getItem(EDIT_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed) {
      return parsed as SavedEdits
    }
    return {}
  } catch {
    return {}
  }
}

const saveEditsToStorage = (edits: SavedEdits) => {
  localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(edits))
}

const applySavedEdits = (result: ParseResult): ParseResult => {
  if (!result.sourceName) {
    return result
  }

  const allSaved = readSavedEdits()
  const sourceSaved = allSaved[result.sourceName]
  if (!sourceSaved) {
    return result
  }

  return {
    ...result,
    programs: result.programs.map((program) => {
      const droneSaved = sourceSaved[program.drone.id]
      if (!droneSaved) {
        return program
      }
      return {
        ...program,
        blocks: program.blocks.map((block) => {
          const blockSaved = droneSaved[block.id]
          if (!blockSaved) {
            return block
          }
          return {
            ...block,
            fields: {
              ...block.fields,
              ...blockSaved,
            },
          }
        }),
      }
    }),
  }
}

const buildSourceEdits = (programs: ParseResult['programs']) => {
  return programs.reduce<SavedEdits[string]>((droneAcc, program) => {
    droneAcc[program.drone.id] = program.blocks.reduce<SavedEdits[string][string]>((blockAcc, block) => {
      blockAcc[block.id] = block.fields
      return blockAcc
    }, {})
    return droneAcc
  }, {})
}

function App() {
  const [result, setResult] = useState<ParseResult>({
    programs: [],
    warnings: [],
    sourceName: '',
  })
  const [selectedDroneId, setSelectedDroneId] = useState<string>()
  const [highlightedBlockId, setHighlightedBlockId] = useState<string>()
  const [highlightPulse, setHighlightPulse] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const directoryPickerRef = useRef<HTMLInputElement>(null)
  const filesPickerRef = useRef<HTMLInputElement>(null)

  const selectedProgram = useMemo(
    () => result.programs.find((item) => item.drone.id === selectedDroneId),
    [result.programs, selectedDroneId],
  )

  const handleLocateBlock = useCallback((blockId: string) => {
    setHighlightedBlockId(blockId)
    setHighlightPulse((prev) => prev + 1)
  }, [])

  const handleParseFiles = async (list: FileList | null) => {
    if (!list?.length) {
      return
    }

    setLoading(true)
    try {
      const parsed = await parseFiiFromFiles(Array.from(list))
      const merged = applySavedEdits(parsed)

      setResult(merged)
      setSelectedDroneId(merged.programs[0]?.drone.id)
      setHighlightedBlockId(undefined)
      setHighlightPulse(0)
      setHasUnsavedChanges(false)

      if (merged.warnings.length) {
        message.warning(`读取完成，存在 ${merged.warnings.length} 条提示`)
      } else {
        message.success('文件读取成功')
      }
    } catch {
      message.error('文件解析失败，请确认 XML 格式是否正确')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = useCallback((blockId: string, fieldKey: string, value: string) => {
    setResult((prev) => ({
      ...prev,
      programs: prev.programs.map((program) => {
        if (program.drone.id !== selectedDroneId) {
          return program
        }
        return {
          ...program,
          blocks: program.blocks.map((block) => {
            if (block.id !== blockId) {
              return block
            }
            return {
              ...block,
              fields: {
                ...block.fields,
                [fieldKey]: value,
              },
            }
          }),
        }
      }),
    }))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])

  const handleSaveEdits = useCallback(() => {
    if (!result.sourceName) {
      message.warning('请先读取文件')
      return
    }

    const allSaved = readSavedEdits()
    allSaved[result.sourceName] = buildSourceEdits(result.programs)
    saveEditsToStorage(allSaved)
    setHasUnsavedChanges(false)
    message.success('修改已保存')
  }, [result.programs, result.sourceName])

  const handleMovePoint = useCallback((payload: {
    blockId: string
    blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
    x: number
    y: number
    baseX?: number
    baseY?: number
  }) => {
    setResult((prev) => ({
      ...prev,
      programs: prev.programs.map((program) => {
        if (program.drone.id !== selectedDroneId) {
          return program
        }
        return {
          ...program,
          blocks: program.blocks.map((block) => {
            if (block.id !== payload.blockId) {
              return block
            }

            if (payload.blockType === 'Goertek_MoveToCoord2') {
              return {
                ...block,
                fields: {
                  ...block.fields,
                  X: String(payload.x),
                  Y: String(payload.y),
                },
              }
            }

            const baseX = payload.baseX ?? 0
            const baseY = payload.baseY ?? 0
            return {
              ...block,
              fields: {
                ...block.fields,
                X: String(payload.x - baseX),
                Y: String(payload.y - baseY),
              },
            }
          }),
        }
      }),
    }))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])

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
            onSelect={(id) => {
              setSelectedDroneId(id)
              setHighlightedBlockId(undefined)
              setHighlightPulse(0)
            }}
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
            <Space align="center">
              <Typography.Title level={4}>
                {selectedProgram?.drone.name ? `${selectedProgram.drone.name} 的动作积木` : '动作积木'}
              </Typography.Title>
              <Button type="primary" onClick={handleSaveEdits} disabled={!result.sourceName || !hasUnsavedChanges}>
                保存修改
              </Button>
            </Space>
          </div>
          <div className="content-grid">
            <section className="content-panel">
              <BlockCanvas
                droneName={selectedProgram?.drone.name}
                blocks={selectedProgram?.blocks ?? []}
                highlightedBlockId={highlightedBlockId}
                highlightPulse={highlightPulse}
                onFieldChange={handleFieldChange}
              />
            </section>
          </div>
          <FloatingTrajectoryPanel
            startPos={selectedProgram?.drone.startPos ?? { x: '0', y: '0', z: '0' }}
            blocks={selectedProgram?.blocks ?? []}
            onLocateBlock={handleLocateBlock}
            onMovePoint={handleMovePoint}
          />
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
