import { createAnalyzeProjectImagesTool } from "../src/lib/ai/agent/tools/project-image-analysis";

function requireEnv(name: "API_BASE_URL" | "API_KEY" | "API_MODEL"): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			"缺少真实 API 验证所需环境变量：API_BASE_URL、API_KEY、API_MODEL",
		);
	}
	return value;
}

const apiBaseUrl = requireEnv("API_BASE_URL");
const apiKey = requireEnv("API_KEY");
const apiModel = requireEnv("API_MODEL");

async function blobToDataUrl({ blob }: { blob: Blob }): Promise<string> {
	const buffer = Buffer.from(await blob.arrayBuffer());
	return `data:${blob.type || "image/png"};base64,${buffer.toString("base64")}`;
}

async function analyzeImage({
	imageDataUrl,
	analysisPrompt,
}: {
	imageDataUrl: string;
	analysisPrompt: string;
}): Promise<string> {
	const baseUrl = apiBaseUrl.replace(/\/+$/, "");
	let lastStatus = 0;
	for (let attempt = 0; attempt < 3; attempt++) {
		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: apiModel,
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: analysisPrompt },
							{
								type: "image_url",
								image_url: { url: imageDataUrl, detail: "high" },
							},
						],
					},
				],
				max_tokens: 512,
			}),
		});

		if (response.ok) {
			const data = (await response.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};

			return data.choices?.[0]?.message?.content?.trim() ?? "";
		}

		lastStatus = response.status;
		if (response.status !== 502 && response.status !== 503) {
			throw new Error(`视觉接口请求失败 (${response.status})`);
		}

		await Bun.sleep(300 * (attempt + 1));
	}

	throw new Error(`视觉接口请求失败 (${lastStatus})`);
}

async function main() {
	const samples = [
		{
			id: "sample-tiktok-blueprint",
			name: "tiktok-blueprint.png",
			path: "../public/platform-guides/tiktok-blueprint.png",
		},
		{
			id: "sample-favicon",
			name: "favicon-32x32.png",
			path: "../public/icons/favicon-32x32.png",
		},
	] as const;

	let lastError: Error | null = null;

	for (const sample of samples) {
		const sampleFile = Bun.file(new URL(sample.path, import.meta.url));
		const sampleBlob = await sampleFile.arrayBuffer();

		const tool = createAnalyzeProjectImagesTool({
			getAssets: () => [
				{
					id: sample.id,
					name: sample.name,
					type: "image",
					file: new File([sampleBlob], sample.name, {
						type: "image/png",
					}),
				},
			],
			toDataUrl: blobToDataUrl,
			analyzeImage,
		});

		const result = await tool.execute({
			question:
				"请用中文简要说明这张图里的主要内容，以及它看起来属于什么类型的项目素材。",
		});

		if (!result.success) {
			lastError = new Error(`${sample.name}: ${result.message}`);
			continue;
		}

		const assets = (result.data?.assets as Array<
			| {
					id: string;
					name: string;
					analysis: string;
			  }
			| undefined
		>) ?? [];
		const firstAsset = assets[0];

		if (!firstAsset?.analysis) {
			lastError = new Error(`${sample.name}: 视觉接口返回成功，但没有得到图片内容描述`);
			continue;
		}

		console.log(
			JSON.stringify(
				{
					analyzedCount: assets.length,
					assetName: firstAsset.name,
					fallbackUsed: sample.name !== "tiktok-blueprint.png",
					analysisPreview: firstAsset.analysis.slice(0, 160),
				},
				null,
				2,
			),
		);
		return;
	}

	throw lastError ?? new Error("没有任何图片样本通过真实 API 视觉验证");
}

await main();
