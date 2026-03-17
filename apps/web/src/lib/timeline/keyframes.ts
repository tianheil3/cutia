import type {
	AnimatableProperty,
	ElementKeyframe,
	ElementKeyframeMap,
	KeyframeCapableElement,
	KeyframeInterpolation,
	TimelineElement,
	Transform,
} from "@/types/timeline";
import { generateUUID } from "@/utils/id";

const DEFAULT_INTERPOLATION: KeyframeInterpolation = "linear";

export const SUPPORTED_KEYFRAME_PROPERTIES: AnimatableProperty[] = [
	"positionX",
	"positionY",
	"scale",
	"rotate",
	"opacity",
];

type KeyframeMutation = {
	property: AnimatableProperty;
	time: number;
	value: number;
	interpolation?: KeyframeInterpolation;
	keyframeId?: string;
};

type KeyframeSelector = {
	property: AnimatableProperty;
	time: number;
};

export function canElementHaveKeyframes(
	element: TimelineElement,
): element is KeyframeCapableElement {
	return element.type !== "audio";
}

export function normalizeElementKeyframes({
	keyframes,
}: {
	keyframes?: ElementKeyframeMap;
}): ElementKeyframeMap {
	const normalized: ElementKeyframeMap = {};

	for (const property of SUPPORTED_KEYFRAME_PROPERTIES) {
		const entries = keyframes?.[property];
		if (!entries || entries.length === 0) continue;
		normalized[property] = sortKeyframes({
			keyframes: entries.map(normalizeKeyframe),
		});
	}

	return normalized;
}

export function hasAnyKeyframes({
	keyframes,
}: {
	keyframes?: ElementKeyframeMap;
}): boolean {
	return Object.values(normalizeElementKeyframes({ keyframes })).some(
		(entries) => (entries?.length ?? 0) > 0,
	);
}

export function resolveKeyframedValue({
	defaultValue,
	time,
	keyframes,
}: {
	defaultValue: number;
	time: number;
	keyframes?: ElementKeyframe[];
}): number {
	const normalized = sortKeyframes({
		keyframes: (keyframes ?? []).map(normalizeKeyframe),
	});

	if (normalized.length === 0) {
		return defaultValue;
	}

	const currentTime = Math.max(0, time);
	const firstKeyframe = normalized[0];
	if (currentTime < firstKeyframe.time) {
		return defaultValue;
	}

	let previous = firstKeyframe;
	if (currentTime === previous.time) {
		return previous.value;
	}

	for (let index = 1; index < normalized.length; index++) {
		const next = normalized[index];

		if (currentTime === next.time) {
			return next.value;
		}

		if (currentTime < next.time) {
			if (previous.interpolation === "hold") {
				return previous.value;
			}

			const duration = next.time - previous.time;
			if (duration <= 0) {
				return next.value;
			}

			const progress = (currentTime - previous.time) / duration;
			return previous.value + (next.value - previous.value) * progress;
		}

		previous = next;
	}

	return previous.value;
}

export function resolveAnimatedElementState({
	baseTransform,
	baseOpacity,
	keyframes,
	time,
}: {
	baseTransform: Transform;
	baseOpacity: number;
	keyframes?: ElementKeyframeMap;
	time: number;
}): {
	transform: Transform;
	opacity: number;
} {
	const normalized = normalizeElementKeyframes({ keyframes });

	return {
		transform: {
			...baseTransform,
			scale: resolveKeyframedValue({
				defaultValue: baseTransform.scale,
				time,
				keyframes: normalized.scale,
			}),
			position: {
				x: resolveKeyframedValue({
					defaultValue: baseTransform.position.x,
					time,
					keyframes: normalized.positionX,
				}),
				y: resolveKeyframedValue({
					defaultValue: baseTransform.position.y,
					time,
					keyframes: normalized.positionY,
				}),
			},
			rotate: resolveKeyframedValue({
				defaultValue: baseTransform.rotate,
				time,
				keyframes: normalized.rotate,
			}),
		},
		opacity: resolveKeyframedValue({
			defaultValue: baseOpacity,
			time,
			keyframes: normalized.opacity,
		}),
	};
}

