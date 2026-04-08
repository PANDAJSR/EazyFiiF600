# 编码约束

## 方法优先级

- 与当前工程无人机/积木相关的问题，优先调用项目方法读取数据后回答。
- 不确定积木类型时，先调用 `getBlockCatalog`，再写入。
- 规划科目道具路径时，先调用 `getRodConfig`。

## 平移积木约束

- 生成或修改飞行动作时，禁止使用 `Goertek_MoveToCoord`。
- 默认使用 `EazyFii_MoveToCoordAutoDelay`。
- `Goertek_MoveToCoord2` 仅在用户明确要求"异步平移"时使用。

## EazyFii_MoveToCoordAutoDelay 字段约束

- `block.fields` 必须包含且只使用：`X`、`Y`、`Z`、`time`。
- `X/Y/Z/time` 必须是非空字符串数字，如 `"120"`、`"800"`。
- 禁止空串、`null`、`undefined`、对象或缺字段。
- 发起 `patchDrone` 前必须先自检并修正字段合法性。

## patchDrone 约束

- 顶层参数必须包含：`operations`（非空数组），并优先传 `droneId`。
- 所有索引参数（`index/startIndex/endIndex/toIndex`）按 **1-based** 理解。
- 凡是 `append/insert/replace` 新增积木，必须给出 `block.type + block.fields`（或 `blocks[i].type + blocks[i].fields`），禁止只写积木类型。
- 若新增积木字段不确定，必须先调用 `getBlockCatalog` 获取参数键名、默认值与约束后再写入。
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
- 每条 `op` 在调用前必须自检必填字段是否齐全。

## 失败重试约束

- 用户明确要求"直接修改/写入"时，必须真实调用 `patchDrone`。
- `patchDrone` 返回 `ok=false` 时，需根据错误继续补参重试。
- 任意方法失败后，不允许停在失败说明，需调整参数继续尝试。

## patchDrone op 必填字段

| op | 必填字段 |
|----|---------|
| `append_block` | `block` |
| `insert_after` | `afterBlockId` + `block` |
| `insert` | `index` + `block` |
| `insert_blocks_at` | `index` + `blocks`（非空） |
| `replace_range` | `startIndex` + `endIndex` + `blocks`（非空） |
| `update_fields` | `blockId` + `fields` |
| `delete_block` | `blockId` |
| `move_block` | `blockId` + `toIndex` |

## 积木草稿 block 结构

- `type`：必填。
- `fields`：新增/替换积木时必填；对象值应为字符串。
- `id`：可选，不传时会自动生成。
- `comment`：可选。

## 易错点

- 不要把多个"同一 index 的 insert"拆开；连续片段优先 `insert_blocks_at`。
- 长片段替换优先 `replace_range`，不要用多次 `delete_block + insert`。
- `update_fields` 仅会覆盖给出的字段键，不会自动补全缺失键。
- 新增积木只写 `type` 不写 `fields`，极易导致 `ok=false` 并触发补参重试。

## 距离与安全性

- 默认轨迹与杆件水平最近距离建议 `>=40cm`。
- 不应小于 `30cm`，低于该值碰撞风险显著上升。

## 调用前最小流程

1. `listDrones`：确认目标无人机（优先拿 `droneId`）。
2. `getDroneBlocks`：读取当前积木，拿到真实 `block.id` 与顺序。
3. 组装 `operations` 后调用 `patchDrone`。
4. 写入后调用 `getTrajectoryIssues` 复检。
