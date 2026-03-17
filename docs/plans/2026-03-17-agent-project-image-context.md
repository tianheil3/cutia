# TIA-50 Agent 读取项目图片素材内容 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让网页里的 Agent 能按需读取当前项目图片素材内容，并把图像理解结果用于后续回答与编辑决策。

**Architecture:** 在 Agent 工具层新增一个按需图片分析工具，复用现有 `vision.ts` 和项目媒体文件，不把图片内容预注入系统提示词。通过可注入依赖的工具工厂保证单测和真实 API 验证都能走同一套核心逻辑。

**Tech Stack:** Next.js 16, TypeScript, Zustand, Bun test, OpenAI-compatible chat completions API

---

### Task 1: 文档与测试切口

**Files:**
- Create: `docs/plans/2026-03-17-agent-project-image-context-design.md`
- Create: `docs/plans/2026-03-17-agent-project-image-context.md`
- Test: `apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

**Step 1: 写失败测试**

覆盖以下行为：

- 没有图片素材时，分析工具返回失败。
- 指定 `mediaIds` 时，只分析对应图片素材。
- 传入 `question` 时，视觉提示词会带上该聚焦问题。

**Step 2: 运行测试确认失败**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: FAIL，提示新工具或导出尚不存在。

**Step 3: 准备最小实现骨架**

先在 `media-tools.ts` 里添加可测试的工具工厂和占位导出，不实现完整逻辑。

**Step 4: 重新运行测试**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: 仍然 FAIL，但失败原因变成行为不符合预期，而不是模块缺失。

**Step 5: Commit**

```bash
git add docs/plans/2026-03-17-agent-project-image-context-design.md docs/plans/2026-03-17-agent-project-image-context.md apps/web/src/lib/ai/agent/tools/media-tools.test.ts apps/web/src/lib/ai/agent/tools/media-tools.ts
git commit -m "test(agent): define project image analysis behavior"
```

### Task 2: 实现图片分析工具

**Files:**
- Modify: `apps/web/src/lib/ai/agent/tools/media-tools.ts`
- Modify: `apps/web/src/lib/ai/vision.ts`
- Modify: `apps/web/src/lib/ai/agent/tools/index.ts`

**Step 1: 让失败测试通过**

实现：

- 项目图片分析默认提示词
- 图片素材筛选
- data URL 转换与 vision 调用
- 结果结构化返回

**Step 2: 运行目标测试确认通过**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: PASS

**Step 3: 做最小重构**

清理重复判断，保证错误消息和导出结构一致。

**Step 4: 再次确认测试仍然通过**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/ai/agent/tools/media-tools.ts apps/web/src/lib/ai/vision.ts apps/web/src/lib/ai/agent/tools/index.ts apps/web/src/lib/ai/agent/tools/media-tools.test.ts
git commit -m "feat(agent): analyze image assets from current project"
```

### Task 3: 更新 Agent 提示词与验证脚本

**Files:**
- Modify: `apps/web/src/lib/ai/agent/system-prompt.ts`
- Create: `apps/web/scripts/validate-agent-project-image-context.ts`

**Step 1: 写或补充失败测试/验证断言**

如果需要，为系统提示词调用指导补最小断言；否则直接依赖验证脚本确认行为。

**Step 2: 实现提示词更新和真实 API 验证脚本**

脚本需要：

- 读取仓库内图片样本
- 注入 `API_BASE_URL / API_KEY / API_MODEL`
- 调用新工具并输出简洁结果

**Step 3: 运行自动化测试**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: PASS

**Step 4: 运行真实 API 验证**

Run: `bun run apps/web/scripts/validate-agent-project-image-context.ts`

Expected: exit 0，并输出至少一条非空图片内容分析结果。

**Step 5: Commit**

```bash
git add apps/web/src/lib/ai/agent/system-prompt.ts apps/web/scripts/validate-agent-project-image-context.ts
git commit -m "chore(agent): document project image analysis validation"
```

### Task 4: 完整回归与提交流程

**Files:**
- Modify: `.github/pull_request_template.md` (only if PR body drafting needs reference, no repo edit expected)

**Step 1: 运行完整验证**

Run: `bun test apps/web/src/lib/ai/agent/tools/media-tools.test.ts`

Expected: PASS

Run: `bun test`

Expected: PASS

Run: `bun run apps/web/scripts/validate-agent-project-image-context.ts`

Expected: PASS

**Step 2: 检查 git 状态和差异**

Run: `git status --short && git diff --stat`

Expected: 只有本工单相关改动。

**Step 3: 更新 workpad**

把 pull 证据、测试命令、真实 API 验证结果和方案假设写回 Linear 的 `## Codex Workpad`。

**Step 4: 推送并创建 PR**

Run: `git push -u fork HEAD`

Expected: push 成功

Run: `gh pr create ...` / `gh pr edit ...`

Expected: 返回 PR URL，并关联到 `TIA-50`

**Step 5: 完成反馈清扫**

拉取 PR 评论与 review，逐条处理后再更新 issue 状态。
