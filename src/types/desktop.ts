import type { SerializedProjectFile } from '../utils/fiiSerializer'
import type {
  AgentChatPayload,
  AgentChatResult,
  AgentEnvResult,
  AgentSetEnvPayload,
  AgentStreamEvent,
  AgentStatusResult,
} from './agent'

export type DesktopTextFile = {
  name: string
  relativePath: string
  text: string
}

export type DesktopOpenResult = {
  directoryPath: string
  files: DesktopTextFile[]
}

export type DesktopWritePayload = {
  directoryPath: string
  files: SerializedProjectFile[]
}

export type DesktopWriteResult = {
  writtenCount: number
}

export type DesktopReadTextFilePayload = {
  directoryPath: string
  relativePath: string
}

export type DesktopReadTextFileResult = {
  content: string | null
}

export type DesktopWriteTextFilePayload = {
  directoryPath: string
  relativePath: string
  content: string
}

export type DesktopWriteTextFileResult = {
  written: boolean
}

export type DesktopAgentChatPayload = AgentChatPayload
export type DesktopAgentChatResult = AgentChatResult
export type DesktopAgentStatusResult = AgentStatusResult
export type DesktopAgentSetEnvPayload = AgentSetEnvPayload
export type DesktopAgentEnvResult = AgentEnvResult
export type DesktopAgentStreamEvent = AgentStreamEvent
export type DesktopAgentStopResult = { ok: true } | { ok: false; error: string }

export type DesktopTrajectoryIssuesRequestPayload = {
  token: string
}

export type DesktopTrajectoryIssuesResponsePayload = {
  token: string
  trajectoryIssueContext?: unknown
}

export type DesktopTerminalCreatePayload = {
  id: string
  cols: number
  rows: number
}

export type DesktopTerminalWritePayload = {
  id: string
  data: string
}

export type DesktopTerminalResizePayload = {
  id: string
  cols: number
  rows: number
}

export type DesktopTerminalDestroyPayload = {
  id: string
}

export type DesktopTerminalDataEvent = {
  id: string
  data: string
}

export type DesktopTerminalExitEvent = {
  id: string
  exitCode: number
}

export type DesktopTerminalResult = { ok: true } | { ok: false; error: string }

export type DesktopUpdateAgentProjectContextResult = { ok: true } | { ok: false; error: string }
