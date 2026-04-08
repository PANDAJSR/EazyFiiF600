# API 方法详细说明

## 请求格式

```json
{
  "method": "方法名",
  "params": {
    // 方法参数
  },
  "id": "请求ID（可选）"
}
```

## 响应格式

成功：
```json
{
  "ok": true,
  "result": {
    // 返回结果
  },
  "id": "请求ID"
}
```

错误：
```json
{
  "ok": false,
  "error": "错误信息",
  "id": "请求ID"
}
```

---

## 可用方法

### 1. listDrones - 列出无人机

获取当前工程中的所有无人机。

**返回：**
```json
{
  "ok": true,
  "result": {
    "drones": [
      {
        "droneId": "drone_1",
        "droneName": "无人机1",
        "actionGroup": "",
        "startPos": { "x": "0", "y": "0", "z": "0" },
        "blockCount": 15
      }
    ]
  }
}
```

---

### 2. getDroneBlocks - 获取无人机积木

获取特定无人机的所有积木。

**参数：**
```json
{
  "droneId": "drone_1"
}
```

或：
```json
{
  "droneName": "无人机1"
}
```

**返回：**
```json
{
  "ok": true,
  "result": {
    "blocks": [
      {
        "index": 1,
        "type": "Goertek_UnLock",
        "fields": {}
      }
    ]
  }
}
```

---

### 3. patchDrone - 修改无人机程序

对无人机程序进行差量修改。

**调用前必读：**
1. 先调用 `listDrones` 确认目标无人机（优先用 `droneId`）
2. 调用 `getDroneBlocks` 读取当前积木，拿到真实 `block.id` 与顺序
3. 组装 `operations` 后调用 `patchDrone`
4. 写入后调用 `getTrajectoryIssues` 复检

**参数：**
```json
{
  "droneId": "drone_1",
  "operations": [
    {
      "op": "append_block",
      "block": {
        "type": "EazyFii_MoveToCoordAutoDelay",
        "fields": { "X": "120", "Y": "120", "Z": "100", "time": "800" }
      }
    }
  ]
}
```

**索引规则：**
- `index` / `startIndex` / `endIndex` / `toIndex` 全部是 **1-based**。
- `replace_range` 是闭区间：`startIndex` 到 `endIndex` 都会被替换。

**op 与必填字段：**

| op | 必填参数 | 说明 |
|---|---|---|
| `append_block` | `block` | 追加到末尾 |
| `insert_after` | `afterBlockId` + `block` | 在指定积木后插入 |
| `insert` | `index` + `block` | 在指定位置插入（1-based） |
| `insert_blocks_at` | `index` + `blocks` | 在指定位置插入多个积木 |
| `replace_range` | `startIndex` + `endIndex` + `blocks` | 替换闭区间范围内的积木 |
| `update_fields` | `blockId` + `fields` | 更新积木字段（仅覆盖给出的键） |
| `delete_block` | `blockId` | 删除指定积木 |
| `move_block` | `blockId` + `toIndex` | 移动积木到指定位置 |

**block 结构：**
- `type`：必填，积木类型名
- `fields`：新增/替换时必填，对象值应为字符串
- `id`：可选，不传时会自动生成
- `comment`：可选

**易错点：**
- 不要把多个"同一 index 的 insert"拆开；连续片段优先用 `insert_blocks_at`
- 长片段替换优先 `replace_range`，不要用多次 `delete_block + insert`
- `update_fields` 仅会覆盖给出的字段键，不会自动补全缺失键
- 新增积木只写 `type` 不写 `fields`，会导致 `ok=false`

---

### 4. getRodConfig - 获取杆子配置

获取当前工程的杆子配置信息。

**返回：**
```json
{
  "ok": true,
  "result": {
    "rodConfig": {
      "takeoffZone": [{ "x": 0, "y": 0 }, ...],
      "subject3Ring": { "centerHeight": 150 },
      "subject9Config": { "secondCrossbarHeight": 200 },
      "subject1": [{ "x": 160, "y": 160 }, ...],
      ...
    }
  }
}
```

---

### 5. getBlockCatalog - 获取积木目录

获取当前工程支持的所有积木类型。

**返回：**
```json
{
  "ok": true,
  "result": {
    "blocks": [
      {
        "type": "EazyFii_MoveToCoordAutoDelay",
        "label": "智能平移",
        "fields": { "X": "0", "Y": "0", "Z": "100", "time": "800" },
        "keywords": ["平移", "自动延时", "move", "auto", "delay"]
      },
      ...
    ],
    "constraints": [
      "默认优先使用 EazyFii_MoveToCoordAutoDelay",
      "禁止使用 Goertek_MoveToCoord"
    ]
  }
}
```

---

### 6. getTrajectoryIssues - 获取轨迹问题

获取当前工程所有无人机的轨迹问题详情。

**返回：**
```json
{
  "ok": true,
  "result": {
    "issues": [
      {
        "droneId": "drone_1",
        "problems": [
          {
            "index": 3,
            "type": "heading_mismatch",
            "message": "机头朝向后路径方向不一致",
            "from": { "x": 0, "y": 0 },
            "to": { "x": 120, "y": 120 },
            "headingDeg": 45,
            "moveDirectionDeg": 90
          }
        ]
      }
    ]
  }
}
```

---

### 7. getTrajectoryDebug - 获取轨迹调试快照

获取逐段轨迹调试信息。

**参数：**
```json
{
  "droneId": "drone_1"
}
```

**返回：**
```json
{
  "ok": true,
  "result": {
    "segments": [
      {
        "index": 1,
        "from": { "x": 0, "y": 0, "z": 0 },
        "to": { "x": 100, "y": 100, "z": 100 },
        "headingDeg": 45,
        "moveDirectionDeg": 45,
        "motorLights": "green",
        "bodyLights": "off"
      }
    ]
  }
}
```
