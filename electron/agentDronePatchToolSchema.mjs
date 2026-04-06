const PATCH_DRONE_OPS = [
  'append_block',
  'insert_after',
  'insert',
  'insert_blocks_at',
  'replace_range',
  'update_fields',
  'delete_block',
  'move_block',
]

const BLOCK_DRAFT_PROPERTIES = {
  id: { type: 'string', description: '可选。新积木 id；留空会自动生成。' },
  type: { type: 'string', description: '必填。积木类型，例如 EazyFii_MoveToCoordAutoDelay。' },
  fields: { type: 'object', description: '可选。字段键值对，值应为字符串。' },
  comment: { type: 'string', description: '可选。积木注释。' },
}

export const PATCH_DRONE_PROGRAM_PROPERTIES = {
  droneId: { type: 'string', description: '无人机唯一 id。推荐只传该字段进行精确匹配。' },
  droneName: { type: 'string', description: '无人机名称（可能重名）。仅在已确认唯一时使用。' },
  operations: {
    type: 'array',
    minItems: 1,
    description: [
      '必填。差量操作数组，按顺序执行。',
      'index/startIndex/endIndex/toIndex 均为 1-based。',
      'op 必须是: append_block / insert_after / insert / insert_blocks_at / replace_range / update_fields / delete_block / move_block。',
      '各 op 必填字段：',
      '- append_block: block',
      '- insert_after: afterBlockId + block',
      '- insert: index + block',
      '- insert_blocks_at: index + blocks(非空数组)',
      '- replace_range: startIndex + endIndex + blocks(非空数组)',
      '- update_fields: blockId + fields',
      '- delete_block: blockId',
      '- move_block: blockId + toIndex',
    ].join('\n'),
    items: {
      type: 'object',
      required: ['op'],
      additionalProperties: false,
      properties: {
        op: { type: 'string', enum: PATCH_DRONE_OPS, description: '操作类型。' },
        block: { type: 'object', properties: BLOCK_DRAFT_PROPERTIES, description: '单个积木草稿。' },
        blocks: {
          type: 'array',
          minItems: 1,
          description: '多个积木草稿（连续插入/替换时使用）。',
          items: { type: 'object', properties: BLOCK_DRAFT_PROPERTIES },
        },
        afterBlockId: { type: 'string', description: 'insert_after 使用：在该积木后插入。' },
        index: { type: 'integer', description: 'insert / insert_blocks_at 使用：目标位置（1-based）。' },
        startIndex: { type: 'integer', description: 'replace_range 使用：起始位置（1-based，含）。' },
        endIndex: { type: 'integer', description: 'replace_range 使用：结束位置（1-based，含）。' },
        blockId: { type: 'string', description: 'update_fields / delete_block / move_block 使用：目标积木 id。' },
        fields: { type: 'object', description: 'update_fields 使用：要更新的字段键值对。' },
        toIndex: { type: 'integer', description: 'move_block 使用：移动后的目标位置（1-based）。' },
        comment: { type: 'string', description: 'update_fields 使用：可选，更新该积木 comment。' },
      },
    },
  },
}
