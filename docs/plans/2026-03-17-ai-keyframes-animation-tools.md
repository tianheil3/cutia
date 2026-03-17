# AI Keyframe Animation Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Add real AI-chat-callable keyframe animation tools for visual
timeline elements, with preview, selection overlay, export, and undo/redo
support.

**Architecture:** Store optional animation tracks directly on visual timeline
elements and evaluate them at runtime from element-local time. Expose explicit
timeline manager methods and AI tools for animation manipulation rather than
writing raw animation objects through the generic `update_element` path. Reuse
one animation resolver in renderer nodes and selection overlays so preview and
export stay consistent.

**Tech Stack:** TypeScript, Next.js app router, Bun test, editor singleton
managers, command pattern undo/redo, canvas renderer

---

### Task 1: Add animation types to timeline models

**Files:**
- Modify: `apps/web/src/types/timeline.ts`
- Test: `apps/web/src/lib/timeline/__tests__/animation-utils.test.ts`

Implement:

- `AnimatableProperty`
- `AnimationEasing`
- `AnimationKeyframe`
- `ElementAnimations`
- `animations?: ElementAnimations` on visual elements

### Task 2: Build animation evaluation utilities with TDD

**Files:**
- Create: `apps/web/src/lib/timeline/animation-utils.ts`
- Test: `apps/web/src/lib/timeline/__tests__/animation-utils.test.ts`

Cover:

- normalization
- duplicate timestamp overwrite
- `linear`
- `ease-in`
- `ease-out`
- `ease-in-out`
- `hold`
- before-first and after-last keyframe behavior
- animated transform and opacity resolution

### Task 3: Add explicit timeline animation API and command

**Files:**
- Modify: `apps/web/src/core/managers/timeline-manager.ts`
- Create: `apps/web/src/lib/commands/timeline/element/update-element-animations.ts`
- Modify: `apps/web/src/lib/commands/timeline/element/index.ts`
- Test: `apps/web/src/core/managers/timeline-manager.test.ts`

Required API:

- `addKeyframes`
- `removeKeyframes`
- `setAnimationPreset`

### Task 4: Integrate runtime evaluation into preview, overlay, and export

**Files:**
- Modify: `apps/web/src/services/renderer/nodes/visual-node.ts`
- Modify: `apps/web/src/services/renderer/nodes/text-node.ts`
- Modify: `apps/web/src/services/renderer/scene-builder.ts`
- Modify: `apps/web/src/components/editor/panels/preview/selection-overlay.tsx`

### Task 5: Replace AI tool surface with animation-aware tools

**Files:**
- Modify: `apps/web/src/lib/ai/agent/tools/timeline-tools.ts`
- Modify: `apps/web/src/lib/ai/agent/system-prompt.ts`
- Test: `apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts`

Required tools:

- `get_element_animations`
- `add_keyframes`
- `remove_keyframes`
- `set_animation_preset`

### Task 6: Validation

Run:

- `bun test apps/web/src/lib/timeline/__tests__/animation-utils.test.ts apps/web/src/lib/ai/agent/tools/timeline-tools.test.ts apps/web/src/core/managers/timeline-manager.test.ts`
- `bunx tsc --noEmit -p apps/web/tsconfig.json`
- `bunx @biomejs/biome lint <changed-files> --max-diagnostics=1000`

Repository-wide `bun run lint:web` may still fail because the environment lacks
a global `biome` binary and the repo has existing unrelated lint/config issues.
