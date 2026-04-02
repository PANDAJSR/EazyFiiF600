import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Layout, Modal, Space, message, Typography } from 'antd'
import DroneSidebar from './components/DroneSidebar'
import BlockCanvas from './components/BlockCanvas'
import FloatingTrajectoryPanel from './components/FloatingTrajectoryPanel'
import DroneStartPosModal from './components/DroneStartPosModal'
import type { ParseResult } from './types/fii'
import { parseFiiFromFiles } from './utils/fiiParser'
import { isDesktopRuntime, isElectronShell } from './utils/desktopBridge'
import { openDomDirectoryPicker } from './utils/domFilePicker'
import { createInsertedBlock, INSERTABLE_BLOCKS } from './components/blockInsertCatalog'
import useSelectedBlockEnterHotkey from './components/useSelectedBlockEnterHotkey'
import useFocusBlockFirstInput from './components/useFocusBlockFirstInput'
import useBlockKeyboardNavigation from './components/useBlockKeyboardNavigation'
import useDroneDialog from './components/useDroneDialog'
import { applySavedEdits, saveResultEdits } from './utils/blockEditsStorage'
import { LOCAL_DRAFT_SOURCE_NAME, readLocalDraftResult, saveLocalDraftPrograms } from './utils/localDraftStorage'
import { duplicateBlockAfterTarget, insertBlockAfterTarget, insertFirstBlockWhenEmpty, removeBlockById, replaceSelectedProgramBlocks, updateBlockField, updateMovePoint } from './utils/programMutations'
import { saveDesktopProject } from './utils/desktopProjectIO'

