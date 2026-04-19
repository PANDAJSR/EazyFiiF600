import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, ConfigProvider, Dropdown, Layout, Modal, Space, message, Typography } from 'antd'
import { FolderOpenOutlined, FileOutlined, DownOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons'
import DroneSidebar from './components/DroneSidebar'
// import AgentChatFloatingController from './components/AgentChatFloatingController'
// import TerminalFloatingController from './components/TerminalFloatingController'
import BlockCanvas from './components/BlockCanvas'
import FloatingTrajectoryPanel from './components/FloatingTrajectoryPanel'
import DroneStartPosModal from './components/DroneStartPosModal'
import SettingsModal from './components/SettingsModal'
import type { ParseResult } from './types/fii'
import type { RodConfig } from './components/trajectory/rodConfig'
import { createInsertedBlock, INSERTABLE_BLOCKS } from './components/blockInsertCatalog'
import type { InsertPickerItem } from './components/blockInsertPickerCatalog'
import { INSERT_PICKER_ITEMS } from './components/blockInsertPickerCatalog'
import BlockTemplateInsertModal, { type TemplateModalConfirmPayload } from './components/BlockTemplateInsertModal'
import {
  buildTemplateBlocks,
  getSubject1TemplateDefaultCenter,
  getSubject2TemplateDefaultRods,
  getSubject5TemplateDefaultRods,
  getSubject6TemplateDefaultRods,
  getSubject7TemplateDefaultRods,
  SUBJECT1_SQUARE_STABLE_TEMPLATE_ID,
  SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID,
  SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID,
  SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID,
  SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID,
  type InsertableTemplateDefinition,
} from './components/blockTemplateCatalog'
import useSelectedBlockEnterHotkey from './components/useSelectedBlockEnterHotkey'
import useFocusBlockFirstInput from './components/useFocusBlockFirstInput'
import useBlockKeyboardNavigation from './components/useBlockKeyboardNavigation'
import usePathDrawingHotkey from './components/usePathDrawingHotkey'
import useSaveOpenHotkey from './hooks/useSaveOpenHotkey'
import useDroneDialog from './components/useDroneDialog'
import useTrajectoryVisibility, { getTrajectoryColor } from './components/useTrajectoryVisibility'
import { readLocalDraftResult } from './utils/localDraftStorage'
import { isDesktopRuntime, onAgentStream, onAgentTrajectoryIssuesRequest, sendAgentTrajectoryIssuesResponse, onAgentProjectContextRequest, sendAgentProjectContextResponse } from './utils/desktopBridge'
import { convertTurnBlockById, duplicateBlockAfterTarget, insertBlockAfterTarget, insertBlocksAfterTarget, insertFirstBlockWhenEmpty, normalizeAllProgramsAutoDelayBlocks, normalizeBlockFieldOnBlur, removeBlockById, replaceSelectedProgramBlocks, splitAutoDelayBlockById, updateBlockField, updateMovePoint } from './utils/programMutations'
import { calculateBlockEndState } from './utils/blockEndState'
import { AUTO_DELAY_BLOCK_TYPE } from './utils/autoDelayBlocks'
import { getPathDrawingInheritedZ } from './utils/pathDrawing'
import { useProjectFileIO } from './hooks/useProjectFileIO'
import { buildTrajectoryIssueContext } from './components/trajectory/trajectoryIssueContext'
import { loadAppSettings, type AppSettings } from './utils/appSettings'
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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings())
  const [pendingTemplateDefinition, setPendingTemplateDefinition] = useState<InsertableTemplateDefinition>()
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const directoryPickerRef = useRef<HTMLInputElement>(null)
  const filesPickerRef = useRef<HTMLInputElement>(null)
  const moveToBlockDefinition = INSERTABLE_BLOCKS.find((item) => item.type === 'Goertek_MoveToCoord2') ?? INSERTABLE_BLOCKS[0]
  const moveToAutoDelayBlockDefinition = INSERTABLE_BLOCKS.find((item) => item.type === AUTO_DELAY_BLOCK_TYPE) ?? moveToBlockDefinition
  const selectedProgram = useMemo(
    () => result.programs.find((item) => item.drone.id === selectedDroneId),
    [result.programs, selectedDroneId],
  )
  const subject1TemplateDefaultCenter = useMemo(
    () => getSubject1TemplateDefaultCenter(agentRodConfigContext),
    [agentRodConfigContext],
  )
  const subject2TemplateDefaultRods = useMemo(
    () => getSubject2TemplateDefaultRods(agentRodConfigContext),
    [agentRodConfigContext],
  )
  const subject5TemplateDefaultRods = useMemo(
    () => getSubject5TemplateDefaultRods(agentRodConfigContext),
    [agentRodConfigContext],
  )
  const subject6TemplateDefaultRods = useMemo(
    () => getSubject6TemplateDefaultRods(agentRodConfigContext),
    [agentRodConfigContext],
  )
  const subject7TemplateDefaultRods = useMemo(
    () => getSubject7TemplateDefaultRods(agentRodConfigContext),
    [agentRodConfigContext],
  )
  const trajectoryIssueContext = useMemo(() => {
    return buildTrajectoryIssueContext(result, agentRodConfigContext, appSettings.safetyDistance)
  }, [agentRodConfigContext, appSettings.safetyDistance, result])
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
  useSaveOpenHotkey({
    onSave: () => {
      setManualSaveSignal((prev) => prev + 1)
      void handleSaveEdits()
    },
    onOpen: () => void handleOpenDirectory(),
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
    if (definition.type === AUTO_DELAY_BLOCK_TYPE && selectedProgram?.drone.startPos) {
      const endState = calculateBlockEndState(selectedProgram.drone.startPos, selectedProgram.blocks, targetBlockId)
      if (endState) {
        nextBlock.fields.X = String(endState.position.x)
        nextBlock.fields.Y = String(endState.position.y)
        nextBlock.fields.Z = String(endState.position.z)
      }
    }
    setResult((prev) => insertBlockAfterTarget(prev, selectedDroneId, targetBlockId, nextBlock))
    setSelectedBlockId(nextBlock.id)
    setHighlightedBlockId(nextBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setPendingFocusTarget({ blockId: nextBlock.id })
    setInsertPickerOpen(false)
    setInsertAfterBlockId(undefined)
    setHasUnsavedChanges(true)
    message.success(`已插入积木：${definition.label}`)
  }, [insertAfterBlockId, selectedBlockId, selectedDroneId, selectedProgram])
  const handleInsertPickerSubmit = useCallback((item: InsertPickerItem) => {
    if (item.kind === 'template' && item.templateDefinition) {
      setPendingTemplateDefinition(item.templateDefinition)
      setTemplateModalOpen(true)
      setInsertPickerOpen(false)
      return
    }
    if (item.kind === 'block' && item.blockDefinition) {
      handleInsertBlock(item.blockDefinition)
    }
  }, [handleInsertBlock])
  const handleTemplateModalCancel = useCallback(() => {
    setTemplateModalOpen(false)
    setPendingTemplateDefinition(undefined)
    setInsertAfterBlockId(undefined)
  }, [])
  const handleTemplateInsertConfirm = useCallback((payload: TemplateModalConfirmPayload) => {
    const targetBlockId = insertAfterBlockId ?? selectedBlockId
    if (!targetBlockId || !selectedDroneId || !pendingTemplateDefinition) {
      setTemplateModalOpen(false)
      setPendingTemplateDefinition(undefined)
      return
    }
    const insertionEndState = selectedProgram
      ? calculateBlockEndState(selectedProgram.drone.startPos, selectedProgram.blocks, targetBlockId)
      : null
    const insertionContext = insertionEndState
      ? {
        x: insertionEndState.position.x,
        y: insertionEndState.position.y,
        z: insertionEndState.position.z,
        orientationDeg: insertionEndState.orientation,
      }
      : undefined
    const blocks = (() => {
      if (pendingTemplateDefinition.id === SUBJECT1_SQUARE_STABLE_TEMPLATE_ID) {
        return buildTemplateBlocks(pendingTemplateDefinition.id, {
          subject1X: payload.subject1X,
          subject1Y: payload.subject1Y,
          insertionContext,
        })
      }
      if (pendingTemplateDefinition.id === SUBJECT2_RECTANGLE_STABLE_TEMPLATE_ID) {
        return buildTemplateBlocks(pendingTemplateDefinition.id, {
          subject2RodAX: payload.subject2RodAX,
          subject2RodAY: payload.subject2RodAY,
          subject2RodBX: payload.subject2RodBX,
          subject2RodBY: payload.subject2RodBY,
          insertionContext,
        })
      }
      if (pendingTemplateDefinition.id === SUBJECT5_HEXAGON_FIGURE_EIGHT_TEMPLATE_ID) {
        return buildTemplateBlocks(pendingTemplateDefinition.id, {
          subject5RodAX: payload.subject5RodAX,
          subject5RodAY: payload.subject5RodAY,
          subject5RodBX: payload.subject5RodBX,
          subject5RodBY: payload.subject5RodBY,
          insertionContext,
        })
      }
      if (pendingTemplateDefinition.id === SUBJECT6_OCTAGON_FIGURE_EIGHT_TEMPLATE_ID) {
        return buildTemplateBlocks(pendingTemplateDefinition.id, {
          subject6RodAX: payload.subject6RodAX,
          subject6RodAY: payload.subject6RodAY,
          subject6RodBX: payload.subject6RodBX,
          subject6RodBY: payload.subject6RodBY,
          subject6RodCX: payload.subject6RodCX,
          subject6RodCY: payload.subject6RodCY,
          subject6RodDX: payload.subject6RodDX,
          subject6RodDY: payload.subject6RodDY,
          insertionContext,
        })
      }
      if (pendingTemplateDefinition.id === SUBJECT7_THREE_COLOR_RINGS_TEMPLATE_ID) {
        return buildTemplateBlocks(pendingTemplateDefinition.id, {
          subject7RodAX: subject7TemplateDefaultRods.subject7RodAX,
          subject7RodAY: subject7TemplateDefaultRods.subject7RodAY,
          subject7RodBX: subject7TemplateDefaultRods.subject7RodBX,
          subject7RodBY: subject7TemplateDefaultRods.subject7RodBY,
          insertionContext,
        })
      }
      return []
    })()
    if (!blocks.length) {
      message.warning('该模板暂未配置可插入内容')
      setTemplateModalOpen(false)
      setPendingTemplateDefinition(undefined)
      setInsertAfterBlockId(undefined)
      return
    }
    const lastInsertedBlock = blocks[blocks.length - 1]
    setResult((prev) => insertBlocksAfterTarget(prev, selectedDroneId, targetBlockId, blocks))
    setSelectedBlockId(lastInsertedBlock.id)
    setHighlightedBlockId(lastInsertedBlock.id)
    setHighlightPulse((prev) => prev + 1)
    setTemplateModalOpen(false)
    setPendingTemplateDefinition(undefined)
    setInsertAfterBlockId(undefined)
    setHasUnsavedChanges(true)
    message.success(`已插入模板：${pendingTemplateDefinition.label}`)
  }, [
    insertAfterBlockId,
    pendingTemplateDefinition,
    selectedBlockId,
    selectedDroneId,
    selectedProgram,
    subject7TemplateDefaultRods.subject7RodAX,
    subject7TemplateDefaultRods.subject7RodAY,
    subject7TemplateDefaultRods.subject7RodBX,
    subject7TemplateDefaultRods.subject7RodBY,
  ])
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
          <div className="brand-header">
            <div className="brand-title">Fii 动作查看器</div>
            <Space size={4}>
              <Dropdown.Button
                type="primary"
                icon={<DownOutlined />}
                loading={loading}
                menu={{
                  items: [
                    {
                      key: 'folder',
                      label: '打开文件夹',
                      icon: <FolderOpenOutlined />,
                      onClick: () => void handleOpenDirectory(),
                    },
                    {
                      key: 'file',
                      label: '打开 fii 文件',
                      icon: <FileOutlined />,
                      onClick: () => filesPickerRef.current?.click(),
                    },
                  ],
                }}
                onClick={() => void handleOpenDirectory()}
              >
                打开
              </Dropdown.Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => { setManualSaveSignal((prev) => prev + 1); void handleSaveEdits() }}
                disabled={loading}
              >
                保存
              </Button>
              <Button
                type="default"
                icon={<SettingOutlined />}
                onClick={() => setSettingsModalOpen(true)}
              />
            </Space>
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
                insertPickerItems={INSERT_PICKER_ITEMS}
                onInsertPickerCancel={() => { setInsertPickerOpen(false); setInsertAfterBlockId(undefined) }}
                onInsertPickerSubmit={handleInsertPickerSubmit}
              />
            </section>
          </div>
          <FloatingTrajectoryPanel
            selectedDroneId={selectedDroneId}
            allPrograms={result.programs}
            startPos={selectedProgram?.drone.startPos ?? { x: '0', y: '0', z: '0' }}
            blocks={selectedProgram?.blocks ?? []}
            safetyDistance={appSettings.safetyDistance}
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
      {/* AI 按钮已隐藏 */}
      {/* <AgentChatFloatingController
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
      /> */}
      {/* 终端按钮已隐藏 */}
      {/* <TerminalFloatingController /> */}
      {templateModalOpen && (
        <BlockTemplateInsertModal
          template={pendingTemplateDefinition}
          defaultSubject1X={subject1TemplateDefaultCenter.subject1X}
          defaultSubject1Y={subject1TemplateDefaultCenter.subject1Y}
          defaultSubject2RodAX={subject2TemplateDefaultRods.subject2RodAX}
          defaultSubject2RodAY={subject2TemplateDefaultRods.subject2RodAY}
          defaultSubject2RodBX={subject2TemplateDefaultRods.subject2RodBX}
          defaultSubject2RodBY={subject2TemplateDefaultRods.subject2RodBY}
          defaultSubject5RodAX={subject5TemplateDefaultRods.subject5RodAX}
          defaultSubject5RodAY={subject5TemplateDefaultRods.subject5RodAY}
          defaultSubject5RodBX={subject5TemplateDefaultRods.subject5RodBX}
          defaultSubject5RodBY={subject5TemplateDefaultRods.subject5RodBY}
          defaultSubject6RodAX={subject6TemplateDefaultRods.subject6RodAX}
          defaultSubject6RodAY={subject6TemplateDefaultRods.subject6RodAY}
          defaultSubject6RodBX={subject6TemplateDefaultRods.subject6RodBX}
          defaultSubject6RodBY={subject6TemplateDefaultRods.subject6RodBY}
          defaultSubject6RodCX={subject6TemplateDefaultRods.subject6RodCX}
          defaultSubject6RodCY={subject6TemplateDefaultRods.subject6RodCY}
          defaultSubject6RodDX={subject6TemplateDefaultRods.subject6RodDX}
          defaultSubject6RodDY={subject6TemplateDefaultRods.subject6RodDY}
          onCancel={handleTemplateModalCancel}
          onConfirm={handleTemplateInsertConfirm}
        />
      )}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSettingsChange={(nextSettings) => {
          if (nextSettings.autoDelayOffsetMs !== appSettings.autoDelayOffsetMs) {
            setResult((prev) => normalizeAllProgramsAutoDelayBlocks(prev))
            setHasUnsavedChanges(true)
          }
          setAppSettings(nextSettings)
        }}
      />
    </ConfigProvider>
  )
}
export default App
