const LIST_PROJECT_DRONES_TOOL_NAME = 'ListProjectDrones'
const GET_DRONE_BLOCKS_TOOL_NAME = 'GetDroneBlocks'
const PATCH_DRONE_PROGRAM_TOOL_NAME = 'PatchDroneProgram'

let agentBlockIdSeq = 1

const compactDrone = (program) => ({
  droneId: program.drone.id,
  droneName: program.drone.name,
  actionGroup: program.drone.actionGroup,
  startPos: program.drone.startPos,
  blockCount: program.blocks.length,
})

const blockOutput = (block, index) => ({
  index: index + 1,
  id: block.id,
  type: block.type,
  fields: block.fields,
  comment: block.comment,
})

const cloneFields = (fields) => {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [String(key), String(value ?? '')]))
}

const normalizeProjectContext = (context) => {
  if (!context || typeof context !== 'object') {
    return null
  }
  const sourceName = typeof context.sourceName === 'string' ? context.sourceName : ''
  const warnings = Array.isArray(context.warnings) ? context.warnings.map((it) => String(it)) : []
  if (!Array.isArray(context.programs)) {
    return {
      sourceName,
      warnings,
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
          .map((block) => ({
            id: typeof block.id === 'string' ? block.id : '',
            type: typeof block.type === 'string' ? block.type : '',
            fields: cloneFields(block.fields),
            comment: typeof block.comment === 'string' ? block.comment : undefined,
          })),
      }
    })

  return {
    sourceName,
    warnings,
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

const matchDroneCandidates = (project, args) => {
  const droneId = typeof args.droneId === 'string' ? args.droneId.trim() : ''
  const droneName = typeof args.droneName === 'string' ? args.droneName.trim() : ''

  if (!droneId && !droneName) {
    return {
      error: '参数不足：请至少提供 droneId 或 droneName。',
      candidates: [],
      droneId,
      droneName,
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

const listProjectDrones = (projectContext) => {
  const project = normalizeProjectContext(projectContext)
  if (!project) {
    return { output: noProjectContextResult() }
  }

  return {
    output: stringify({
      ok: true,
      schema: 'eazyfii.project.drones.v1',
      project: {
        sourceName: project.sourceName,
        droneCount: project.programs.length,
      },
      drones: project.programs.map(compactDrone),
    }),
  }
}

const getDroneBlocks = (projectContext, rawArguments) => {
  const project = normalizeProjectContext(projectContext)
  if (!project) {
    return { output: noProjectContextResult() }
  }

  const args = parseObjectArgs(rawArguments)
  const { candidates, error, droneId, droneName } = matchDroneCandidates(project, args)
  if (error) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.droneBlocks.v1',
        error,
        hint: '示例参数: {"droneId":"drone_1"} 或 {"droneName":"无人机1"}',
        availableDrones: project.programs.map(compactDrone),
      }),
    }
  }

  if (!candidates.length) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.droneBlocks.v1',
        error: '未找到匹配的无人机。',
        query: { droneId, droneName },
        availableDrones: project.programs.map(compactDrone),
      }),
    }
  }

  if (candidates.length > 1) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.droneBlocks.v1',
        error: '匹配到多个无人机，请补充更精确的 droneId。',
        query: { droneId, droneName },
        candidates: candidates.map(compactDrone),
      }),
    }
  }

  const [target] = candidates
  return {
    output: stringify({
      ok: true,
      schema: 'eazyfii.project.droneBlocks.v1',
      project: {
        sourceName: project.sourceName,
      },
      drone: compactDrone(target),
      blocks: target.blocks.map(blockOutput),
    }),
  }
}

