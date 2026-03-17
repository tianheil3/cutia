import type {
	AnimationEasing,
	AnimationKeyframe,
	AnimatableElement,
	AnimatableProperty,
	ElementAnimations,
	Transform,
} from "@/types/timeline";

const DEFAULT_EASING: AnimationEasing = "linear";
const DEFAULT_PRESET_DURATION = 0.6;
const DEFAULT_SLIDE_DISTANCE = 200;

export const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
	"opacity",
	"transform.position.x",
	"transform.position.y",
	"transform.scale",
	"transform.rotate",
];

export const ANIMATION_PRESETS = [
	"fade-in",
	"fade-out",
	"slide-in-left",
	"slide-in-right",
	"slide-in-up",
	"slide-in-down",
	"zoom-in",
	"zoom-out",
	"pop-in",
] as const;

export type AnimationPreset = (typeof ANIMATION_PRESETS)[number];

export function canElementHaveAnimations(
	element: { type: string },
): element is AnimatableElement {
	return element.type !== "audio";
}

export function normalizeKeyframes(
	keyframes: AnimationKeyframe[],
): AnimationKeyframe[] {
	const byTime = new Map<number, AnimationKeyframe>();

	for (const keyframe of keyframes) {
		byTime.set(keyframe.time, {
			time: keyframe.time,
			value: keyframe.value,
			easing: keyframe.easing ?? DEFAULT_EASING,
		});
	}

	return [...byTime.values()].sort((left, right) => left.time - right.time);
}

export function normalizeAnimations({
	animations,
}: {
	animations?: ElementAnimations;
}): ElementAnimations {
	const normalized: ElementAnimations = {};

	for (const property of ANIMATABLE_PROPERTIES) {
		const keyframes = animations?.[property];
		if (!keyframes || keyframes.length === 0) continue;
		normalized[property] = normalizeKeyframes(keyframes);
	}

	return normalized;
}

export function hasAnimations({
	animations,
}: {
	animations?: ElementAnimations;
}): boolean {
	return Object.values(normalizeAnimations({ animations })).some(
		(keyframes) => (keyframes?.length ?? 0) > 0,
	);
}

export function applyEasing({
	progress,
	easing,
}: {
	progress: number;
	easing: AnimationEasing;
}): number {
	if (easing === "hold") return 0;
	if (easing === "ease-in") return progress * progress;
	if (easing === "ease-out") return 1 - (1 - progress) * (1 - progress);
	if (easing === "ease-in-out") {
		return progress < 0.5
			? 2 * progress * progress
			: 1 - ((-2 * progress + 2) ** 2) / 2;
	}
	return progress;
}

export function resolveAnimatedValue({
	baseValue,
	keyframes,
	localTime,
}: {
	baseValue: number;
	keyframes?: AnimationKeyframe[];
	localTime: number;
}): number {
	if (!keyframes || keyframes.length === 0) return baseValue;

	const frames = normalizeKeyframes(keyframes);
	const first = frames[0];
	const last = frames[frames.length - 1];
	if (!first || !last) return baseValue;

	if (localTime <= first.time) return first.value;
	if (localTime >= last.time) return last.value;

	for (let index = 0; index < frames.length - 1; index++) {
		const from = frames[index];
		const to = frames[index + 1];
		if (!from || !to) continue;

		if (localTime >= from.time && localTime <= to.time) {
			const duration = to.time - from.time;
			if (duration <= 0) return to.value;
			const progress = (localTime - from.time) / duration;
			const eased = applyEasing({
				progress,
				easing: from.easing ?? DEFAULT_EASING,
			});
			return from.value + (to.value - from.value) * eased;
		}
	}

	return baseValue;
}

export function resolveAnimatedOpacity({
	baseOpacity,
	animations,
	localTime,
}: {
	baseOpacity: number;
	animations?: ElementAnimations;
	localTime: number;
}): number {
	return resolveAnimatedValue({
		baseValue: baseOpacity,
		keyframes: animations?.opacity,
		localTime,
	});
}

export function resolveAnimatedTransform({
	baseTransform,
	animations,
	localTime,
}: {
	baseTransform: Transform;
	animations?: ElementAnimations;
	localTime: number;
}): Transform {
	return {
		...baseTransform,
		position: {
			x: resolveAnimatedValue({
				baseValue: baseTransform.position.x,
				keyframes: animations?.["transform.position.x"],
				localTime,
			}),
			y: resolveAnimatedValue({
				baseValue: baseTransform.position.y,
				keyframes: animations?.["transform.position.y"],
				localTime,
			}),
		},
		scale: resolveAnimatedValue({
			baseValue: baseTransform.scale,
			keyframes: animations?.["transform.scale"],
			localTime,
		}),
		rotate: resolveAnimatedValue({
			baseValue: baseTransform.rotate,
			keyframes: animations?.["transform.rotate"],
			localTime,
		}),
	};
}

