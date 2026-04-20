import { useCallback } from 'react'
import { message } from 'antd'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { ParseResult } from '../types/fii'
import { parseFiiFromFiles } from '../utils/fiiParser'
import { applySavedEdits, saveResultEdits } from '../utils/blockEditsStorage'
import { isDesktopRuntime, isElectronShell, updateAgentProjectContext } from '../utils/desktopBridge'
import { openDomDirectoryPicker } from '../utils/domFilePicker'
import { openDesktopProject, saveDesktopProject } from '../utils/desktopProjectIO'
import { normalizeResultForSave } from '../utils/saveValidation'
import {
  LOCAL_DRAFT_SOURCE_NAME,
  saveLocalDraftPrograms,
} from '../utils/localDraftStorage'

type UseProjectFileIOOptions = {
  result: ParseResult
  desktopProjectDirectory?: string
  directoryPickerRef: RefObject<HTMLInputElement | null>
  setResult: Dispatch<SetStateAction<ParseResult>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setDesktopProjectDirectory: Dispatch<SetStateAction<string | undefined>>
  setSelectedDroneId: Dispatch<SetStateAction<string | undefined>>
  setHighlightedBlockId: Dispatch<SetStateAction<string | undefined>>
  setSelectedBlockId: Dispatch<SetStateAction<string | undefined>>
  setHighlightPulse: Dispatch<SetStateAction<number>>
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>
}

export const useProjectFileIO = ({
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
}: UseProjectFileIOOptions) => {
  const handleParseFiles = useCallback(async (list: FileList | null) => {
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
        message.error(
          '所选路径未找到 .fii 文件，未更新当前程序。请重新选择包含 .fii 的目录。',
        )
        return
      }
      const merged = applySavedEdits(parsed)
      setResult(merged)
      setDesktopProjectDirectory(undefined)
      setSelectedDroneId(merged.programs[0]?.drone.id)
      setHighlightedBlockId(undefined)
      setSelectedBlockId(undefined)
      setHighlightPulse(0)
      setHasUnsavedChanges(false)
      await updateAgentProjectContext(merged)
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
  }, [
    setHighlightPulse,
    setDesktopProjectDirectory,
    setHasUnsavedChanges,
    setHighlightedBlockId,
    setLoading,
    setResult,
    setSelectedBlockId,
    setSelectedDroneId,
  ])

  const handleOpenDirectory = useCallback(async () => {
    if (isDesktopRuntime()) {
      setLoading(true)
      try {
        const openResult = await openDesktopProject()
        if (!openResult) {
          return
        }

        const merged = applySavedEdits(openResult.parseResult)
        if (!merged.sourceName) {
          console.warn('[fii] parse skipped: no .fii source found in selected files', {
            warnings: merged.warnings,
          })
          message.error(
            '所选路径未找到 .fii 文件，未更新当前程序。请重新选择包含 .fii 的目录。',
          )
          return
        }

        setResult(merged)
        setDesktopProjectDirectory(openResult.directoryPath)
        setSelectedDroneId(merged.programs[0]?.drone.id)
        setHighlightedBlockId(undefined)
        setSelectedBlockId(undefined)
        setHighlightPulse(0)
        setHasUnsavedChanges(false)
        await updateAgentProjectContext(merged)
        if (merged.warnings.length) {
          message.warning(`读取完成，存在 ${merged.warnings.length} 条提示`)
        } else {
          message.success('文件读取成功')
        }
      } catch {
        message.error('文件解析失败，请确认目录内容和 XML 格式是否正确')
      } finally {
        setLoading(false)
      }
      return
    }

    openDomDirectoryPicker(directoryPickerRef)
  }, [
    directoryPickerRef,
    setDesktopProjectDirectory,
    setHasUnsavedChanges,
    setHighlightPulse,
    setHighlightedBlockId,
    setLoading,
    setResult,
    setSelectedBlockId,
    setSelectedDroneId,
  ])

  const handleSaveEdits = useCallback(async () => {
    const normalizedResult = normalizeResultForSave(result)
    if (normalizedResult !== result) {
      setResult(normalizedResult)
    }

    if (isDesktopRuntime()) {
      try {
        const saveResult = await saveDesktopProject(normalizedResult, desktopProjectDirectory)
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
    if (!normalizedResult.sourceName || normalizedResult.sourceName === LOCAL_DRAFT_SOURCE_NAME) {
      console.info('[fii] save blocked: source path is not bound', {
        sourceName: normalizedResult.sourceName,
      })
      message.warning(
        '当前仅保存到浏览器本地草稿。请先通过“选择文件夹/文件”加载含 .fii 的工程后再保存。',
      )
      return
    }

    saveResultEdits(normalizedResult.sourceName, normalizedResult.programs)
    saveLocalDraftPrograms(normalizedResult.programs)
    setHasUnsavedChanges(false)
    message.success('已保存到本地')
  }, [
    desktopProjectDirectory,
    result,
    setDesktopProjectDirectory,
    setHasUnsavedChanges,
    setResult,
  ])

  return {
    handleParseFiles,
    handleOpenDirectory,
    handleSaveEdits,
  }
}
