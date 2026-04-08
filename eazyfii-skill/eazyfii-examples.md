# 完整使用示例

## 示例1：列出所有无人机

```bash
echo '{"method":"listDrones","params":{}}' | node eazyfii-tool.mjs
```

## 示例2：获取无人机积木

```bash
echo '{"method":"getDroneBlocks","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs
```

## 示例3：修改无人机程序（新增积木）

```bash
echo '{"method":"patchDrone","params":{"droneId":"drone_1","operations":[{"op":"append_block","block":{"type":"EazyFii_MoveToCoordAutoDelay","fields":{"X":"120","Y":"120","Z":"100","time":"800"}}}]}}' | node eazyfii-tool.mjs
```

## 示例4：完整工作流

```bash
# 1. 列出所有无人机
echo '{"method":"listDrones","params":{}}' | node eazyfii-tool.mjs

# 2. 获取无人机积木
echo '{"method":"getDroneBlocks","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs

# 3. 修改积木程序（插入起飞和绕杆动作）
echo '{"method":"patchDrone","params":{"droneId":"drone_1","operations":[
  {"op":"append_block","block":{"type":"Goertek_UnLock","fields":{}}},
  {"op":"append_block","block":{"type":"Goertek_TakeOff2","fields":{"alt":"100"}}},
  {"op":"append_block","block":{"type":"EazyFii_MoveToCoordAutoDelay","fields":{"X":"120","Y":"120","Z":"100","time":"800"}}},
  {"op":"append_block","block":{"type":"Goertek_TurnTo","fields":{"turnDirection":"r","angle":"90"}}},
  {"op":"append_block","block":{"type":"block_delay","fields":{"time":"1000"}}}
]}}' | node eazyfii-tool.mjs

# 4. 复检轨迹问题
echo '{"method":"getTrajectoryIssues","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs
```

## 示例5：调试复杂问题

当无法判断 issue 根因时（尤其机头朝向、灯光、路径段状态）：

```bash
# 1. 获取轨迹问题详情
echo '{"method":"getTrajectoryIssues","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs

# 2. 获取调试快照
echo '{"method":"getTrajectoryDebug","params":{"droneId":"drone_1"}}' | node eazyfii-tool.mjs

# 3. 根据 from->to、headingDeg、moveDirectionDeg、电机灯光、整体灯光 制定修复策略
```

## 示例6：获取积木目录

当不确定积木字段时，先查询：

```bash
echo '{"method":"getBlockCatalog","params":{}}' | node eazyfii-tool.mjs
```

## 示例7：获取道具配置

规划科目道具路径时：

```bash
echo '{"method":"getRodConfig","params":{}}' | node eazyfii-tool.mjs
```

## 复检流程

1. 调用 `patchDrone` 修改积木
2. 调用 `getTrajectoryIssues` 复检
3. 若复检仍显示与目标科目相关问题，继续修改并再次复检
4. 禁止"只改一次就结束"；完成依据必须是最新复检结果