export function addPropertyKeyframes({
	animations,
	property,
	keyframes,
	duration,
}: {
	animations?: ElementAnimations;
	property: AnimatableProperty;
	keyframes: AnimationKeyframe[];
	duration: number;
}): ElementAnimations {
	const validated = keyframes.map((keyframe) =>
		validateKeyframe({ keyframe, duration }),
	);
	const existing = animations?.[property] ?? [];
	return {
		...normalizeAnimations({ animations }),
		[property]: normalizeKeyframes([...existing, ...validated]),
	};
}

export function removePropertyKeyframes({
	animations,
	property,
	times,
}: {
	animations?: ElementAnimations;
	property: AnimatableProperty;
	times?: number[];
}): ElementAnimations {
	const normalized = normalizeAnimations({ animations });
	const next: ElementAnimations = { ...normalized };

	if (!times || times.length === 0) {
		delete next[property];
		return next;
	}

	const timeSet = new Set(times);
	const remaining = (normalized[property] ?? []).filter(
		(keyframe) => !timeSet.has(keyframe.time),
	);

	if (remaining.length === 0) {
		delete next[property];
		return next;
	}

	next[property] = remaining;
	return next;
}

export function buildAnimationPreset({
	preset,
	baseTransform,
	baseOpacity,
	duration,
}: {
	preset: AnimationPreset;
	baseTransform: Transform;
	baseOpacity: number;
	duration: number;
}): ElementAnimations {
	const presetDuration = Math.max(
		0.01,
		Math.min(duration, DEFAULT_PRESET_DURATION),
	);

	switch (preset) {
		case "fade-in":
			return {
				opacity: [
					{ time: 0, value: 0, easing: "linear" },
					{ time: presetDuration, value: baseOpacity, easing: "linear" },
				],
			};
		case "fade-out":
			return {
				opacity: [
					{ time: 0, value: baseOpacity, easing: "linear" },
					{ time: presetDuration, value: 0, easing: "linear" },
				],
			};
		case "slide-in-left":
			return {
				"transform.position.x": [
					{
						time: 0,
						value: baseTransform.position.x - DEFAULT_SLIDE_DISTANCE,
						easing: "ease-out",
					},
					{
						time: presetDuration,
						value: baseTransform.position.x,
						easing: "ease-out",
					},
				],
			};
		case "slide-in-right":
			return {
				"transform.position.x": [
					{
						time: 0,
						value: baseTransform.position.x + DEFAULT_SLIDE_DISTANCE,
						easing: "ease-out",
					},
					{
						time: presetDuration,
						value: baseTransform.position.x,
						easing: "ease-out",
					},
				],
			};
		case "slide-in-up":
			return {
				"transform.position.y": [
					{
						time: 0,
						value: baseTransform.position.y + DEFAULT_SLIDE_DISTANCE,
						easing: "ease-out",
					},
					{
						time: presetDuration,
						value: baseTransform.position.y,
						easing: "ease-out",
					},
				],
			};
		case "slide-in-down":
			return {
				"transform.position.y": [
					{
						time: 0,
						value: baseTransform.position.y - DEFAULT_SLIDE_DISTANCE,
						easing: "ease-out",
					},
					{
						time: presetDuration,
						value: baseTransform.position.y,
						easing: "ease-out",
					},
				],
			};
		case "zoom-in":
			return {
				"transform.scale": [
					{ time: 0, value: 0.6, easing: "ease-out" },
					{
						time: presetDuration,
						value: baseTransform.scale,
						easing: "ease-out",
					},
				],
			};
		case "zoom-out":
			return {
				"transform.scale": [
					{ time: 0, value: baseTransform.scale, easing: "ease-out" },
					{ time: presetDuration, value: 0.6, easing: "ease-out" },
				],
			};
		case "pop-in":
			return {
				"transform.scale": [
					{ time: 0, value: 0.8, easing: "ease-out" },
					{ time: presetDuration * 0.7, value: 1.1, easing: "ease-out" },
					{
						time: presetDuration,
						value: baseTransform.scale,
						easing: "ease-in-out",
					},
				],
				opacity: [
					{ time: 0, value: 0, easing: "linear" },
					{ time: presetDuration * 0.4, value: baseOpacity, easing: "linear" },
				],
			};
	}
}

function validateKeyframe({
	keyframe,
	duration,
}: {
	keyframe: AnimationKeyframe;
	duration: number;
}): AnimationKeyframe {
	if (keyframe.time < 0) {
		throw new Error("Keyframe time cannot be negative");
	}
	if (keyframe.time > duration) {
		throw new Error(
			`Keyframe time ${keyframe.time} exceeds element duration ${duration}`,
		);
	}

	return {
		time: keyframe.time,
		value: keyframe.value,
		easing: keyframe.easing ?? DEFAULT_EASING,
	};
}