const buildBlock = (draft, usedIds) => {
  if (!draft || typeof draft !== 'object') {
    return { error: 'block 参数不是对象' }
  }
  const type = typeof draft.type === 'string' ? draft.type.trim() : ''
  if (!type) {
    return { error: 'block.type 不能为空' }
  }
  let id = typeof draft.id === 'string' ? draft.id.trim() : ''
  if (!id || usedIds.has(id)) {
    id = `agent_${Date.now().toString(36)}_${agentBlockIdSeq}`
    agentBlockIdSeq += 1
  }
  usedIds.add(id)
  return {
    block: {
      id,
      type,
      fields: cloneFields(draft.fields),
      comment: typeof draft.comment === 'string' ? draft.comment : undefined,
    },
  }
}

const indexById = (blocks, blockId) => blocks.findIndex((block) => block.id === blockId)

const patchDroneProgram = (projectContext, rawArguments) => {
  const project = normalizeProjectContext(projectContext)
  if (!project) {
    return { output: noProjectContextResult() }
  }

  const args = parseObjectArgs(rawArguments)
  const { candidates, error, droneId, droneName } = matchDroneCandidates(project, args)
  if (error || candidates.length !== 1) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.dronePatch.v1',
        error: error || (candidates.length === 0 ? '未找到匹配的无人机。' : '匹配到多个无人机，请改用 droneId。'),
        query: { droneId, droneName },
        availableDrones: project.programs.map(compactDrone),
      }),
    }
  }

  const operations = Array.isArray(args.operations) ? args.operations : []
  if (!operations.length) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.dronePatch.v1',
        error: 'operations 不能为空。',
        supportedOps: ['append_block', 'insert_after', 'update_fields', 'delete_block', 'move_block'],
      }),
    }
  }

  const targetProgram = candidates[0]
  const programIndex = project.programs.findIndex((it) => it.drone.id === targetProgram.drone.id)
  const nextBlocks = targetProgram.blocks.map((block) => ({ ...block, fields: { ...block.fields } }))
  const usedIds = new Set(nextBlocks.map((block) => block.id).filter(Boolean))
  const changes = []
  const errors = []

  operations.forEach((operation, opIndex) => {
    const indexLabel = opIndex + 1
    if (!operation || typeof operation !== 'object') {
      errors.push(`第 ${indexLabel} 项操作不是对象`)
      return
    }
    const op = typeof operation.op === 'string' ? operation.op : ''

    if (op === 'append_block') {
      const built = buildBlock(operation.block, usedIds)
      if (built.error) {
        errors.push(`第 ${indexLabel} 项 append_block 失败: ${built.error}`)
        return
      }
      nextBlocks.push(built.block)
      changes.push(`第 ${indexLabel} 项: 追加积木 ${built.block.id}`)
      return
    }

    if (op === 'insert_after') {
      const afterBlockId = typeof operation.afterBlockId === 'string' ? operation.afterBlockId.trim() : ''
      const afterIndex = indexById(nextBlocks, afterBlockId)
      if (!afterBlockId || afterIndex < 0) {
        errors.push(`第 ${indexLabel} 项 insert_after 失败: afterBlockId 无效`)
        return
      }
      const built = buildBlock(operation.block, usedIds)
      if (built.error) {
        errors.push(`第 ${indexLabel} 项 insert_after 失败: ${built.error}`)
        return
      }
      nextBlocks.splice(afterIndex + 1, 0, built.block)
      changes.push(`第 ${indexLabel} 项: 在 ${afterBlockId} 后插入 ${built.block.id}`)
      return
    }

    if (op === 'update_fields') {
      const blockId = typeof operation.blockId === 'string' ? operation.blockId.trim() : ''
      const at = indexById(nextBlocks, blockId)
      if (!blockId || at < 0) {
        errors.push(`第 ${indexLabel} 项 update_fields 失败: blockId 无效`)
        return
      }
      const patchFields = cloneFields(operation.fields)
      nextBlocks[at] = {
        ...nextBlocks[at],
        fields: {
          ...nextBlocks[at].fields,
          ...patchFields,
        },
      }
      if (typeof operation.comment === 'string') {
        nextBlocks[at].comment = operation.comment
      }
      changes.push(`第 ${indexLabel} 项: 更新积木 ${blockId} 字段 ${Object.keys(patchFields).join(', ') || '(无字段)'}`)
      return
    }

    if (op === 'delete_block') {
      const blockId = typeof operation.blockId === 'string' ? operation.blockId.trim() : ''
      const at = indexById(nextBlocks, blockId)
      if (!blockId || at < 0) {
        errors.push(`第 ${indexLabel} 项 delete_block 失败: blockId 无效`)
        return
      }
      nextBlocks.splice(at, 1)
      changes.push(`第 ${indexLabel} 项: 删除积木 ${blockId}`)
      return
    }

    if (op === 'move_block') {
      const blockId = typeof operation.blockId === 'string' ? operation.blockId.trim() : ''
      const toIndexRaw = Number(operation.toIndex)
      const from = indexById(nextBlocks, blockId)
      if (!blockId || from < 0 || !Number.isFinite(toIndexRaw)) {
        errors.push(`第 ${indexLabel} 项 move_block 失败: 参数无效`)
        return
      }
      const to = Math.max(0, Math.min(nextBlocks.length - 1, Math.floor(toIndexRaw) - 1))
      const [moving] = nextBlocks.splice(from, 1)
      nextBlocks.splice(to, 0, moving)
      changes.push(`第 ${indexLabel} 项: 移动积木 ${blockId} 到第 ${to + 1} 位`)
      return
    }

    errors.push(`第 ${indexLabel} 项操作不支持: ${op || '(空)'}`)
  })

  project.programs[programIndex] = {
    ...project.programs[programIndex],
    blocks: nextBlocks,
  }

  return {
    output: stringify({
      ok: errors.length === 0,
      schema: 'eazyfii.project.dronePatch.v1',
      drone: compactDrone({
        ...project.programs[programIndex],
        blocks: nextBlocks,
      }),
      summary: {
        requestedOps: operations.length,
        appliedOps: changes.length,
        failedOps: errors.length,
      },
      changes,
      errors,
      blocks: nextBlocks.map(blockOutput),
    }),
    nextProjectContext: project,
  }
}

