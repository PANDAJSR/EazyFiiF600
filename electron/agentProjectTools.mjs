import {
  PATCH_DRONE_PROGRAM_PROPERTIES,
  PATCH_DRONE_PROGRAM_TOOL_NAME,
  patchDroneProgram,
} from './agentDronePatchTool.mjs'

const LIST_PROJECT_DRONES_TOOL_NAME = 'ListProjectDrones'
const GET_DRONE_BLOCKS_TOOL_NAME = 'GetDroneBlocks'
const GET_ROD_CONFIG_TOOL_NAME = 'GetRodConfig'
const GET_BLOCK_CATALOG_TOOL_NAME = 'GetBlockCatalog'
const GET_TRAJECTORY_ISSUES_DETAILED_TOOL_NAME = 'GetTrajectoryIssuesDetailed'

const BLOCK_CATALOG_SNAPSHOT = {
  schema: 'eazyfii.project.blockCatalog.v1',
  blocks: [
    { type: 'block_inittime', label: '在时间开始', fields: { time: '00:00' }, keywords: ['时间', '开始', 'init', 'time'] },
    { type: 'Goertek_HorizontalSpeed', label: '水平速度', fields: { VH: '60', AH: '100' }, keywords: ['水平', '速度', 'vh', 'ah'] },
    { type: 'Goertek_VerticalSpeed', label: '垂直速度', fields: { VV: '60', AV: '100' }, keywords: ['垂直', '速度', 'vv', 'av'] },
    { type: 'Goertek_UnLock', label: '解锁', fields: {}, keywords: ['解锁', 'unlock'] },
    { type: 'block_delay', label: '延时', fields: { time: '500' }, keywords: ['延时', '等待', 'delay', 'time'] },
    { type: 'Goertek_TakeOff2', label: '起飞', fields: { alt: '100' }, keywords: ['起飞', 'takeoff', 'alt'] },
    {
      type: 'EazyFii_MoveToCoordAutoDelay',
      label: '智能平移',
      fields: { X: '0', Y: '0', Z: '100', time: '800' },
      keywords: ['平移', '自动延时', 'move', 'auto', 'delay', 'x', 'y', 'z'],
    },
    { type: 'Goertek_MoveToCoord2', label: '平移到（异步）', fields: { X: '0', Y: '0', Z: '100' }, keywords: ['平移', '坐标', 'move to', 'x', 'y', 'z'] },
    { type: 'Goertek_Move', label: '相对平移（异步）', fields: { X: '0', Y: '0', Z: '0' }, keywords: ['相对', '平移', 'move', 'x', 'y', 'z'] },
    { type: 'Goertek_Turn', label: '转动（异步）', fields: { turnDirection: 'r', angle: '90' }, keywords: ['转向', '转动', 'turn', 'angle'] },
    {
      type: 'Goertek_LEDTurnOnAllSingleColor4',
      label: '设置电机灯光',
      fields: { motor: '1', color1: '#ffffff' },
      keywords: ['灯光', 'led', '颜色', '电机'],
    },
    {
      type: 'Goertek_LEDTurnOnAllSingleColor2',
      label: '设置全部灯光颜色',
      fields: { color1: '#ffffff' },
      keywords: ['灯光', 'led', '颜色', '全部'],
    },
    { type: 'Goertek_Land', label: '降落', fields: {}, keywords: ['降落', 'land'] },
  ],
  constraints: [
    '默认优先使用 EazyFii_MoveToCoordAutoDelay，不要默认使用 Goertek_MoveToCoord2。',
    '禁止使用 Goertek_MoveToCoord（当前工程不识别）。',
    'Goertek_MoveToCoord2 与 EazyFii_MoveToCoordAutoDelay 的 X/Y/Z 建议范围: X[0,400], Y[0,400], Z[100,300]。',
    '仅使用工具返回的 fields 键名，不要自行改写键名大小写。',
  ],
}

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
    return { sourceName, warnings, programs: [] }
  }

  const programs = context.programs
    .filter((program) => program && typeof program === 'object')
    .map((program) => {
      const drone = program.drone && typeof program.drone === 'object' ? program.drone : {}
      const blocks = Array.isArray(program.blocks) ? program.blocks : []
      return {
        drone: {
          id: typeof drone.id === 'string' ? drone.id : '',
          name: typeof drone.name === 'string' ? drone.name : '',
          actionGroup: typeof drone.actionGroup === 'string' ? drone.actionGroup : '',
          startPos: drone.startPos && typeof drone.startPos === 'object'
            ? { x: String(drone.startPos.x ?? ''), y: String(drone.startPos.y ?? ''), z: String(drone.startPos.z ?? '') }
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

  return { sourceName, warnings, programs }
}

const toFiniteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

const normalizeRodPoint = (value) => {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return {
    x: toFiniteNumber(value.x),
    y: toFiniteNumber(value.y),
  }
}

const normalizeRodConfigSnapshot = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const subjectIds = [
    'subject1',
    'subject2',
    'subject3',
    'subject4',
    'subject5',
    'subject6',
    'subject7',
    'subject8',
    'subject9',
    'subject10',
  ]
  const next = {
    takeoffZone: Array.from({ length: 4 }, (_, i) => normalizeRodPoint(value.takeoffZone?.[i])),
    subject3Ring: {
      centerHeight: toFiniteNumber(value.subject3Ring?.centerHeight),
    },
    subject9Config: {
      secondCrossbarHeight: toFiniteNumber(value.subject9Config?.secondCrossbarHeight),
    },
  }
  for (const subjectId of subjectIds) {
    const list = Array.isArray(value[subjectId]) ? value[subjectId] : []
    next[subjectId] = list.map((point) => normalizeRodPoint(point))
  }
  return next
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
    return { error: '参数不足：请至少提供 droneId 或 droneName。', candidates: [], droneId, droneName }
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
      project: { sourceName: project.sourceName, droneCount: project.programs.length },
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
      project: { sourceName: project.sourceName },
      drone: compactDrone(target),
      blocks: target.blocks.map(blockOutput),
    }),
  }
}

