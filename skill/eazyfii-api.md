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

## 可用方法

### 1. chat - 与 Agent 对话

发送消息给内置 Agent 进行无人机编程。

**参数：**
```json
{
  "message": "绕竖杆一圈",
  "reset": false,
  "enableReasoning": false
}
```

**返回：**
```json
{
  "ok": true,
  "result": {
    "reply": "我已经为您规划了科目1的绕杆轨迹...",
    "traces": [
      {
        "phase": "start",
        "tool": "Bash",
        "command": "...",
        "timeoutSec": 30
      }
    ],
    "provider": "openai",
    "model": "gpt-4o-mini",
    "transportMode": "chat"
  }
}
```

### 2. getStatus - 获取 Agent 状态

查询内置 Agent 的当前运行状态。

**返回：**
```json
{
  "ok": true,
  "result": {
    "busy": false,
    "phase": "idle",
    "detail": "空闲",
    "startedAt": null,
    "updatedAt": 1743993600000,
    "requestCount": 5,
    "lastError": null
  }
}
```

### 3. stop - 停止当前请求

停止正在进行的 Agent 请求。

**参数：**
```json
{
  "requestId": "可选的请求ID"
}
```

### 4. getEnv - 获取环境变量

获取 Agent 可用的环境变量。

**返回：**
```json
{
  "ok": true,
  "result": {
    "values": {
      "OPENAI_API_KEY": "sk-...",
      "NANO_MODEL": "gpt-4o-mini"
    },
    "allowedKeys": ["OPENAI_API_KEY", "NANO_MODEL", ...],
    "storagePath": "/path/to/.agent-env.json"
  }
}
```

### 5. setEnv - 设置环境变量

修改 Agent 环境变量。

**参数：**
```json
{
  "values": {
    "NANO_MODEL": "gpt-4o"
  }
}
```

### 6. listDrones - 列出无人机

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

### 7. getDroneBlocks - 获取无人机积木

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

### 8. patchDrone - 修改无人机程序

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

### 9. getRodConfig - 获取杆子配置

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

### 10. getBlockCatalog - 获取积木目录

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

### 11. getTrajectoryIssues - 获取轨迹问题

获取当前工程所有无人机的轨迹问题详情。

### 12. getTrajectoryDebug - 获取轨迹调试快照

获取逐段轨迹调试信息。

**参数：**
```json
{
  "droneId": "drone_1"
}
```
