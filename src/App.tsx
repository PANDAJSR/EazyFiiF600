import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Layout, Modal, Space, message, Typography } from 'antd'
import DroneSidebar from './components/DroneSidebar'
import AgentChatFloatingController from './components/AgentChatFloatingController'
import TerminalFloatingController from './components/TerminalFloatingController'
import BlockCanvas from './components/BlockCanvas'
import FloatingTrajectoryPanel from './components/FloatingTrajectoryPanel'
import DroneStartPosModal from './components/DroneStartPosModal'
import type { ParseResult } from './types/fii'
import type { RodConfig } from './components/trajectory/rodConfig'
import { createInsertedBlock, INSERTABLE_BLOCKS } from './components/blockInsertCatalog'
import useSelectedBlockEnterHotkey from './components/useSelectedBlockEnterHotkey'
import useFocusBlockFirstInput from './components/useFocusBlockFirstInput'
import useBlockKeyboardNavigation from './components/useBlockKeyboardNavigation'
import usePathDrawingHotkey from './components/usePathDrawingHotkey'
import useDroneDialog from './components/useDroneDialog'
import useTrajectoryVisibility, { getTrajectoryColor } from './components/useTrajectoryVisibility'
import { readLocalDraftResult } from './utils/localDraftStorage'
import { isDesktopRuntime, onAgentStream, onAgentTrajectoryIssuesRequest, sendAgentTrajectoryIssuesResponse, onAgentProjectContextRequest, sendAgentProjectContextResponse } from './utils/desktopBridge'
import { convertTurnBlockById, duplicateBlockAfterTarget, insertBlockAfterTarget, insertFirstBlockWhenEmpty, normalizeBlockFieldOnBlur, removeBlockById, replaceSelectedProgramBlocks, splitAutoDelayBlockById, updateBlockField, updateMovePoint } from './utils/programMutations'
import { AUTO_DELAY_BLOCK_TYPE } from './utils/autoDelayBlocks'
import { getPathDrawingInheritedZ } from './utils/pathDrawing'
import { useProjectFileIO } from './hooks/useProjectFileIO'
import { buildTrajectoryIssueContext } from './components/trajectory/trajectoryIssueContext'
type PendingFocusTarget = {
  blockId: string
  fieldKey?: string
  selectAll?: boolean
}
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
  const [pendingFocusTarget, setPendingFocusTarget] = useState<PendingFocusTarget>()
  const [desktopProjectDirectory, setDesktopProjectDirectory] = useState<string>()
  const [pathDrawingMode, setPathDrawingMode] = useState(false)
  const [pathInsertAfterBlockId, setPathInsertAfterBlockId] = useState<string>()
  const [agentRodConfigContext, setAgentRodConfigContext] = useState<RodConfig>()
  const [manualSaveSignal, setManualSaveSignal] = useState(0)
  const directoryPickerRef = useRef<HTMLInputElement>(null)
  const filesPickerRef = useRef<HTMLInputElement>(null)
  const moveToBlockDefinition = INSERTABLE_BLOCKS.find((item) => item.type === 'Goertek_MoveToCoord2') ?? INSERTABLE_BLOCKS[0]
  const moveToAutoDelayBlockDefinition = INSERTABLE_BLOCKS.find((item) => item.type === AUTO_DELAY_BLOCK_TYPE) ?? moveToBlockDefinition
  const selectedProgram = useMemo(
    () => result.programs.find((item) => item.drone.id === selectedDroneId),
    [result.programs, selectedDroneId],
  )
  const trajectoryIssueContext = useMemo(() => buildTrajectoryIssueContext(result, agentRodConfigContext), [agentRodConfigContext, result])
  const selectedTrajectoryColor = useMemo(() => getTrajectoryColor(Math.max(0, result.programs.findIndex((item) => item.drone.id === selectedDroneId))), [result.programs, selectedDroneId])
  const { visibleTrajectoryIds, toggleTrajectoryVisibility, backgroundTrajectories } = useTrajectoryVisibility(result.programs)
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
  const { handleParseFiles, handleOpenDirectory, handleSaveEdits } = useProjectFileIO({
    result,
    desktopProjectDirectory,
    directoryPickerRef,
    setResult,
    setLoading,
    setDesktopProjectDirectory,
    setSelectedDroneId,
    setHighlightedBlockId,
    setSelectedBlockId,
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
    blockId: pendingFocusTarget?.blockId,
    fieldKey: pendingFocusTarget?.fieldKey,
    selectAll: pendingFocusTarget?.selectAll,
    onFocused: () => setPendingFocusTarget(undefined),
  })
  const handleLocateBlock = useCallback((blockId: string) => {
    console.log('[App] handleLocateBlock called, blockId:', blockId)
    setHighlightedBlockId(blockId)
    setSelectedBlockId(blockId)
    setHighlightPulse((prev) => prev + 1)
  }, [])
  const handleFieldChange = useCallback((blockId: string, fieldKey: string, value: string) => {
    setResult((prev) => updateBlockField(prev, selectedDroneId, blockId, fieldKey, value))
    setHasUnsavedChanges(true)
  }, [selectedDroneId])
  const handleFieldBlur = useCallback((blockId: string, fieldKey: string, value: string) => {
    setResult((prev) => normalizeBlockFieldOnBlur(prev, selectedDroneId, blockId, fieldKey, value))
  }, [selectedDroneId])
  const handleMovePoint = useCallback((payload: {
    blockId: string
    blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move' | typeof AUTO_DELAY_BLOCK_TYPE
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
    const nextBlock = createInsertedBlock(moveToAutoDelayBlockDefinition)
    nextBlock.fields.X = String(x)
    nextBlock.fields.Y = String(y)
    const inheritedZ = selectedProgram
      ? getPathDrawingInheritedZ(selectedProgram.drone.startPos, selectedProgram.blocks, targetBlockId)
      : null
    if (inheritedZ !== null) {
      nextBlock.fields.Z = String(inheritedZ)
    }
    setResult((prev) => insertBlockAfterTarget(prev, selectedDroneId, targetBlockId, nextBlock))
    setSelectedBlockId(nextBlock.id)
    setHighlightedBlockId(nextBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setPathInsertAfterBlockId(nextBlock.id)
    setPendingFocusTarget({ blockId: nextBlock.id, fieldKey: 'Z', selectAll: true })
    setHasUnsavedChanges(true)
  }, [moveToAutoDelayBlockDefinition, pathDrawingMode, pathInsertAfterBlockId, selectedBlockId, selectedDroneId, selectedProgram])
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
  const handleSplitAutoDelayBlock = useCallback((blockId: string) => {
    setResult((prev) => splitAutoDelayBlockById(prev, selectedDroneId, blockId))
    setHasUnsavedChanges(true)
    message.success('已拆散为两个积木')
  }, [selectedDroneId])
  const handleConvertTurnBlock = useCallback((blockId: string) => {
    setResult((prev) => convertTurnBlockById(prev, selectedDroneId, blockId))
    setHasUnsavedChanges(true)
    message.success('已转换积木类型')
  }, [selectedDroneId])
  useEffect(() => {
    if (!selectedDroneId) {
      queueMicrotask(() => setSelectedDroneId(result.programs[0]?.drone.id))
      return
    }
    if (result.programs.some((program) => program.drone.id === selectedDroneId)) {
      return
    }
    queueMicrotask(() => setSelectedDroneId(result.programs[0]?.drone.id))
  }, [result.programs, selectedDroneId])
  useEffect(() => {
    if (!pathDrawingMode) {
      return
    }
    if (!selectedBlockId) {
      queueMicrotask(() => {
        setPathDrawingMode(false)
        setPathInsertAfterBlockId(undefined)
      })
    }
  }, [pathDrawingMode, selectedBlockId])
  useBlockKeyboardNavigation({
    selectedProgram,
    selectedBlockId,
    onSelectBlock: (blockId) => setSelectedBlockId(blockId),
    onDeleteBlock: handleDeleteBlock,
  })
  usePathDrawingHotkey({
    pathDrawingMode,
    onToggle: handlePathDrawingToggle,
  })
  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }
    const unsubscribe = onAgentTrajectoryIssuesRequest(({ token }) => {
      sendAgentTrajectoryIssuesResponse({
        token,
        trajectoryIssueContext,
      })
    })
    return () => {
      unsubscribe?.()
    }
  }, [trajectoryIssueContext])
  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }
    const unsubscribe = onAgentProjectContextRequest(({ token }) => {
      sendAgentProjectContextResponse({
        token,
        projectContext: {
          ...result,
          rodConfig: agentRodConfigContext,
          trajectoryIssueContext,
        },
      })
    })
    return () => {
      unsubscribe?.()
    }
  }, [result, agentRodConfigContext, trajectoryIssueContext])
  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }
    const unsubscribe = onAgentStream((event) => {
      if (event.type === 'project-context-patched') {
        console.info('[app] project-context-patched event received', {
          hasProjectContext: !!event.projectContext,
          programCount: event.projectContext?.programs?.length,
        })
        setResult(event.projectContext)
        setHasUnsavedChanges(true)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [])
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
    setPendingFocusTarget({ blockId: nextBlock.id })
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
    setPendingFocusTarget({ blockId: defaultBlock.id })
    setHasUnsavedChanges(true)
    message.success(`已插入积木：${INSERTABLE_BLOCKS[0].label}`)
  }, [selectedDroneId])
  return (
    <ConfigProvider>
      <Layout className="app-root">
        <Layout.Sider width={340} className="app-sider">
          <div className="brand-title">Fii 动作查看器</div>
          <div className="sider-actions">
            <Button type="primary" onClick={() => void handleOpenDirectory()} loading={loading} block>
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
            visibleTrajectoryIds={visibleTrajectoryIds}
            onCreateDrone={openCreateDroneDialog}
            onEditDrone={openEditDroneDialog}
            onToggleTrajectoryVisibility={toggleTrajectoryVisibility}
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
              <Button type="primary" onClick={() => { setManualSaveSignal((prev) => prev + 1); void handleSaveEdits() }} disabled={loading}>
                保存修改
              </Button>
            </Space>
          </div>
          <div className="content-grid">
            <section className="content-panel">
              <BlockCanvas
                droneName={selectedProgram?.drone.name}
                startPos={selectedProgram?.drone.startPos}
                blocks={selectedProgram?.blocks ?? []}
                highlightedBlockId={highlightedBlockId}
                selectedBlockId={selectedBlockId}
                highlightPulse={highlightPulse}
                onFieldChange={handleFieldChange}
                onFieldBlur={handleFieldBlur}
                onSelectBlock={(blockId) => setSelectedBlockId(blockId)}
                onDuplicateBlock={handleDuplicateBlock}
                onSplitAutoDelayBlock={handleSplitAutoDelayBlock}
                onConvertTurnBlock={handleConvertTurnBlock}
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
            openedDirectoryPath={desktopProjectDirectory}
            selectedBlockId={selectedBlockId}
            pathDrawingMode={pathDrawingMode}
            onPathDrawingToggle={handlePathDrawingToggle}
            onDrawPathPoint={handlePathPointDraw}
            onLocateBlock={handleLocateBlock}
            onMovePoint={handleMovePoint}
            backgroundTrajectories={backgroundTrajectories.filter((item) => item.droneId !== selectedDroneId)}
            activeTrajectoryColor={selectedTrajectoryColor}
            onRodConfigChange={setAgentRodConfigContext}
            manualSaveSignal={manualSaveSignal}
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
      <AgentChatFloatingController
        projectContext={result}
        rodConfigContext={agentRodConfigContext}
        trajectoryIssueContext={trajectoryIssueContext}
        onProjectContextPatched={(next) => {
          console.info('[app] onProjectContextPatched called', {
            hasNext: !!next,
            programCount: next?.programs?.length,
          })
          setResult(next)
          setHasUnsavedChanges(true)
        }}
      />
      <TerminalFloatingController />
    </ConfigProvider>
  )
}
export default App