const projectTool = (name, description, properties = {}) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
    },
  },
})

const projectToolForResponses = (name, description, properties = {}) => ({
  type: 'function',
  name,
  description,
  strict: false,
  parameters: {
    type: 'object',
    properties,
    required: [],
  },
})

export const PROJECT_TOOLS_CHAT = [
  projectTool(LIST_PROJECT_DRONES_TOOL_NAME, '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。'),
  projectTool(GET_DRONE_BLOCKS_TOOL_NAME, '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
  }),
  projectTool(PATCH_DRONE_PROGRAM_TOOL_NAME, '按差量操作编辑特定无人机程序并返回更新后的积木列表（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
    operations: {
      type: 'array',
      description: '差量操作数组。支持 append_block / insert_after / update_fields / delete_block / move_block。',
      items: { type: 'object' },
    },
  }),
]

export const PROJECT_TOOLS_RESPONSES = [
  projectToolForResponses(LIST_PROJECT_DRONES_TOOL_NAME, '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。'),
  projectToolForResponses(GET_DRONE_BLOCKS_TOOL_NAME, '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
  }),
  projectToolForResponses(PATCH_DRONE_PROGRAM_TOOL_NAME, '按差量操作编辑特定无人机程序并返回更新后的积木列表（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
    operations: {
      type: 'array',
      description: '差量操作数组。支持 append_block / insert_after / update_fields / delete_block / move_block。',
      items: { type: 'object' },
    },
  }),
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
  if (name === PATCH_DRONE_PROGRAM_TOOL_NAME) {
    return patchDroneProgram(projectContext, rawArguments)
  }
  return {
    output: stringify({
      ok: false,
      schema: 'eazyfii.project.error.v1',
      error: `不支持的工程工具: ${name}`,
    }),
  }
}