export function setElementKeyframes({
	existing,
	duration,
	keyframes,
}: {
	existing?: ElementKeyframeMap;
	duration: number;
	keyframes: KeyframeMutation[];
}): ElementKeyframeMap {
	const next = normalizeElementKeyframes({ keyframes: existing });

	for (const mutation of keyframes) {
		assertValidKeyframeTime({ time: mutation.time, duration });

		const propertyKeyframes = [...(next[mutation.property] ?? [])];
		const matchedKeyframe = mutation.keyframeId
			? propertyKeyframes.find((entry) => entry.id === mutation.keyframeId)
			: propertyKeyframes.find((entry) => entry.time === mutation.time);

		if (mutation.keyframeId && !matchedKeyframe) {
			throw new Error(
				`Keyframe '${mutation.keyframeId}' not found for property '${mutation.property}'`,
			);
		}

		const updatedKeyframe: ElementKeyframe = matchedKeyframe
			? {
					...matchedKeyframe,
					time: mutation.time,
					value: mutation.value,
					interpolation:
						mutation.interpolation ??
						matchedKeyframe.interpolation ??
						DEFAULT_INTERPOLATION,
				}
			: {
					id: generateUUID(),
					time: mutation.time,
					value: mutation.value,
					interpolation: mutation.interpolation ?? DEFAULT_INTERPOLATION,
				};

		next[mutation.property] = sortKeyframes({
			keyframes: [
				...propertyKeyframes.filter(
					(entry) =>
						entry.id !== matchedKeyframe?.id && entry.time !== mutation.time,
				),
				updatedKeyframe,
			],
		});
	}

	return pruneEmptyKeyframeMap({ keyframes: next });
}

export function deleteElementKeyframes({
	existing,
	keyframeIds,
	selectors,
}: {
	existing?: ElementKeyframeMap;
	keyframeIds?: string[];
	selectors?: KeyframeSelector[];
}): ElementKeyframeMap {
	const normalized = normalizeElementKeyframes({ keyframes: existing });
	const keyframeIdSet = new Set(keyframeIds ?? []);
	const selectorSet = new Set(
		(selectors ?? []).map((selector) => buildSelectorKey({ selector })),
	);

	const next: ElementKeyframeMap = {};

	for (const property of SUPPORTED_KEYFRAME_PROPERTIES) {
		const keyframesForProperty = normalized[property];
		if (!keyframesForProperty || keyframesForProperty.length === 0) continue;

		const filtered = keyframesForProperty.filter((keyframe) => {
			if (keyframeIdSet.has(keyframe.id)) {
				return false;
			}

			return !selectorSet.has(
				buildSelectorKey({
					selector: { property, time: keyframe.time },
				}),
			);
		});

		if (filtered.length > 0) {
			next[property] = filtered;
		}
	}

	return next;
}

function assertValidKeyframeTime({
	time,
	duration,
}: {
	time: number;
	duration: number;
}): void {
	if (!Number.isFinite(time)) {
		throw new Error("Keyframe time must be a finite number");
	}

	if (time < 0 || time > duration) {
		throw new Error(
			`Keyframe time ${time} is outside the element duration ${duration}`,
		);
	}
}

function normalizeKeyframe(keyframe: ElementKeyframe): ElementKeyframe {
	return {
		...keyframe,
		interpolation: keyframe.interpolation ?? DEFAULT_INTERPOLATION,
	};
}

function sortKeyframes({
	keyframes,
}: {
	keyframes: ElementKeyframe[];
}): ElementKeyframe[] {
	return [...keyframes].sort((left, right) => {
		if (left.time !== right.time) {
			return left.time - right.time;
		}

		return left.id.localeCompare(right.id);
	});
}

function pruneEmptyKeyframeMap({
	keyframes,
}: {
	keyframes: ElementKeyframeMap;
}): ElementKeyframeMap {
	const next: ElementKeyframeMap = {};

	for (const property of SUPPORTED_KEYFRAME_PROPERTIES) {
		const entries = keyframes[property];
		if (!entries || entries.length === 0) continue;
		next[property] = entries;
	}

	return next;
}

function buildSelectorKey({
	selector,
}: {
	selector: KeyframeSelector;
}): string {
	return `${selector.property}:${selector.time}`;
}
