const LIST_PROJECT_DRONES_TOOL_NAME = 'ListProjectDrones'
const GET_DRONE_BLOCKS_TOOL_NAME = 'GetDroneBlocks'

const compactDrone = (program) => ({
  droneId: program.drone.id,
  droneName: program.drone.name,
  actionGroup: program.drone.actionGroup,
  startPos: program.drone.startPos,
  blockCount: program.blocks.length,
})

const normalizeProjectContext = (context) => {
  if (!context || typeof context !== 'object') {
    return null
  }
  const sourceName = typeof context.sourceName === 'string' ? context.sourceName : ''
  if (!Array.isArray(context.programs)) {
    return {
      sourceName,
      programs: [],
    }
  }

  const programs = context.programs
    .filter((program) => program && typeof program === 'object')
    .map((program) => {
      const drone = program.drone && typeof program.drone === 'object'
        ? program.drone
        : {}
      const blocks = Array.isArray(program.blocks) ? program.blocks : []

      return {
        drone: {
          id: typeof drone.id === 'string' ? drone.id : '',
          name: typeof drone.name === 'string' ? drone.name : '',
          actionGroup: typeof drone.actionGroup === 'string' ? drone.actionGroup : '',
          startPos: drone.startPos && typeof drone.startPos === 'object'
            ? {
              x: String(drone.startPos.x ?? ''),
              y: String(drone.startPos.y ?? ''),
              z: String(drone.startPos.z ?? ''),
            }
            : { x: '', y: '', z: '' },
        },
        blocks: blocks
          .filter((block) => block && typeof block === 'object')
          .map((block, index) => ({
            index: index + 1,
            id: typeof block.id === 'string' ? block.id : '',
            type: typeof block.type === 'string' ? block.type : '',
            fields: block.fields && typeof block.fields === 'object' ? block.fields : {},
            comment: typeof block.comment === 'string' ? block.comment : undefined,
          })),
      }
    })

  return {
    sourceName,
    programs,
  }
}

const parseObjectArgs = (rawArguments) => {
  if (typeof rawArguments !== 'string' || rawArguments.trim() === '') {
    return {}
  }
  try {
    const parsed = JSON.parse(rawArguments)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

const stringify = (value) => JSON.stringify(value, null, 2)

const noProjectContextResult = () => stringify({
  ok: false,
  schema: 'eazyfii.project.error.v1',
  error: '未找到当前工程上下文。请先在 EazyFii 中打开项目，再调用此工具。',
})

const listProjectDrones = (projectContext) => {
  const project = normalizeProjectContext(projectContext)
  if (!project) {
    return noProjectContextResult()
  }

  return stringify({
    ok: true,
    schema: 'eazyfii.project.drones.v1',
    project: {
      sourceName: project.sourceName,
      droneCount: project.programs.length,
    },
    drones: project.programs.map(compactDrone),
  })
}

const matchDroneCandidates = (project, args) => {
  const droneId = typeof args.droneId === 'string' ? args.droneId.trim() : ''
  const droneName = typeof args.droneName === 'string' ? args.droneName.trim() : ''

  if (!droneId && !droneName) {
    return {
      error: '参数不足：请至少提供 droneId 或 droneName。',
      candidates: [],
    }
  }

  const candidates = project.programs.filter((program) => {
    if (droneId && program.drone.id !== droneId) {
      return false
    }
    if (droneName && program.drone.name !== droneName) {
      return false
    }
    return true
  })

  return { candidates, droneId, droneName }
}

const getDroneBlocks = (projectContext, rawArguments) => {
  const project = normalizeProjectContext(projectContext)
  if (!project) {
    return noProjectContextResult()
  }

  const args = parseObjectArgs(rawArguments)
  const { candidates, error, droneId, droneName } = matchDroneCandidates(project, args)
  if (error) {
    return stringify({
      ok: false,
      schema: 'eazyfii.project.droneBlocks.v1',
      error,
      hint: '示例参数: {"droneId":"drone_1"} 或 {"droneName":"无人机1"}',
      availableDrones: project.programs.map(compactDrone),
    })
  }

  if (!candidates.length) {
    return stringify({
      ok: false,
      schema: 'eazyfii.project.droneBlocks.v1',
      error: '未找到匹配的无人机。',
      query: { droneId, droneName },
      availableDrones: project.programs.map(compactDrone),
    })
  }

  if (candidates.length > 1) {
    return stringify({
      ok: false,
      schema: 'eazyfii.project.droneBlocks.v1',
      error: '匹配到多个无人机，请补充更精确的 droneId。',
      query: { droneId, droneName },
      candidates: candidates.map(compactDrone),
    })
  }

  const [target] = candidates
  return stringify({
    ok: true,
    schema: 'eazyfii.project.droneBlocks.v1',
    project: {
      sourceName: project.sourceName,
    },
    drone: compactDrone(target),
    blocks: target.blocks,
  })
}

export const PROJECT_TOOLS_CHAT = [
  {
    type: 'function',
    function: {
      name: LIST_PROJECT_DRONES_TOOL_NAME,
      description: '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: GET_DRONE_BLOCKS_TOOL_NAME,
      description: '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。',
      parameters: {
        type: 'object',
        properties: {
          droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
          droneName: { type: 'string', description: '无人机名称（可能重复）。' },
        },
      },
    },
  },
]

export const PROJECT_TOOLS_RESPONSES = [
  {
    type: 'function',
    name: LIST_PROJECT_DRONES_TOOL_NAME,
    description: '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。',
    strict: false,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: GET_DRONE_BLOCKS_TOOL_NAME,
    description: '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
        droneName: { type: 'string', description: '无人机名称（可能重复）。' },
      },
      required: [],
    },
  },
]

export const executeProjectToolCall = ({
  name,
  rawArguments,
  projectContext,
}) => {
  if (name === LIST_PROJECT_DRONES_TOOL_NAME) {
    return listProjectDrones(projectContext)
  }
  if (name === GET_DRONE_BLOCKS_TOOL_NAME) {
    return getDroneBlocks(projectContext, rawArguments)
  }
  return stringify({
    ok: false,
    schema: 'eazyfii.project.error.v1',
    error: `不支持的工程工具: ${name}`,
  })
}

