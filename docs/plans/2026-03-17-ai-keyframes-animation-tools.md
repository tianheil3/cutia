# AI Keyframes Animation Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AI Agent 增加可执行且可渲染生效的关键帧操作接口。

**Architecture:** 在时间线可视觉元素上增加可选 `keyframes` 数据结构，使用纯函数封装关键帧增删改查与插值解析，再把该能力暴露给 AI 工具层，并在渲染节点按当前时间读取动态值。保持旧项目兼容，避免引入 UI 级关键帧编辑器。

**Tech Stack:** TypeScript, Bun Test, EditorCore AI tools, Canvas renderer

---

### Task 1: 固化关键帧纯函数与类型

**Files:**
- Create: `apps/web/src/lib/timeline/keyframes.ts`
- Modify: `apps/web/src/types/timeline.ts`
- Test: `apps/web/src/lib/timeline/keyframes.test.ts`

**Step 1: Write the failing test**

```typescript
test("interpolates opacity between two linear keyframes", () => {
  const value = resolveKeyframedValue({
    defaultValue: 1,
    time: 1,
    keyframes: [
      { id: "a", time: 0, value: 0, interpolation: "linear" },
      { id: "b", time: 2, value: 1, interpolation: "linear" },
    ],
  });

  expect(value).toBe(0.5);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/timeline/keyframes.test.ts`
Expected: FAIL，因为关键帧工具文件尚不存在。

**Step 3: Write minimal implementation**

```typescript
export function resolveKeyframedValue(...) {
  // 先只实现默认值、排序、区间插值与 hold
}
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/timeline/keyframes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/types/timeline.ts apps/web/src/lib/timeline/keyframes.ts apps/web/src/lib/timeline/keyframes.test.ts
git commit -m "feat: add timeline keyframe primitives"
```

### Task 2: 暴露 AI 关键帧工具

**Files:**
- Modify: `apps/web/src/lib/ai/agent/tools/timeline-tools.ts`
- Modify: `apps/web/src/lib/ai/agent/system-prompt.ts`
- Test: `apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`

**Step 1: Write the failing test**

```typescript
test("timeline tools expose keyframe operations", () => {
  expect(timelineTools.map((tool) => tool.name)).toEqual(
    expect.arrayContaining([
      "get_element_keyframes",
      "set_element_keyframes",
      "delete_element_keyframes",
    ]),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`
Expected: FAIL，因为工具尚未注册。

**Step 3: Write minimal implementation**

```typescript
export const setElementKeyframesTool: AgentTool = { ... };
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/ai/agent/tools/timeline-tools.ts apps/web/src/lib/ai/agent/system-prompt.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts
git commit -m "feat: expose ai keyframe tools"
```

### Task 3: 让预览与导出消费关键帧

**Files:**
- Modify: `apps/web/src/services/renderer/nodes/visual-node.ts`
- Modify: `apps/web/src/services/renderer/nodes/text-node.ts`
- Test: `apps/web/src/lib/timeline/keyframes.test.ts`

**Step 1: Write the failing test**

```typescript
test("resolves animated transform for visual elements", () => {
  const state = resolveAnimatedElementState({
    baseTransform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    baseOpacity: 1,
    keyframes: {
      positionX: [
        { id: "a", time: 0, value: 0, interpolation: "linear" },
        { id: "b", time: 2, value: 200, interpolation: "linear" },
      ],
    },
    time: 1,
  });

  expect(state.transform.position.x).toBe(100);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/timeline/keyframes.test.ts`
Expected: FAIL，因为动态状态解析尚未实现。

**Step 3: Write minimal implementation**

```typescript
const resolved = resolveAnimatedElementState(...);
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/timeline/keyframes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/services/renderer/nodes/visual-node.ts apps/web/src/services/renderer/nodes/text-node.ts apps/web/src/lib/timeline/keyframes.test.ts
git commit -m "feat: render keyframed timeline properties"
```

### Task 4: 全量验证与工单回写

**Files:**
- Modify: `docs/plans/2026-03-17-ai-keyframes-animation-tools-design.md`
- Modify: `docs/plans/2026-03-17-ai-keyframes-animation-tools.md`

**Step 1: Run focused tests**

Run: `bun test apps/web/src/lib/timeline/keyframes.test.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`
Expected: PASS

**Step 2: Run repo lint for web**

Run: `bun run lint:web`
Expected: PASS

**Step 3: Update Linear workpad**

Run: 记录 Pull 证据、实现结论、验证结果、阻塞项（如有）
Expected: Workpad 与实际状态一致

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add ai keyframe animation tools"
```
