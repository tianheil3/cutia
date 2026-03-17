# TIA-49 Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 依据原始关键帧/动画设计文档，在当前 `main` 基线上重新落地 AI 动画操作能力，并用新 PR 重新进入人工评审。

**Architecture:** 以 `animations` 作为元素动画的唯一数据模型，在时间线层提供显式 command/manager API，在 AI 工具、预览 overlay 与 renderer 侧复用同一套动画解析逻辑。先补失败测试，再逐层补数据结构、命令、AI 接口与渲染链路，避免 UI、AI、导出三处行为漂移。

**Tech Stack:** TypeScript, Bun test, Biome, 编辑器命令系统, Timeline manager, AI agent tools

---

### Task 1: 建立失败测试并锁定返工目标

**Files:**
- Create: `apps/web/src/lib/timeline/__tests__/animation-utils.test.ts`
- Modify: `apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`
- Modify: `apps/web/src/core/managers/timeline-manager.test.ts`

**Step 1: 写失败测试**

补三类断言：
- `animation-utils.test.ts` 覆盖关键帧归一化、easing、preset、transform/opacity 解析。
- `timeline-tools.test.ts` 断言存在 `get_element_animations` / `add_keyframes` / `remove_keyframes` / `set_animation_preset`。
- `timeline-manager.test.ts` 断言 manager 暴露 `addKeyframes` / `removeKeyframes` / `setAnimationPreset` 并通过 command 写入。

**Step 2: 运行测试确认失败**

Run: `bun test apps/web/src/lib/timeline/__tests__/animation-utils.test.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts apps/web/src/core/managers/timeline-manager.test.ts`

Expected:
- `animation-utils` 相关模块缺失或导出不匹配
- AI 工具名断言失败
- Timeline manager API 缺失

**Step 3: 提交测试工作树检查点**

Run: `git status --short`

Expected: 只有测试文件改动，无生产代码改动。

### Task 2: 补齐动画数据模型与运行时工具

**Files:**
- Modify: `apps/web/src/types/timeline.ts`
- Create: `apps/web/src/lib/timeline/animation-utils.ts`
- Modify: `apps/web/src/lib/timeline/element-utils.ts`
- Delete: `apps/web/src/lib/timeline/keyframes.ts`
- Delete: `apps/web/src/lib/timeline/keyframes.test.ts`

**Step 1: 写最小实现**

实现以下内容：
- 在 `timeline.ts` 中新增 `AnimatableProperty`、`AnimationEasing`、`AnimationKeyframe`、`ElementAnimations`、`AnimatableElement`，并为可视元素加上 `animations?`。
- 在 `animation-utils.ts` 中实现：
  - `ANIMATABLE_PROPERTIES`
  - `ANIMATION_PRESETS`
  - `normalizeKeyframes`
  - `normalizeAnimations`
  - `hasAnimations`
  - `applyEasing`
  - `resolveAnimatedValue`
  - `resolveAnimatedOpacity`
  - `resolveAnimatedTransform`
  - `addPropertyKeyframes`
  - `removePropertyKeyframes`
  - `buildAnimationPreset`
  - `canElementHaveAnimations`
- 删除旧 `keyframes` 模型，避免同义概念并存。

**Step 2: 运行目标测试**

Run: `bun test apps/web/src/lib/timeline/__tests__/animation-utils.test.ts`

Expected: `animation-utils.test.ts` 通过；其余测试可能仍失败。

### Task 3: 补齐 command 与 timeline manager 显式 API

**Files:**
- Create: `apps/web/src/lib/commands/timeline/element/update-element-animations.ts`
- Modify: `apps/web/src/lib/commands/timeline/element/index.ts`
- Modify: `apps/web/src/core/managers/timeline-manager.ts`
- Modify: `apps/web/src/core/managers/timeline-manager.test.ts`

**Step 1: 实现命令**

在 `update-element-animations.ts` 中新增 `UpdateElementAnimationsCommand`，支持：
- `add-keyframes`
- `remove-keyframes`
- `set-preset`

命令必须：
- 保存执行前 `TimelineTrack[]`
- 只修改目标元素
- 保持 undo/redo 正确回滚

**Step 2: 接入 manager API**

在 `timeline-manager.ts` 中新增：
- `addKeyframes`
- `removeKeyframes`
- `setAnimationPreset`

