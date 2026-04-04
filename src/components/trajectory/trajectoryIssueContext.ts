import type { ParseResult, ParsedBlock } from '../../types/fii'
import { normalizeRodConfig, type RodConfig } from './rodConfig'
import { buildTrajectoryIssues } from './trajectoryIssues'

export type TrajectoryIssueDetail = {
  key: string
  message: string
  blockId?: string
  blockIndex?: number
  blockType?: string
  blockFields?: Record<string, string>
}

export type DroneTrajectoryIssueDetails = {
  droneId: string
  droneName: string
  issueCount: number
  issues: TrajectoryIssueDetail[]
}

export type TrajectoryIssueContext = {
  schema: 'eazyfii.project.trajectoryIssues.v1'
  generatedAt: string
  summary: {
    droneCount: number
    dronesWithIssues: number
    totalIssues: number
  }
  drones: DroneTrajectoryIssueDetails[]
}

const findBlockById = (blocks: ParsedBlock[], blockId: string) => blocks.find((block) => block.id === blockId)

const toIssueDetail = (issue: { key: string; message: string; blockId?: string }, blocks: ParsedBlock[]): TrajectoryIssueDetail => {
  const detail: TrajectoryIssueDetail = {
    key: issue.key,
    message: issue.message,
    blockId: issue.blockId,
  }

  if (!issue.blockId) {
    return detail
  }

  const blockIndex = blocks.findIndex((block) => block.id === issue.blockId)
  if (blockIndex < 0) {
    return detail
  }

  const block = findBlockById(blocks, issue.blockId)
  if (!block) {
    return detail
  }

  detail.blockIndex = blockIndex + 1
  detail.blockType = block.type
  detail.blockFields = block.fields
  return detail
}

export const buildTrajectoryIssueContext = (
  projectContext: ParseResult,
  rodConfigInput: RodConfig | unknown,
): TrajectoryIssueContext => {
  const rodConfig = normalizeRodConfig(rodConfigInput)
  const drones = projectContext.programs.map((program) => {
    const issues = buildTrajectoryIssues(program.drone.startPos, program.blocks, rodConfig)
    const details = issues.map((issue) => toIssueDetail(issue, program.blocks))

    return {
      droneId: program.drone.id,
      droneName: program.drone.name,
      issueCount: details.length,
      issues: details,
    }
  })

  const dronesWithIssues = drones.filter((drone) => drone.issueCount > 0).length
  const totalIssues = drones.reduce((sum, drone) => sum + drone.issueCount, 0)

  return {
    schema: 'eazyfii.project.trajectoryIssues.v1',
    generatedAt: new Date().toISOString(),
    summary: {
      droneCount: drones.length,
      dronesWithIssues,
      totalIssues,
    },
    drones,
  }
}
