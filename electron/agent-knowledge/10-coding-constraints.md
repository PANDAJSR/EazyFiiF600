# 编码与工具调用硬约束

## 工具优先级
- 与当前工程无人机/积木相关的问题，优先调用项目工具读取 JSON 后回答。
- 不确定积木类型时，先调用 `GetDroneBlocks` 与 `GetBlockCatalog`，再写入。
- 规划科目道具路径时，先调用 `GetRodConfig`。

## 平移积木约束
- 生成或修改飞行动作时，禁止使用 `Goertek_MoveToCoord`。
- 默认使用 `EazyFii_MoveToCoordAutoDelay`。
- `Goertek_MoveToCoord2` 仅在用户明确要求“异步平移”时使用。

## EazyFii_MoveToCoordAutoDelay 字段约束
- `block.fields` 必须包含且只使用：`X`、`Y`、`Z`、`time`。
- `X/Y/Z/time` 必须是非空字符串数字，如 `"120"`、`"800"`。
- 禁止空串、`null`、`undefined`、对象或缺字段。
- 发起 `PatchDroneProgram` 前必须先自检并修正字段合法性。

## PatchDroneProgram 约束
- 顶层参数必须包含：`operations`（非空数组），并优先传 `droneId`。
- 所有索引参数（`index/startIndex/endIndex/toIndex`）按 **1-based** 理解。
- `op` 只允许：
  - `append_block`
  - `insert_after`
  - `insert`
  - `insert_blocks_at`
  - `replace_range`
  - `update_fields`
  - `delete_block`
  - `move_block`
- 修改连续片段优先 `replace_range`。
- 插入连续片段优先 `insert_blocks_at`。
- 不要把长段改动拆成很多同索引 `insert`。
- 每条 `op` 在调用前必须自检必填字段是否齐全（见 `11-patch-drone-program-args.md`）。

## 失败重试约束
- 用户明确要求“直接修改/写入”时，必须真实调用 `PatchDroneProgram`。
- `PatchDroneProgram` 返回 `ok=false` 时，需根据错误继续补参重试。
- 任意工具失败后，不允许停在失败说明，需调整参数继续尝试。