这些 API 只能通过 `UpdateElementAnimationsCommand` 写入，不允许绕过命令系统直接改 track。

**Step 3: 运行目标测试**

Run: `bun test apps/web/src/core/managers/timeline-manager.test.ts`

Expected: manager 新 API 与 undo/redo 行为通过。

### Task 4: 接入 AI 工具与渲染链路

**Files:**
- Modify: `apps/web/src/lib/ai/agent/tools/timeline-tools.ts`
- Modify: `apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`
- Modify: `apps/web/src/lib/ai/agent/system-prompt.ts`
- Modify: `apps/web/src/components/editor/panels/preview/selection-overlay.tsx`
- Modify: `apps/web/src/services/renderer/nodes/visual-node.ts`
- Modify: `apps/web/src/services/renderer/nodes/text-node.ts`
- Modify: `apps/web/src/services/renderer/scene-builder.ts`

**Step 1: 接入 AI 工具**

在 `timeline-tools.ts` 中：
- 扩展 `get_timeline_state` 返回动画信息
- 新增 `get_element_animations`
- 新增 `add_keyframes`
- 新增 `remove_keyframes`
- 新增 `set_animation_preset`
- 保持 `update_element` 只处理静态属性，不混入动画写入

**Step 2: 接入运行时**

在 overlay / renderer 中统一使用 `animation-utils`：
- 预览框位置、缩放、旋转、透明度跟随动画解析结果
- 场景构建和文本/视觉节点使用同一动画求值逻辑

**Step 3: 运行目标测试**

Run: `bun test apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts apps/web/src/lib/timeline/__tests__/animation-utils.test.ts apps/web/src/core/managers/timeline-manager.test.ts`

Expected: 三组测试全部通过。

### Task 5: 文档、验证与重新提 PR

**Files:**
- Create: `docs/plans/2026-03-17-ai-keyframes-animation-tools.md`
- Create: `docs/plans/2026-03-17-ai-keyframes-animation-tools-design.md`
- Modify: `docs/plans/2026-03-17-tia-49-rework-implementation.md`

**Step 1: 补齐仓库内文档**

把确认后的原始设计要点同步到仓库内 `docs/plans/`，确保后续评审不再依赖仓库外路径。

**Step 2: 跑完整验证**

Run:
- `bun test apps/web/src/lib/timeline/__tests__/animation-utils.test.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts apps/web/src/core/managers/timeline-manager.test.ts`
- `bunx tsc --noEmit -p apps/web/tsconfig.json`
- `bunx @biomejs/biome lint apps/web/src/types/timeline.ts apps/web/src/lib/timeline/animation-utils.ts apps/web/src/lib/timeline/__tests__/animation-utils.test.ts apps/web/src/lib/timeline/element-utils.ts apps/web/src/lib/commands/timeline/element/update-element-animations.ts apps/web/src/lib/commands/timeline/element/index.ts apps/web/src/core/managers/timeline-manager.ts apps/web/src/core/managers/timeline-manager.test.ts apps/web/src/components/editor/panels/preview/selection-overlay.tsx apps/web/src/services/renderer/nodes/visual-node.ts apps/web/src/services/renderer/nodes/text-node.ts apps/web/src/services/renderer/scene-builder.ts apps/web/src/lib/ai/agent/system-prompt.ts apps/web/src/lib/ai/agent/tools/timeline-tools.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts --max-diagnostics=1000`
- `bun run lint:web`

Expected:
- 前三项通过
- `bun run lint:web` 若仍因环境缺少全局 `biome` 失败，要在工作台里记录为环境问题并附重现输出

**Step 3: 提交并推送**

Run:
- `git add <changed files>`
- `git commit -m "feat(ai): implement animation tools rework"`
- `git push -u origin tianheilene/tia-49-开发-提供给ai的-操作关键帧的能力接口-rework-1`

**Step 4: 新建 PR 并回写工单**

Run:
- `gh pr create --base main --head tianheilene/tia-49-开发-提供给ai的-操作关键帧的能力接口-rework-1 --title "TIA-49 开发：为 AI 提供关键帧操作接口（返工）" --body-file <prepared-body>`

然后：
- 更新新的 `## Codex Workpad`
- 将新 PR 链接回工单
- 仅在验证完成且无待处理反馈时再切回 `Human Review`
