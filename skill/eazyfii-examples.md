# 完整使用示例

## 示例1：对话式编程

```bash
echo '{"method":"chat","params":{"message":"为 drone_1 添加科目1绕竖杆程序"}}' | node eazyfii-tool.mjs
```

## 示例2：直接修改

```bash
echo '{"method":"patchDrone","params":{"droneId":"drone_1","operations":[{"op":"append_block","block":{"type":"EazyFii_MoveToCoordAutoDelay","fields":{"X":"120","Y":"120","Z":"100","time":"800"}}}]}}' | node eazyfii-tool.mjs
```

## 示例3：查询状态

```bash
echo '{"method":"getStatus"}' | node eazyfii-tool.mjs
```
