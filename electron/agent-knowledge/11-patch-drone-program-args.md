# PatchDroneProgram 参数速查（防误调）

## 调用前最小流程
1. `ListProjectDrones`：确认目标无人机（优先拿 `droneId`）。
2. `GetDroneBlocks`：读取当前积木，拿到真实 `block.id` 与顺序。
3. 组装 `operations` 后调用 `PatchDroneProgram`。
4. 写入后调用 `GetTrajectoryIssuesDetailed` 复检。

## 顶层参数
- `droneId`：推荐必传；唯一匹配最稳定。
- `droneName`：仅在你确定名称唯一时使用。
- `operations`：必填、非空数组；按顺序执行。

## 索引规则
- `index` / `startIndex` / `endIndex` / `toIndex` 全部是 **1-based**。
- `replace_range` 是闭区间：`startIndex` 到 `endIndex` 都会被替换。

## op 与必填字段
- `append_block`：`block`
- `insert_after`：`afterBlockId` + `block`
- `insert`：`index` + `block`
- `insert_blocks_at`：`index` + `blocks`（非空）
- `replace_range`：`startIndex` + `endIndex` + `blocks`（非空）
- `update_fields`：`blockId` + `fields`
- `delete_block`：`blockId`
- `move_block`：`blockId` + `toIndex`

## 积木草稿 block 结构
- `type`：必填。
- `fields`：新增/替换积木时必填；对象值应为字符串。
- `id`：可选，不传时会自动生成。
- `comment`：可选。

## 新增/替换积木的参数要求
- 适用 op：`append_block` / `insert_after` / `insert` / `insert_blocks_at` / `replace_range`。
- 每个新积木都要写 `type + fields`，不能只写 `type`。
- 不确定 `fields` 键名、默认值、取值约束时，先调 `GetBlockCatalog` 再发起 `PatchDroneProgram`。

## 易错点
- 不要把多个“同一 index 的 insert”拆开；连续片段优先 `insert_blocks_at`。
- 长片段替换优先 `replace_range`，不要用多次 `delete_block + insert`。
- `update_fields` 仅会覆盖给出的字段键，不会自动补全缺失键。
- 新增积木只写 `type` 不写 `fields`，极易导致 `ok=false` 并触发补参重试。
