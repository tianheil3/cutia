# AI Chat Keyframe Animation Design

> Source-aligned summary for TIA-49. Original reference was later confirmed at
> `/mydata/projects/cutia/docs/plans/2026-03-17-ai-keyframes-design.md`.

## Goal

Add real keyframe animation support that AI chat can use to animate visual
timeline elements without requiring a manual keyframe editor UI first.

## Scope

Included:

- Visual elements only: `video`, `image`, `text`, `sticker`
- Animatable numeric properties:
  - `opacity`
  - `transform.position.x`
  - `transform.position.y`
  - `transform.scale`
  - `transform.rotate`
- AI tool surface for:
  - reading existing element animations
  - adding keyframes
  - removing keyframes
  - applying animation presets
- Shared runtime evaluation for preview, export, and selection overlay
- Undo/redo support through timeline commands

Deferred:

- Manual keyframe timeline UI
- Curve editor UI
- Arbitrary cubic bezier curves
- Non-visual element animation
- Animation of text color, box width, volume, and other non-MVP properties

## Data Model

Store optional animation data directly on visual timeline elements:

```ts
export type AnimatableProperty =
  | "opacity"
  | "transform.position.x"
  | "transform.position.y"
  | "transform.scale"
  | "transform.rotate";

export type AnimationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "hold";

export interface AnimationKeyframe {
  time: number;
  value: number;
  easing?: AnimationEasing;
}

export type ElementAnimations = Partial<
  Record<AnimatableProperty, AnimationKeyframe[]>
>;
```

Keyframe `time` is stored relative to the element start rather than global
timeline time:

```ts
localTime = currentTime - element.startTime;
```

## Runtime Evaluation

Use one shared helper in `apps/web/src/lib/timeline/animation-utils.ts` to:

- normalize and sort keyframes
- collapse duplicate timestamps by last write wins
- reject invalid times
- evaluate easing progress
- resolve animated transform and opacity at runtime

Preview, export, and selection overlay must all consume the same resolver.

## Editor Integration

Do not edit raw `animations` through the generic `update_element` path.

Expose explicit timeline manager methods:

- `addKeyframes`
- `removeKeyframes`
- `setAnimationPreset`

Back them with a dedicated element animation command so undo/redo remains
explicit and reusable by future manual UI.

## AI Tool Surface

Required tools:

- `get_element_animations`
- `add_keyframes`
- `remove_keyframes`
- `set_animation_preset`

Recommended presets:

- `fade-in`
- `fade-out`
- `slide-in-left`
- `slide-in-right`
- `slide-in-up`
- `slide-in-down`
- `zoom-in`
- `zoom-out`
- `pop-in`

## Validation Rules

- Property must be supported
- Element must be visual
- Keyframes must be normalized to ascending time order
- Duplicate timestamps use last write wins
- Negative times are rejected
- Times beyond element duration are rejected
- Fewer than two keyframes are allowed
- `hold` keeps the previous value until the next keyframe

## Compatibility

No storage migration version bump is required for this MVP because
`animations` remains optional.
