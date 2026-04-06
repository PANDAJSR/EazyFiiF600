import { PATCH_DRONE_PROGRAM_PROPERTIES } from './agentDronePatchToolSchema.mjs'

let agentBlockIdSeq = 1

const blockOutput = (block, index) => ({
  index: index + 1,
  id: block.id,
  type: block.type,
  fields: block.fields,
  comment: block.comment,
})

const compactDrone = (program) => ({
  droneId: program.drone.id,
  droneName: program.drone.name,
  actionGroup: program.drone.actionGroup,
  startPos: program.drone.startPos,
  blockCount: program.blocks.length,
})

const cloneFields = (fields) => {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [String(key), String(value ?? '')]))
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

const buildBlockList = (drafts, usedIds) => {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return { error: 'blocks 不能为空数组' }
  }
  const blocks = []
  for (const draft of drafts) {
    const built = buildBlock(draft, usedIds)
    if (built.error) {
      return { error: built.error }
    }
    blocks.push(built.block)
  }
  return { blocks }
}

const indexById = (blocks, blockId) => blocks.findIndex((block) => block.id === blockId)

const toInsertPosition = (index, total) => {
  const n = Number(index)
  if (!Number.isFinite(n)) {
    return null
  }
  const asInt = Math.floor(n)
  if (asInt <= 0) {
    return 0
  }
  return Math.min(total, asInt - 1)
}

const toRange = (startIndex, endIndex, total) => {
  const startRaw = Number(startIndex)
  const endRaw = Number(endIndex)
  if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw)) {
    return null
  }
  const start = Math.max(1, Math.floor(startRaw))
  const end = Math.max(start, Math.floor(endRaw))
  if (start > total) {
    return null
  }
  return {
    start: start - 1,
    deleteCount: Math.min(total, end) - start + 1,
  }
}