const getRodConfig = (projectContext) => {
  const rodConfig = normalizeRodConfigSnapshot(projectContext?.rodConfig)
  if (!rodConfig) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.rodConfig.v1',
        error: '未找到杆子配置。请先在“杆子配置”面板填写或加载配置。',
      }),
    }
  }
  return {
    output: stringify({
      ok: true,
      schema: 'eazyfii.project.rodConfig.v1',
      rodConfig,
      notes: [
        '坐标单位为厘米平面坐标（X/Y）。',
        'subject3Ring.centerHeight 为科目三圈中心离地高度（cm）。',
        'subject9Config.secondCrossbarHeight 为科目九第二横杆离地高度（cm）。',
      ],
    }),
  }
}

const getBlockCatalog = () => {
  return {
    output: stringify({
      ok: true,
      ...BLOCK_CATALOG_SNAPSHOT,
    }),
  }
}

const getTrajectoryIssuesDetailed = (projectContext) => {
  const issuesContext = projectContext?.trajectoryIssueContext
  if (!issuesContext || typeof issuesContext !== 'object') {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.trajectoryIssues.v1',
        error: '未找到问题详情。请在轨迹面板加载项目后再重试。',
      }),
    }
  }
  return {
    output: stringify({
      ok: true,
      ...issuesContext,
    }),
  }
}

const projectTool = (name, description, properties = {}) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties } },
})

const projectToolForResponses = (name, description, properties = {}) => ({
  type: 'function',
  name,
  description,
  strict: false,
  parameters: { type: 'object', properties, required: [] },
})

