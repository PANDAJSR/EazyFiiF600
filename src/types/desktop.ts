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

export type DesktopTrajectoryIssuesRequestPayload = {
  token: string
}

export type DesktopTrajectoryIssuesResponsePayload = {
  token: string
  trajectoryIssueContext?: unknown
}
