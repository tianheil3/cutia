import { beforeEach, describe, expect, mock, test } from "bun:test";

type FakeMediaAsset = {
	id: string;
	name: string;
	type: "image" | "video" | "audio";
	file: File;
	width?: number;
	height?: number;
	duration?: number;
};

const currentAssets: FakeMediaAsset[] = [];
const visionCalls: Array<{
	imageDataUrl: string;
	analysisPrompt: string;
}> = [];

function createFakeAsset({
	id,
	name,
	type,
}: {
	id: string;
	name: string;
	type: "image" | "video" | "audio";
}): FakeMediaAsset {
	return {
		id,
		name,
		type,
		file: new File([`${name}-content`], name, {
			type:
				type === "image"
					? "image/png"
					: type === "audio"
						? "audio/mpeg"
						: "video/mp4",
		}),
		width: type === "image" ? 1280 : undefined,
		height: type === "image" ? 720 : undefined,
		duration: type !== "image" ? 3 : undefined,
	};
}

mock.module("@/core", () => ({
	EditorCore: {
		getInstance() {
			return {
				media: {
					getAssets() {
						return currentAssets;
					},
				},
			};
		},
	},
}));

mock.module("@/lib/ai/vision", () => ({
	PROJECT_IMAGE_ANALYSIS_PROMPT:
		"Describe the current project image for video editing use.",
	blobToDataUrl: async ({ blob }: { blob: Blob }) =>
		`data:${blob.type || "image/png"};base64,stub`,
	analyzeImageWithVision: async ({
		imageDataUrl,
		analysisPrompt,
	}: {
		imageDataUrl: string;
		analysisPrompt: string;
	}) => {
		visionCalls.push({ imageDataUrl, analysisPrompt });
		return `analysis:${analysisPrompt}`;
	},
}));

describe("media tools", () => {
	beforeEach(() => {
		currentAssets.length = 0;
		visionCalls.length = 0;
	});

	test("exposes a tool for analyzing current project images", async () => {
		const { mediaTools } = await import("./media-tools");

		expect(
			mediaTools.some((tool) => tool.name === "analyze_project_images"),
		).toBe(true);
	});

	test("fails when the current project has no image assets", async () => {
		currentAssets.push(
			createFakeAsset({ id: "audio-1", name: "beat.mp3", type: "audio" }),
		);

		const { analyzeProjectImagesTool } = await import("./media-tools");
		const result = await analyzeProjectImagesTool.execute({});

		expect(result.success).toBe(false);
		expect(result.message).toContain("No image assets");
		expect(visionCalls).toHaveLength(0);
	});

	test("analyzes current project images when mediaIds are omitted", async () => {
		currentAssets.push(
			createFakeAsset({ id: "image-1", name: "cover.png", type: "image" }),
			createFakeAsset({ id: "video-1", name: "intro.mp4", type: "video" }),
			createFakeAsset({ id: "image-2", name: "scene.png", type: "image" }),
		);

		const { analyzeProjectImagesTool } = await import("./media-tools");
		const result = await analyzeProjectImagesTool.execute({});

		expect(result.success).toBe(true);
		expect(visionCalls).toHaveLength(2);
		expect(result.data?.assets).toEqual([
			expect.objectContaining({ id: "image-1", name: "cover.png" }),
			expect.objectContaining({ id: "image-2", name: "scene.png" }),
		]);
	});

	test("filters by mediaIds and appends the question to the vision prompt", async () => {
		currentAssets.push(
			createFakeAsset({ id: "image-1", name: "cover.png", type: "image" }),
			createFakeAsset({ id: "image-2", name: "scene.png", type: "image" }),
		);

		const { analyzeProjectImagesTool } = await import("./media-tools");
		const result = await analyzeProjectImagesTool.execute({
			mediaIds: ["image-2"],
			question: "重点看图里有没有文字和品牌元素",
		});

		expect(result.success).toBe(true);
		expect(visionCalls).toHaveLength(1);
		expect(visionCalls[0]?.analysisPrompt).toContain(
			"重点看图里有没有文字和品牌元素",
		);
		expect(result.data?.assets).toEqual([
			expect.objectContaining({ id: "image-2", name: "scene.png" }),
		]);
	});
});
