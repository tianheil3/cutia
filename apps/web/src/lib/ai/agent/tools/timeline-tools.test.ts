import { describe, expect, test } from "bun:test";

const timelineToolsSource = await Bun.file(
	new URL("./timeline-tools.ts", import.meta.url),
).text();

describe("timeline AI tools", () => {
	test("exposes animation operations", () => {
		expect(timelineToolsSource).toContain('name: "get_element_animations"');
		expect(timelineToolsSource).toContain('name: "add_keyframes"');
		expect(timelineToolsSource).toContain('name: "remove_keyframes"');
		expect(timelineToolsSource).toContain('name: "set_animation_preset"');
	});

	test("add_keyframes schema accepts animations property paths", () => {
		expect(timelineToolsSource).toContain('name: "add_keyframes"');
		expect(timelineToolsSource).toContain("keyframes:");
		expect(timelineToolsSource).toContain('property: {');
		expect(timelineToolsSource).toContain('time: {');
		expect(timelineToolsSource).toContain('value: {');
		expect(timelineToolsSource).toContain('easing: {');
		expect(timelineToolsSource).toContain('required: ["time", "value"]');
		expect(timelineToolsSource).toContain(
			'required: ["trackId", "elementId", "property", "keyframes"]',
		);
	});

	test("animation preset tool exposes the expected preset names", () => {
		expect(timelineToolsSource).toContain('"fade-in"');
		expect(timelineToolsSource).toContain('"fade-out"');
		expect(timelineToolsSource).toContain('"slide-in-left"');
		expect(timelineToolsSource).toContain('"slide-in-right"');
		expect(timelineToolsSource).toContain('"slide-in-up"');
		expect(timelineToolsSource).toContain('"slide-in-down"');
		expect(timelineToolsSource).toContain('"zoom-in"');
		expect(timelineToolsSource).toContain('"zoom-out"');
		expect(timelineToolsSource).toContain('"pop-in"');
	});
});
