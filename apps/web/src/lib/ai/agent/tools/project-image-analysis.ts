import type { MediaAsset } from "@/types/assets";
import type { AgentTool } from "./types";

const DEFAULT_IMAGE_ANALYSIS_LIMIT = 3;
export const PROJECT_IMAGE_ANALYSIS_PROMPT = `Analyze this project image and describe the parts that are most useful for an AI video editing assistant. Include:
1. The main subject, scene, or focal objects
2. Composition and framing
3. Any visible text, logo, UI, or branding
4. Visual style, color palette, and mood
5. Editing-relevant cues such as whether it looks like a cover image, screenshot, product shot, background plate, or reference art

Write the answer as a concise but specific paragraph focused on what another AI should know before editing or generating related content.`;

type BlobToDataUrlFn = ({
	blob,
}: {
	blob: Blob;
}) => Promise<string>;

type AnalyzeImageFn = ({
	imageDataUrl,
	analysisPrompt,
}: {
	imageDataUrl: string;
	analysisPrompt: string;
}) => Promise<string>;

async function defaultToDataUrl({
	blob,
}: {
	blob: Blob;
}): Promise<string> {
	const { blobToDataUrl } = await import("@/lib/ai/vision");
	return blobToDataUrl({ blob });
}

async function defaultAnalyzeImage({
	imageDataUrl,
	analysisPrompt,
}: {
	imageDataUrl: string;
	analysisPrompt: string;
}): Promise<string> {
	const { analyzeImageWithVision } = await import("@/lib/ai/vision");
	return analyzeImageWithVision({ imageDataUrl, analysisPrompt });
}

function getImageAssets({
	assets,
}: {
	assets: MediaAsset[];
}): MediaAsset[] {
	return assets.filter((asset) => asset.type === "image");
}

function normalizeMediaIds({ mediaIds }: { mediaIds: unknown }): string[] {
	if (!Array.isArray(mediaIds)) {
		return [];
	}

	return mediaIds.filter((value): value is string => typeof value === "string");
}

export function buildProjectImageAnalysisPrompt({
	question,
}: {
	question?: string;
}): string {
	const trimmedQuestion = question?.trim();
	if (!trimmedQuestion) {
		return PROJECT_IMAGE_ANALYSIS_PROMPT;
	}

	return `${PROJECT_IMAGE_ANALYSIS_PROMPT}\n\nFocus on this question: ${trimmedQuestion}`;
}

export function createAnalyzeProjectImagesTool({
	getAssets,
	toDataUrl = defaultToDataUrl,
	analyzeImage = defaultAnalyzeImage,
}: {
	getAssets: () => MediaAsset[];
	toDataUrl?: BlobToDataUrlFn;
	analyzeImage?: AnalyzeImageFn;
}): AgentTool {
	return {
		name: "analyze_project_images",
		description:
			"Analyze image assets from the current project and describe their visual content.",
		parameters: {
			type: "object",
			properties: {
				mediaIds: {
					type: "array",
					items: {
						type: "string",
					},
					description:
						"Optional list of image media asset IDs to analyze. If omitted, the tool analyzes the current project's image assets.",
				},
				question: {
					type: "string",
					description:
						"Optional analysis focus, such as what to extract or compare from the image.",
				},
			},
			required: [],
		},
		async execute(args) {
			const assets = getAssets();
			const imageAssets = getImageAssets({ assets });

			if (imageAssets.length === 0) {
				return {
					success: false,
					message: "No image assets are available in the current project.",
				};
			}

			const mediaIds = normalizeMediaIds({ mediaIds: args.mediaIds });
			const requestedIds =
				mediaIds.length > 0 ? new Set(mediaIds) : null;

			let targetAssets = requestedIds
				? imageAssets.filter((asset) => requestedIds.has(asset.id))
				: imageAssets;
			let truncated = false;

			if (targetAssets.length === 0) {
				return {
					success: false,
					message:
						"No image assets matched the requested mediaIds. Use list_media_assets to inspect available IDs first.",
				};
			}

			if (!requestedIds && targetAssets.length > DEFAULT_IMAGE_ANALYSIS_LIMIT) {
				targetAssets = targetAssets.slice(0, DEFAULT_IMAGE_ANALYSIS_LIMIT);
				truncated = true;
			}

			try {
				const analysisPrompt = buildProjectImageAnalysisPrompt({
					question: typeof args.question === "string" ? args.question : undefined,
				});

				const analyzedAssets = await Promise.all(
					targetAssets.map(async (asset) => {
						const imageDataUrl = await toDataUrl({ blob: asset.file });
						const analysis = await analyzeImage({
							imageDataUrl,
							analysisPrompt,
						});

						return {
							id: asset.id,
							name: asset.name,
							width: asset.width,
							height: asset.height,
							analysis,
						};
					}),
				);

				return {
					success: true,
					message: truncated
						? `Analyzed ${analyzedAssets.length} image asset(s). Limited to the first ${DEFAULT_IMAGE_ANALYSIS_LIMIT} project images.`
						: `Analyzed ${analyzedAssets.length} image asset(s).`,
					data: {
						assets: analyzedAssets,
						totalImageCount: imageAssets.length,
						truncated,
					},
				};
			} catch (error) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to analyze project images.",
				};
			}
		},
	};
}
