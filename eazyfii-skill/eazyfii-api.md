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

**支持的操作类型：**
- `append_block` - 追加积木
- `insert_after` - 在指定积木后插入
- `insert` - 在指定位置插入
- `insert_blocks_at` - 在指定位置插入多个连续积木
- `replace_range` - 替换范围内的积木
- `update_fields` - 更新积木字段
- `delete_block` - 删除积木
- `move_block` - 移动积木位置

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
