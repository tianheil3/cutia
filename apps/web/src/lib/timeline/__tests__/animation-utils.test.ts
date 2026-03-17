import { describe, expect, test } from "bun:test";
import {
	normalizeKeyframes,
	resolveAnimatedOpacity,
	resolveAnimatedTransform,
} from "../animation-utils";

describe("normalizeKeyframes", () => {
	test("sorts keyframes and keeps the last duplicate timestamp", () => {
		expect(
			normalizeKeyframes([
				{ time: 1, value: 10 },
				{ time: 0, value: 0 },
				{ time: 1, value: 20 },
			]),
		).toEqual([
			{ time: 0, value: 0, easing: "linear" },
			{ time: 1, value: 20, easing: "linear" },
		]);
	});
});

describe("resolveAnimatedOpacity", () => {
	test("returns the base opacity when no animations exist", () => {
		expect(
			resolveAnimatedOpacity({
				baseOpacity: 0.75,
				animations: undefined,
				localTime: 0.5,
			}),
		).toBe(0.75);
	});

	test("interpolates opacity linearly between keyframes", () => {
		expect(
			resolveAnimatedOpacity({
				baseOpacity: 1,
				animations: {
					opacity: [
						{ time: 0, value: 0 },
						{ time: 1, value: 1 },
					],
				},
				localTime: 0.5,
			}),
		).toBe(0.5);
	});

	test("holds the previous value when easing is hold", () => {
		expect(
			resolveAnimatedOpacity({
				baseOpacity: 1,
				animations: {
					opacity: [
						{ time: 0, value: 0, easing: "hold" },
						{ time: 1, value: 1 },
					],
				},
				localTime: 0.5,
			}),
		).toBe(0);
	});
});

describe("resolveAnimatedTransform", () => {
	test("updates only the animated transform channels", () => {
		expect(
			resolveAnimatedTransform({
				baseTransform: {
					scale: 1,
					position: { x: 10, y: 20 },
					rotate: 0,
				},
				animations: {
					"transform.position.x": [
						{ time: 0, value: 10 },
						{ time: 1, value: 50 },
					],
					"transform.scale": [
						{ time: 0, value: 1 },
						{ time: 1, value: 2 },
					],
				},
				localTime: 0.5,
			}),
		).toEqual({
			scale: 1.5,
			position: { x: 30, y: 20 },
			rotate: 0,
		});
	});
});