function App() {
  const [result, setResult] = useState<ParseResult>(() => readLocalDraftResult())
  const [selectedDroneId, setSelectedDroneId] = useState<string>()
  const [highlightedBlockId, setHighlightedBlockId] = useState<string>()
  const [selectedBlockId, setSelectedBlockId] = useState<string>()
  const [highlightPulse, setHighlightPulse] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [insertPickerOpen, setInsertPickerOpen] = useState(false)
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string>()
  const [pendingFocusBlockId, setPendingFocusBlockId] = useState<string>()
  const [desktopProjectDirectory, setDesktopProjectDirectory] = useState<string>()
  const [pathDrawingMode, setPathDrawingMode] = useState(false)
  const [pathInsertAfterBlockId, setPathInsertAfterBlockId] = useState<string>()
  const directoryPickerRef = useRef<HTMLInputElement>(null)
  const filesPickerRef = useRef<HTMLInputElement>(null)
  const moveToBlockDefinition = INSERTABLE_BLOCKS.find((item) => item.type === 'Goertek_MoveToCoord2') ?? INSERTABLE_BLOCKS[0]
  const selectedProgram = useMemo(
    () => result.programs.find((item) => item.drone.id === selectedDroneId),
    [result.programs, selectedDroneId],
  )
  const {
    droneDialogMode,
    droneDialogOpen,
    droneStartPosDraft,
    setDroneStartPosDraft,
    setDroneDialogOpen,
    openCreateDroneDialog,
    openEditDroneDialog,
    handleConfirmDroneDialog,
  } = useDroneDialog({
    result,
    setResult,
    setSelectedDroneId,
    setSelectedBlockId,
    setHighlightedBlockId,
    setHighlightPulse,
    setHasUnsavedChanges,
  })
  useSelectedBlockEnterHotkey({
    enabled: !!selectedDroneId && !insertPickerOpen,
    selectedBlockId,
    onOpen: (blockId) => {
      setInsertAfterBlockId(blockId)
      setInsertPickerOpen(true)
    },
  })
  useFocusBlockFirstInput({
    blockId: pendingFocusBlockId,
    onFocused: () => setPendingFocusBlockId(undefined),
  })
  const handleLocateBlock = useCallback((blockId: string) => {
    setHighlightedBlockId(blockId)
    setSelectedBlockId(blockId)
    setHighlightPulse((prev) => prev + 1)
  }, [])
  const handleParseFiles = async (list: FileList | null) => {
    if (!list?.length) {
      return
    }
    setLoading(true)
    try {
      const parsed = await parseFiiFromFiles(Array.from(list))
      if (!parsed.sourceName) {
        console.warn('[fii] parse skipped: no .fii source found in selected files', {
          selectedCount: list.length,
          warnings: parsed.warnings,
        })
        message.error('所选路径未找到 .fii 文件，未更新当前程序。请重新选择包含 .fii 的目录。')
        return
      }
      const merged = applySavedEdits(parsed)
      setResult(merged)
      setSelectedDroneId(merged.programs[0]?.drone.id)
      setHighlightedBlockId(undefined)
      setSelectedBlockId(undefined)
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
    setResult((prev) => updateBlockField(prev, selectedDroneId, blockId, fieldKey, value))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])
  const handleSaveEdits = useCallback(async () => {
    if (isDesktopRuntime()) {
      try {
        const saveResult = await saveDesktopProject(result, desktopProjectDirectory)
        if (!saveResult) {
          return
        }
        setDesktopProjectDirectory(saveResult.directoryPath)
        setHasUnsavedChanges(false)
        message.success(`已写入 ${saveResult.writtenCount} 个文件`)
      } catch {
        message.error('保存失败，请检查目录权限')
      }
      return
    }
    if (isElectronShell()) {
      message.error('桌面桥接未初始化，请重启 Electron 进程后重试保存。')
      return
    }
    if (!result.sourceName || result.sourceName === LOCAL_DRAFT_SOURCE_NAME) {
      console.info('[fii] save blocked: source path is not bound', { sourceName: result.sourceName })
      message.warning('当前仅保存到浏览器本地草稿。请先通过“选择文件夹/文件”加载含 .fii 的工程后再保存。')
      return
    }

    if (result.sourceName && result.sourceName !== LOCAL_DRAFT_SOURCE_NAME) {
      saveResultEdits(result.sourceName, result.programs)
    }
    saveLocalDraftPrograms(result.programs)
    setHasUnsavedChanges(false)
    message.success('已保存到本地')
  }, [desktopProjectDirectory, result])
  const handleMovePoint = useCallback((payload: {
    blockId: string
    blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
    x: number
    y: number
    baseX?: number
    baseY?: number
  }) => {
    setResult((prev) => updateMovePoint(prev, selectedDroneId, payload))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])
  const handlePathDrawingToggle = useCallback((enabled: boolean) => {
    if (!enabled) {
      setPathDrawingMode(false)
      setPathInsertAfterBlockId(undefined)
      return
    }
    if (!selectedBlockId) {
      message.warning('请先选中一个积木，再进入画路径模式')
      return
    }
    setPathDrawingMode(true)
    setPathInsertAfterBlockId(selectedBlockId)
  }, [selectedBlockId])
  const handlePathPointDraw = useCallback((x: number, y: number) => {
    if (!pathDrawingMode || !selectedDroneId) {
      return
    }
    const targetBlockId = pathInsertAfterBlockId ?? selectedBlockId
    if (!targetBlockId) {
      message.warning('请先选中一个积木，再继续画路径')
      setPathDrawingMode(false)
      return
    }
    const nextBlock = createInsertedBlock(moveToBlockDefinition)
    nextBlock.fields.X = String(x)
    nextBlock.fields.Y = String(y)
    setResult((prev) => insertBlockAfterTarget(prev, selectedDroneId, targetBlockId, nextBlock))
    setSelectedBlockId(nextBlock.id)
    setHighlightedBlockId(nextBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setPathInsertAfterBlockId(nextBlock.id)
    setHasUnsavedChanges(true)
  }, [moveToBlockDefinition, pathDrawingMode, pathInsertAfterBlockId, selectedBlockId, selectedDroneId])
  const handleDeleteBlock = useCallback((blockId: string) => {
    Modal.confirm({
      title: '删除积木',
      content: '确认删除这个积木吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setResult((prev) => removeBlockById(prev, selectedDroneId, blockId))
        setHasUnsavedChanges(true)
        setPathInsertAfterBlockId((prev) => (prev === blockId ? undefined : prev))
        setSelectedBlockId((prev) => (prev === blockId ? undefined : prev))
        setHighlightedBlockId((prev) => (prev === blockId ? undefined : prev))
        message.success('积木已删除')
      },
    })
  }, [selectedDroneId])
  const handleDuplicateBlock = useCallback((blockId: string) => {
    setResult((prev) => duplicateBlockAfterTarget(prev, selectedDroneId, blockId))
    setHasUnsavedChanges(true)
    message.success('已复制积木')
  }, [selectedDroneId])
  useEffect(() => {
    if (!selectedDroneId) {
      setSelectedDroneId(result.programs[0]?.drone.id)
      return
    }
    if (result.programs.some((program) => program.drone.id === selectedDroneId)) {
      return
    }
    setSelectedDroneId(result.programs[0]?.drone.id)
  }, [result.programs, selectedDroneId])
  useEffect(() => {
    if (!pathDrawingMode) {
      return
    }
    if (!selectedBlockId) {
      setPathDrawingMode(false)
      setPathInsertAfterBlockId(undefined)
    }
  }, [pathDrawingMode, selectedBlockId])
  useBlockKeyboardNavigation({
    selectedProgram,
    selectedBlockId,
    onSelectBlock: (blockId) => setSelectedBlockId(blockId),
    onDeleteBlock: handleDeleteBlock,
  })
  const handleReorderBlocks = useCallback((nextBlocks: ParseResult['programs'][number]['blocks']) => {
    setResult((prev) => replaceSelectedProgramBlocks(prev, selectedDroneId, nextBlocks))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])
  const handleInsertBlock = useCallback((definition: (typeof INSERTABLE_BLOCKS)[number]) => {
    const targetBlockId = insertAfterBlockId ?? selectedBlockId
    if (!targetBlockId || !selectedDroneId) {
      return
    }
    const nextBlock = createInsertedBlock(definition)
    setResult((prev) => insertBlockAfterTarget(prev, selectedDroneId, targetBlockId, nextBlock))
    setSelectedBlockId(nextBlock.id)
    setHighlightedBlockId(nextBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setPendingFocusBlockId(nextBlock.id)
    setInsertPickerOpen(false)
    setInsertAfterBlockId(undefined)
    setHasUnsavedChanges(true)
    message.success(`已插入积木：${definition.label}`)
  }, [insertAfterBlockId, selectedBlockId, selectedDroneId])
  const handleInsertFirstBlock = useCallback(() => {
    if (!selectedDroneId) {
      return
    }
    const defaultBlock = createInsertedBlock(INSERTABLE_BLOCKS[0])
    setResult((prev) => insertFirstBlockWhenEmpty(prev, selectedDroneId, defaultBlock))
    setSelectedBlockId(defaultBlock.id)
    setHighlightedBlockId(defaultBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setPendingFocusBlockId(defaultBlock.id)
    setHasUnsavedChanges(true)
    message.success(`已插入积木：${INSERTABLE_BLOCKS[0].label}`)
  }, [selectedDroneId])
  return (
    <ConfigProvider>
      <Layout className="app-root">
        <Layout.Sider width={340} className="app-sider">
          <div className="brand-title">Fii 动作查看器</div>
          <div className="sider-actions">
            <Button type="primary" onClick={() => openDomDirectoryPicker(directoryPickerRef)} loading={loading} block>
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
            onCreateDrone={openCreateDroneDialog}
            onEditDrone={openEditDroneDialog}
            onSelect={(id) => {
              setSelectedDroneId(id)
              setHighlightedBlockId(undefined)
              setSelectedBlockId(undefined)
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
              {!selectedProgram?.blocks.length && (
                <Button onClick={handleInsertFirstBlock} disabled={!selectedProgram}>
                  添加首个积木
                </Button>
              )}
              {hasUnsavedChanges && <Typography.Text type="warning">有未保存修改</Typography.Text>}
              <Button type="primary" onClick={() => void handleSaveEdits()} disabled={loading}>
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
                selectedBlockId={selectedBlockId}
                highlightPulse={highlightPulse}
                onFieldChange={handleFieldChange}
                onSelectBlock={(blockId) => setSelectedBlockId(blockId)}
                onDuplicateBlock={handleDuplicateBlock}
                onDeleteBlock={handleDeleteBlock}
                onReorderBlocks={handleReorderBlocks}
                insertPickerOpen={insertPickerOpen}
                insertPickerItems={INSERTABLE_BLOCKS}
                onInsertPickerCancel={() => { setInsertPickerOpen(false); setInsertAfterBlockId(undefined) }}
                onInsertPickerSubmit={handleInsertBlock}
              />
            </section>
          </div>
          <FloatingTrajectoryPanel
            startPos={selectedProgram?.drone.startPos ?? { x: '0', y: '0', z: '0' }}
            blocks={selectedProgram?.blocks ?? []}
            selectedBlockId={selectedBlockId}
            pathDrawingMode={pathDrawingMode}
            onPathDrawingToggle={handlePathDrawingToggle}
            onDrawPathPoint={handlePathPointDraw}
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
      <DroneStartPosModal
        mode={droneDialogMode}
        open={droneDialogOpen}
        draft={droneStartPosDraft}
        onChange={setDroneStartPosDraft}
        onCancel={() => setDroneDialogOpen(false)}
        onConfirm={handleConfirmDroneDialog}
      />
    </ConfigProvider>
  )
}
export default App
