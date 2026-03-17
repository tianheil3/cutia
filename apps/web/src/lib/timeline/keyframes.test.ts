import { describe, expect, test } from "bun:test";
import {
	deleteElementKeyframes,
	resolveAnimatedElementState,
	resolveKeyframedValue,
	setElementKeyframes,
} from "./keyframes";

describe("timeline keyframes", () => {
	test("interpolates opacity between two linear keyframes", () => {
		const value = resolveKeyframedValue({
			defaultValue: 1,
			time: 1,
			keyframes: [
				{ id: "kf-1", time: 0, value: 0, interpolation: "linear" },
				{ id: "kf-2", time: 2, value: 1, interpolation: "linear" },
			],
		});

		expect(value).toBe(0.5);
	});

	test("keeps the previous value when interpolation is hold", () => {
		const value = resolveKeyframedValue({
			defaultValue: 1,
			time: 1,
			keyframes: [
				{ id: "kf-1", time: 0, value: 10, interpolation: "hold" },
				{ id: "kf-2", time: 2, value: 30, interpolation: "linear" },
			],
		});

		expect(value).toBe(10);
	});

	test("sorts and replaces keyframes at the same property/time", () => {
		const result = setElementKeyframes({
			existing: {
				opacity: [{ id: "old", time: 1, value: 0.4, interpolation: "linear" }],
			},
			duration: 5,
			keyframes: [
				{ property: "opacity", time: 3, value: 0.8, interpolation: "linear" },
				{ property: "opacity", time: 1, value: 0.6, interpolation: "hold" },
			],
		});

		expect(result.opacity).toEqual([
			{ id: "old", time: 1, value: 0.6, interpolation: "hold" },
			{
				id: expect.any(String),
				time: 3,
				value: 0.8,
				interpolation: "linear",
			},
		]);
	});

	test("deletes keyframes by id", () => {
		const result = deleteElementKeyframes({
			existing: {
				opacity: [
					{ id: "remove-me", time: 0, value: 0, interpolation: "linear" },
					{ id: "keep-me", time: 1, value: 1, interpolation: "linear" },
				],
			},
			keyframeIds: ["remove-me"],
		});

		expect(result.opacity).toEqual([
			{ id: "keep-me", time: 1, value: 1, interpolation: "linear" },
		]);
	});

	test("resolves animated transform and opacity together", () => {
		const state = resolveAnimatedElementState({
			baseTransform: {
				scale: 1,
				position: { x: 0, y: 10 },
				rotate: 0,
			},
			baseOpacity: 1,
			time: 1,
			keyframes: {
				positionX: [
					{ id: "x-1", time: 0, value: 0, interpolation: "linear" },
					{ id: "x-2", time: 2, value: 200, interpolation: "linear" },
				],
				opacity: [
					{ id: "o-1", time: 0, value: 1, interpolation: "linear" },
					{ id: "o-2", time: 2, value: 0, interpolation: "linear" },
				],
			},
		});

		expect(state.transform.position.x).toBe(100);
		expect(state.transform.position.y).toBe(10);
		expect(state.opacity).toBe(0.5);
	});
});
