import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { message } from 'antd'
import type { ParseResult } from '../types/fii'
import { createEmptyDroneProgram, LOCAL_DRAFT_SOURCE_NAME } from '../utils/localDraftStorage'

type Params = {
  result: ParseResult
  setResult: Dispatch<SetStateAction<ParseResult>>
  setSelectedDroneId: Dispatch<SetStateAction<string | undefined>>
  setSelectedBlockIds: Dispatch<SetStateAction<string[]>>
  setHighlightedBlockId: Dispatch<SetStateAction<string | undefined>>
  setHighlightPulse: Dispatch<SetStateAction<number>>
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>
}

function useDroneDialog({
  result,
  setResult,
  setSelectedDroneId,
  setSelectedBlockIds,
  setHighlightedBlockId,
  setHighlightPulse,
  setHasUnsavedChanges,
}: Params) {
  const [droneDialogMode, setDroneDialogMode] = useState<'create' | 'edit'>('create')
  const [droneDialogOpen, setDroneDialogOpen] = useState(false)
  const [editingDroneId, setEditingDroneId] = useState<string>()
  const [droneStartPosDraft, setDroneStartPosDraft] = useState({ x: '0', y: '0' })

  const handleCreateDrone = useCallback(() => {
    const nextDrone = createEmptyDroneProgram(result.programs.length + 1, droneStartPosDraft)
    setResult((prev) => ({
      ...prev,
      programs: [...prev.programs, nextDrone],
      sourceName: prev.sourceName || LOCAL_DRAFT_SOURCE_NAME,
    }))
    setSelectedDroneId(nextDrone.drone.id)
    setSelectedBlockIds([])
    setHighlightedBlockId(undefined)
    setHighlightPulse(0)
    setHasUnsavedChanges(true)
    message.success(`已新建：${nextDrone.drone.name}`)
  }, [droneStartPosDraft, result.programs.length, setHasUnsavedChanges, setHighlightPulse, setHighlightedBlockId, setResult, setSelectedBlockIds, setSelectedDroneId])

  const openCreateDroneDialog = useCallback(() => {
    setDroneDialogMode('create')
    setEditingDroneId(undefined)
    setDroneStartPosDraft({ x: '0', y: '0' })
    setDroneDialogOpen(true)
  }, [])

  const openEditDroneDialog = useCallback((droneId: string) => {
    const target = result.programs.find((program) => program.drone.id === droneId)
    if (!target) {
      return
    }
    setDroneDialogMode('edit')
    setEditingDroneId(droneId)
    setDroneStartPosDraft({ x: target.drone.startPos.x || '0', y: target.drone.startPos.y || '0' })
    setDroneDialogOpen(true)
  }, [result.programs])

  const handleConfirmDroneDialog = useCallback(() => {
    if (droneDialogMode === 'create') {
      handleCreateDrone()
      setDroneDialogOpen(false)
      return
    }
    if (!editingDroneId) {
      setDroneDialogOpen(false)
      return
    }
    setResult((prev) => ({
      ...prev,
      programs: prev.programs.map((program) =>
        program.drone.id !== editingDroneId
          ? program
          : {
              ...program,
              drone: {
                ...program.drone,
                startPos: { x: droneStartPosDraft.x, y: droneStartPosDraft.y, z: program.drone.startPos.z || '0' },
              },
            },
      ),
    }))
    setHasUnsavedChanges(true)
    setDroneDialogOpen(false)
    message.success('无人机初始坐标已更新')
  }, [droneDialogMode, droneStartPosDraft, editingDroneId, handleCreateDrone, setHasUnsavedChanges, setResult])

  return {
    droneDialogMode,
    droneDialogOpen,
    droneStartPosDraft,
    setDroneStartPosDraft,
    setDroneDialogOpen,
    openCreateDroneDialog,
    openEditDroneDialog,
    handleConfirmDroneDialog,
  }
}

export default useDroneDialog