export const PROJECT_TOOLS_CHAT = [
  projectTool(LIST_PROJECT_DRONES_TOOL_NAME, '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。'),
  projectTool(GET_DRONE_BLOCKS_TOOL_NAME, '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
  }),
  projectTool(GET_ROD_CONFIG_TOOL_NAME, '读取当前工程的杆子配置（坐标/高度等，JSON 输出）。'),
  projectTool(GET_BLOCK_CATALOG_TOOL_NAME, '读取当前工程支持的积木类型、参数键名、默认值与约束（JSON 输出）。'),
  projectTool(GET_TRAJECTORY_ISSUES_DETAILED_TOOL_NAME, '读取当前工程所有无人机的“问题”详细信息（JSON 输出，含问题与积木定位）。'),
  projectTool(PATCH_DRONE_PROGRAM_TOOL_NAME, '按差量操作编辑特定无人机程序并返回更新后的积木列表（JSON 输出）。', PATCH_DRONE_PROGRAM_PROPERTIES),
]

export const PROJECT_TOOLS_RESPONSES = [
  projectToolForResponses(LIST_PROJECT_DRONES_TOOL_NAME, '读取当前 EazyFii 已打开工程中的无人机列表（JSON 输出）。'),
  projectToolForResponses(GET_DRONE_BLOCKS_TOOL_NAME, '按无人机 id 或名称读取该无人机的全部积木块（JSON 输出）。', {
    droneId: { type: 'string', description: '无人机唯一 id，优先推荐。' },
    droneName: { type: 'string', description: '无人机名称（可能重复）。' },
  }),
  projectToolForResponses(GET_ROD_CONFIG_TOOL_NAME, '读取当前工程的杆子配置（坐标/高度等，JSON 输出）。'),
  projectToolForResponses(GET_BLOCK_CATALOG_TOOL_NAME, '读取当前工程支持的积木类型、参数键名、默认值与约束（JSON 输出）。'),
  projectToolForResponses(GET_TRAJECTORY_ISSUES_DETAILED_TOOL_NAME, '读取当前工程所有无人机的“问题”详细信息（JSON 输出，含问题与积木定位）。'),
  projectToolForResponses(PATCH_DRONE_PROGRAM_TOOL_NAME, '按差量操作编辑特定无人机程序并返回更新后的积木列表（JSON 输出）。', PATCH_DRONE_PROGRAM_PROPERTIES),
]

export const executeProjectToolCall = ({ name, rawArguments, projectContext }) => {
  if (name === LIST_PROJECT_DRONES_TOOL_NAME) {
    return listProjectDrones(projectContext)
  }
  if (name === GET_DRONE_BLOCKS_TOOL_NAME) {
    return getDroneBlocks(projectContext, rawArguments)
  }
  if (name === GET_ROD_CONFIG_TOOL_NAME) {
    return getRodConfig(projectContext)
  }
  if (name === GET_BLOCK_CATALOG_TOOL_NAME) {
    return getBlockCatalog()
  }
  if (name === GET_TRAJECTORY_ISSUES_DETAILED_TOOL_NAME) {
    return getTrajectoryIssuesDetailed(projectContext)
  }
  if (name === PATCH_DRONE_PROGRAM_TOOL_NAME) {
    const project = normalizeProjectContext(projectContext)
    if (!project) {
      return { output: noProjectContextResult() }
    }
    const args = parseObjectArgs(rawArguments)
    const matched = matchDroneCandidates(project, args)
    if (matched.error) {
      return {
        output: stringify({
          ok: false,
          schema: 'eazyfii.project.dronePatch.v1',
          error: matched.error,
          query: { droneId: matched.droneId, droneName: matched.droneName },
          availableDrones: project.programs.map(compactDrone),
        }),
      }
    }
    const patchResult = patchDroneProgram({
      project,
      rawArguments,
      droneId: matched.droneId,
      droneName: matched.droneName,
      candidates: matched.candidates,
    })
    if (patchResult?.nextProjectContext && projectContext && typeof projectContext === 'object') {
      patchResult.nextProjectContext = {
        ...patchResult.nextProjectContext,
        rodConfig: projectContext.rodConfig,
        trajectoryIssueContext: projectContext.trajectoryIssueContext,
      }
    }
    return patchResult
  }
  return {
    output: stringify({
      ok: false,
      schema: 'eazyfii.project.error.v1',
      error: `不支持的工程工具: ${name}`,
    }),
  }
}