const applyPatchOperation = ({ operation, indexLabel, nextBlocks, usedIds, changes, errors }) => {
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

  if (op === 'insert') {
    const built = buildBlock(operation.block, usedIds)
    if (built.error) {
      errors.push(`第 ${indexLabel} 项 insert 失败: ${built.error}`)
      return
    }
    const at = toInsertPosition(operation.index, nextBlocks.length)
    if (at === null) {
      errors.push(`第 ${indexLabel} 项 insert 失败: index 无效`)
      return
    }
    nextBlocks.splice(at, 0, built.block)
    changes.push(`第 ${indexLabel} 项: 在第 ${at + 1} 位插入 ${built.block.id}`)
    return
  }

  if (op === 'insert_blocks_at') {
    const at = toInsertPosition(operation.index, nextBlocks.length)
    if (at === null) {
      errors.push(`第 ${indexLabel} 项 insert_blocks_at 失败: index 无效`)
      return
    }
    const builtList = buildBlockList(operation.blocks, usedIds)
    if (builtList.error) {
      errors.push(`第 ${indexLabel} 项 insert_blocks_at 失败: ${builtList.error}`)
      return
    }
    nextBlocks.splice(at, 0, ...builtList.blocks)
    changes.push(`第 ${indexLabel} 项: 在第 ${at + 1} 位插入连续积木 ${builtList.blocks.length} 个`)
    return
  }

  if (op === 'replace_range') {
    const range = toRange(operation.startIndex, operation.endIndex, nextBlocks.length)
    if (!range) {
      errors.push(`第 ${indexLabel} 项 replace_range 失败: startIndex/endIndex 无效`)
      return
    }
    const builtList = buildBlockList(operation.blocks, usedIds)
    if (builtList.error) {
      errors.push(`第 ${indexLabel} 项 replace_range 失败: ${builtList.error}`)
      return
    }
    nextBlocks.splice(range.start, range.deleteCount, ...builtList.blocks)
    changes.push(
      `第 ${indexLabel} 项: 替换第 ${range.start + 1}~${range.start + range.deleteCount} 个积木为 ${builtList.blocks.length} 个连续积木`,
    )
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
}

const normalizeInsertOrder = (operations) => {
  if (!Array.isArray(operations) || operations.length < 2) {
    return operations
  }

  const normalized = []
  let cursor = 0

  while (cursor < operations.length) {
    const current = operations[cursor]
    if (!current || typeof current !== 'object' || current.op !== 'insert') {
      normalized.push(current)
      cursor += 1
      continue
    }

    const startIndex = Number(current.index)
    if (!Number.isFinite(startIndex)) {
      normalized.push(current)
      cursor += 1
      continue
    }

    const batch = [current]
    let nextCursor = cursor + 1
    while (nextCursor < operations.length) {
      const next = operations[nextCursor]
      if (!next || typeof next !== 'object' || next.op !== 'insert') {
        break
      }
      const nextIndex = Number(next.index)
      if (!Number.isFinite(nextIndex) || Math.floor(nextIndex) !== Math.floor(startIndex)) {
        break
      }
      batch.push(next)
      nextCursor += 1
    }

    if (batch.length === 1) {
      normalized.push(current)
      cursor = nextCursor
      continue
    }

    // Preserve the model-declared order when multiple inserts target the same index.
    batch.forEach((item, offset) => {
      normalized.push({
        ...item,
        index: Math.floor(startIndex) + offset,
      })
    })
    cursor = nextCursor
  }

  return normalized
}

export const PATCH_DRONE_PROGRAM_TOOL_NAME = 'PatchDroneProgram'
export { PATCH_DRONE_PROGRAM_PROPERTIES }

export const patchDroneProgram = ({ project, rawArguments, droneId, droneName, candidates }) => {
  if (candidates.length !== 1) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.dronePatch.v1',
        error: candidates.length === 0 ? '未找到匹配的无人机。' : '匹配到多个无人机，请改用 droneId。',
        query: { droneId, droneName },
        availableDrones: project.programs.map(compactDrone),
      }),
    }
  }

  const targetProgram = candidates[0]
  const args = parseObjectArgs(rawArguments)
  const rawOperations = Array.isArray(args.operations) ? args.operations : []
  const operations = normalizeInsertOrder(rawOperations)
  if (!operations.length) {
    return {
      output: stringify({
        ok: false,
        schema: 'eazyfii.project.dronePatch.v1',
        error: 'operations 不能为空。',
        mustRetry: true,
        retryGuide: '请先调用 GetDroneBlocks 获取当前积木，再基于用户目标构造 operations 后重新调用 PatchDroneProgram。',
        supportedOps: [
          'append_block',
          'insert_after',
          'insert',
          'insert_blocks_at',
          'replace_range',
          'update_fields',
          'delete_block',
          'move_block',
        ],
        example: {
          droneId: droneId || targetProgram.drone.id,
          operations: [
            {
              op: 'replace_range',
              startIndex: 8,
              endIndex: 12,
              blocks: [
                { type: 'EazyFii_MoveToCoordAutoDelay', fields: { X: '120', Y: '120', Z: '100', time: '1200' } },
                { type: 'Goertek_Turn', fields: { turnDirection: 'r', angle: '90' } },
              ],
            },
          ],
        },
      }),
    }
  }

  const programIndex = project.programs.findIndex((it) => it.drone.id === targetProgram.drone.id)
  const nextBlocks = targetProgram.blocks.map((block) => ({ ...block, fields: { ...block.fields } }))
  const usedIds = new Set(nextBlocks.map((block) => block.id).filter(Boolean))
  const changes = []
  const errors = []

  operations.forEach((operation, opIndex) => {
    applyPatchOperation({ operation, indexLabel: opIndex + 1, nextBlocks, usedIds, changes, errors })
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
      mustRetry: errors.length > 0,
      changes,
      errors,
      blocks: nextBlocks.map(blockOutput),
    }),
    nextProjectContext: project,
  }
}
