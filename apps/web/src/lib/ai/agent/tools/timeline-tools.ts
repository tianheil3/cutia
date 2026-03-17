import { EditorCore } from "@/core";
import {
	ANIMATABLE_PROPERTIES,
	canElementHaveAnimations,
	hasAnimations,
	normalizeAnimations,
	type AnimationPreset,
} from "@/lib/timeline/animation-utils";
import {
	buildVideoElement,
	buildImageElement,
	buildTextElement,
	buildUploadAudioElement,
} from "@/lib/timeline/element-utils";
import type {
	AnimatableProperty,
	AnimationEasing,
	TimelineElement,
} from "@/types/timeline";
import type { AgentTool } from "./types";

function getElementFromTrack({
	trackId,
	elementId,
}: {
	trackId: string;
	elementId: string;
}):
	| {
			element: TimelineElement;
	  }
	| {
			error: string;
	  } {
	const editor = EditorCore.getInstance();
	const track = editor.timeline.getTrackById({ trackId });
	if (!track) {
		return { error: `Track '${trackId}' not found` };
	}

	const element = track.elements.find((candidate) => candidate.id === elementId);
	if (!element) {
		return { error: `Element '${elementId}' not found in track '${trackId}'` };
	}

	return { element };
}

export const getTimelineStateTool: AgentTool = {
	name: "get_timeline_state",
	description:
		"Get the current timeline state including all tracks and their elements with timing and animation information.",
	parameters: {
		type: "object",
		properties: {},
		required: [],
	},
	async execute() {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		const duration = editor.timeline.getTotalDuration();

		const trackDetails = tracks.map((track) => ({
			id: track.id,
			type: track.type,
			name: track.name,
			isMain: "isMain" in track ? track.isMain : false,
			elements: track.elements.map((element) => ({
				id: element.id,
				type: element.type,
				name: element.name,
				startTime: element.startTime,
				duration: element.duration,
				trimStart: element.trimStart,
				trimEnd: element.trimEnd,
				...("content" in element ? { content: element.content } : {}),
				...("mediaId" in element ? { mediaId: element.mediaId } : {}),
				...("transform" in element ? { transform: element.transform } : {}),
				...("opacity" in element ? { opacity: element.opacity } : {}),
				...(canElementHaveAnimations(element) &&
				hasAnimations({ animations: element.animations })
					? {
							animations: normalizeAnimations({
								animations: element.animations,
							}),
						}
					: {}),
			})),
		}));

		return {
			success: true,
			message: `Timeline has ${tracks.length} track(s), total duration: ${duration.toFixed(2)}s`,
			data: { tracks: trackDetails, totalDuration: duration },
		};
	},
};

const getElementAnimationsTool: AgentTool = {
	name: "get_element_animations",
	description:
		"Get the current animation state for a visual timeline element. Animation times are relative to the element start.",
	parameters: {
		type: "object",
		properties: {
			trackId: {
				type: "string",
				description: "The track ID containing the element",
			},
			elementId: {
				type: "string",
				description: "The element ID to inspect",
			},
		},
		required: ["trackId", "elementId"],
	},
	async execute(args) {
		const trackId = args.trackId as string;
		const elementId = args.elementId as string;
		const result = getElementFromTrack({ trackId, elementId });
		if ("error" in result) return { success: false, message: result.error };

		const { element } = result;
		if (!canElementHaveAnimations(element)) {
			return {
				success: false,
				message: `Element '${elementId}' of type '${element.type}' does not support animations`,
			};
		}

		return {
			success: true,
			message: `Loaded animations for '${element.name}'`,
			data: {
				supportedProperties: ANIMATABLE_PROPERTIES,
				transform: element.transform,
				opacity: element.opacity,
				animations: normalizeAnimations({ animations: element.animations }),
			},
		};
	},
};

const addKeyframesTool: AgentTool = {
	name: "add_keyframes",
	description:
		"Add or overwrite keyframes for one animatable property on a visual timeline element.",
	parameters: {
		type: "object",
		properties: {
			trackId: {
				type: "string",
				description: "The track ID containing the element",
			},
			elementId: {
				type: "string",
				description: "The element ID to update",
			},
			property: {
				type: "string",
				enum: ANIMATABLE_PROPERTIES,
				description: "Animatable property to update",
			},
			keyframes: {
				type: "array",
				description:
					"Keyframes to add. Duplicate timestamps overwrite the previous value.",
				items: {
					type: "object",
					properties: {
						time: {
							type: "number",
							description:
								"Local time in seconds relative to the element start",
						},
						value: {
							type: "number",
							description: "Numeric value for the property at this time",
						},
						easing: {
							type: "string",
							enum: ["linear", "ease-in", "ease-out", "ease-in-out", "hold"],
							description: "Easing mode from this keyframe until the next one",
						},
					},
					required: ["time", "value"],
				},
			},
		},
		required: ["trackId", "elementId", "property", "keyframes"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const trackId = args.trackId as string;
		const elementId = args.elementId as string;
		const property = args.property as AnimatableProperty;
		const keyframes = (args.keyframes as Array<Record<string, unknown>>) ?? [];
		const result = getElementFromTrack({ trackId, elementId });
		if ("error" in result) return { success: false, message: result.error };

		const { element } = result;
		if (!canElementHaveAnimations(element)) {
			return {
				success: false,
				message: `Element '${elementId}' of type '${element.type}' does not support animations`,
			};
		}
		if (keyframes.length === 0) {
			return { success: false, message: "No keyframes provided" };
		}

		try {
			editor.timeline.addKeyframes({
				trackId,
				elementId,
				property,
				keyframes: keyframes.map((keyframe) => ({
					time: keyframe.time as number,
					value: keyframe.value as number,
					easing: keyframe.easing as AnimationEasing | undefined,
				})),
			});
		} catch (error) {
			return {
				success: false,
				message:
					error instanceof Error ? error.message : "Failed to add keyframes",
			};
		}

		const refreshed = getElementFromTrack({ trackId, elementId });
		if ("error" in refreshed) return { success: false, message: refreshed.error };

		return {
			success: true,
			message: `Added keyframes to '${refreshed.element.name}'`,
			data: {
				animations: normalizeAnimations({
					animations:
						canElementHaveAnimations(refreshed.element)
							? refreshed.element.animations
							: undefined,
				}),
			},
		};
	},
};

const removeKeyframesTool: AgentTool = {
	name: "remove_keyframes",
	description:
		"Remove all keyframes for a property or only the keyframes at specific timestamps.",
	parameters: {
		type: "object",
		properties: {
			trackId: {
				type: "string",
				description: "The track ID containing the element",
			},
			elementId: {
				type: "string",
				description: "The element ID to update",
			},
			property: {
				type: "string",
				enum: ANIMATABLE_PROPERTIES,
				description: "Animatable property to clear or edit",
			},
			times: {
				type: "array",
				description:
					"Specific local timestamps to remove. Omit to remove the entire property animation track.",
				items: {
					type: "number",
				},
			},
		},
		required: ["trackId", "elementId", "property"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const trackId = args.trackId as string;
		const elementId = args.elementId as string;
		const property = args.property as AnimatableProperty;
		const result = getElementFromTrack({ trackId, elementId });
		if ("error" in result) return { success: false, message: result.error };

		const { element } = result;
		if (!canElementHaveAnimations(element)) {
			return {
				success: false,
				message: `Element '${elementId}' of type '${element.type}' does not support animations`,
			};
		}

		editor.timeline.removeKeyframes({
			trackId,
			elementId,
			property,
			times: args.times as number[] | undefined,
		});

		const refreshed = getElementFromTrack({ trackId, elementId });
		if ("error" in refreshed) return { success: false, message: refreshed.error };

		return {
			success: true,
			message: `Removed keyframes from '${refreshed.element.name}'`,
			data: {
				animations: normalizeAnimations({
					animations:
						canElementHaveAnimations(refreshed.element)
							? refreshed.element.animations
							: undefined,
				}),
			},
		};
	},
};

const setAnimationPresetTool: AgentTool = {
	name: "set_animation_preset",
	description:
		"Apply a common motion preset to a visual element without manually specifying every keyframe.",
	parameters: {
		type: "object",
		properties: {
			trackId: {
				type: "string",
				description: "The track ID containing the element",
			},
			elementId: {
				type: "string",
				description: "The element ID to update",
			},
			preset: {
				type: "string",
				enum: [
					"fade-in",
					"fade-out",
					"slide-in-left",
					"slide-in-right",
					"slide-in-up",
					"slide-in-down",
					"zoom-in",
					"zoom-out",
					"pop-in",
				],
				description: "Preset animation name",
			},
			duration: {
				type: "number",
				description:
					"Optional preset duration in seconds. Defaults to a short motion segment capped by the element duration.",
			},
		},
		required: ["trackId", "elementId", "preset"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const trackId = args.trackId as string;
		const elementId = args.elementId as string;
		const preset = args.preset as AnimationPreset;
		const result = getElementFromTrack({ trackId, elementId });
		if ("error" in result) return { success: false, message: result.error };

		const { element } = result;
		if (!canElementHaveAnimations(element)) {
			return {
				success: false,
				message: `Element '${elementId}' of type '${element.type}' does not support animations`,
			};
		}

		editor.timeline.setAnimationPreset({
			trackId,
			elementId,
			preset,
			duration: args.duration as number | undefined,
		});

		const refreshed = getElementFromTrack({ trackId, elementId });
		if ("error" in refreshed) return { success: false, message: refreshed.error };

		return {
			success: true,
			message: `Applied preset '${preset}' to '${refreshed.element.name}'`,
			data: {
				animations: normalizeAnimations({
					animations:
						canElementHaveAnimations(refreshed.element)
							? refreshed.element.animations
							: undefined,
				}),
			},
		};
	},
};

export const addVideoToTimelineTool: AgentTool = {
	name: "add_video_to_timeline",
	description:
		"Add a video or image media asset to the timeline. The media must already exist in the project's media library. Use list_media_assets to find available media IDs.",
	parameters: {
		type: "object",
		properties: {
			mediaId: {
				type: "string",
				description: "The ID of the media asset to add",
			},
			startTime: {
				type: "number",
				description: "Start time in seconds on the timeline (default: 0)",
			},
			duration: {
				type: "number",
				description:
					"Duration in seconds. For videos, defaults to the media's original duration. For images, defaults to 5 seconds.",
			},
		},
		required: ["mediaId"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const mediaId = args.mediaId as string;
		const startTime = (args.startTime as number) ?? 0;

		const assets = editor.media.getAssets();
		const asset = assets.find((item) => item.id === mediaId);
		if (!asset) {
			return { success: false, message: `Media asset '${mediaId}' not found` };
		}

		const isVideo = asset.type === "video";
		const isImage = asset.type === "image";
		if (!isVideo && !isImage) {
			return {
				success: false,
				message: `Media asset '${asset.name}' is type '${asset.type}', expected video or image`,
			};
		}

		const duration = (args.duration as number) ?? asset.duration ?? 5;

		const element = isVideo
			? buildVideoElement({ mediaId, name: asset.name, duration, startTime })
			: buildImageElement({ mediaId, name: asset.name, duration, startTime });

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});

		return {
			success: true,
			message: `Added ${asset.type} '${asset.name}' to timeline at ${startTime}s (duration: ${duration}s)`,
		};
	},
};

export const addTextToTimelineTool: AgentTool = {
	name: "add_text_to_timeline",
	description:
		"Add a text overlay element to the timeline with customizable content and styling.",
	parameters: {
		type: "object",
		properties: {
			content: {
				type: "string",
				description: "The text content to display",
			},
			startTime: {
				type: "number",
				description: "Start time in seconds on the timeline (default: 0)",
			},
			duration: {
				type: "number",
				description: "Duration in seconds (default: 5)",
			},
			fontSize: {
				type: "number",
				description:
					"Font size from 1 to 38. Rendered pixel size = fontSize × (canvasHeight / 90). On 1080p: Subtitle/caption: ~3-5, Normal text: ~6-10, Title: ~11-15, Large headline: ~16-25. Default: 15.",
			},
			fontFamily: {
				type: "string",
				description:
					"Font family name (default: 'Arial'). Common options: 'Arial', 'Inter', 'Times New Roman', 'Georgia', etc.",
			},
			fontWeight: {
				type: "string",
				description: "Font weight: 'normal' or 'bold' (default: 'normal')",
			},
			fontStyle: {
				type: "string",
				description: "Font style: 'normal' or 'italic' (default: 'normal')",
			},
			color: {
				type: "string",
				description: "Text color as hex string (default: '#ffffff')",
			},
			backgroundColor: {
				type: "string",
				description: "Background color as hex string (default: 'transparent')",
			},
			textAlign: {
				type: "string",
				description:
					"Text alignment: 'left', 'center', or 'right' (default: 'center')",
			},
			positionX: {
				type: "number",
				description:
					"Horizontal pixel offset from canvas center. 0 = center. Positive = right, negative = left.",
			},
			positionY: {
				type: "number",
				description:
					"Vertical pixel offset from canvas center. 0 = center. Positive = down, negative = up.",
			},
			scale: {
				type: "number",
				description: "Transform scale factor (default: 1)",
			},
			rotate: {
				type: "number",
				description: "Rotation angle in degrees (default: 0)",
			},
			opacity: {
				type: "number",
				description: "Element opacity from 0 to 1",
			},
		},
		required: ["content"],
	},
	async execute(args) {
		const content = args.content as string;
		const startTime = (args.startTime as number) ?? 0;

		const element = buildTextElement({
			raw: {
				content,
				duration: (args.duration as number) ?? 5,
				fontSize: args.fontSize as number | undefined,
				fontFamily: args.fontFamily as string | undefined,
				fontWeight: args.fontWeight as "normal" | "bold" | undefined,
				fontStyle: args.fontStyle as "normal" | "italic" | undefined,
				color: args.color as string | undefined,
				backgroundColor: args.backgroundColor as string | undefined,
				textAlign: args.textAlign as "left" | "center" | "right" | undefined,
				opacity: args.opacity as number | undefined,
				transform: {
					scale: (args.scale as number) ?? 1,
					position: {
						x: (args.positionX as number) ?? 0,
						y: (args.positionY as number) ?? 0,
					},
					rotate: (args.rotate as number) ?? 0,
				},
			},
			startTime,
		});

		const editor = EditorCore.getInstance();
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});

		return {
			success: true,
			message: `Added text '${content.slice(0, 30)}${content.length > 30 ? "..." : ""}' at ${startTime}s`,
		};
	},
};

export const addAudioToTimelineTool: AgentTool = {
	name: "add_audio_to_timeline",
	description:
		"Add an audio media asset to the timeline. The audio must already exist in the project's media library.",
	parameters: {
		type: "object",
		properties: {
			mediaId: {
				type: "string",
				description: "The ID of the audio media asset to add",
			},
			startTime: {
				type: "number",
				description: "Start time in seconds on the timeline (default: 0)",
			},
			duration: {
				type: "number",
				description:
					"Duration in seconds (defaults to the audio's original duration)",
			},
		},
		required: ["mediaId"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const mediaId = args.mediaId as string;
		const startTime = (args.startTime as number) ?? 0;

		const assets = editor.media.getAssets();
		const asset = assets.find((item) => item.id === mediaId);
		if (!asset) {
			return { success: false, message: `Media asset '${mediaId}' not found` };
		}
		if (asset.type !== "audio") {
			return {
				success: false,
				message: `Media asset '${asset.name}' is type '${asset.type}', expected audio`,
			};
		}

		const duration = (args.duration as number) ?? asset.duration ?? 5;
		const element = buildUploadAudioElement({
			mediaId,
			name: asset.name,
			duration,
			startTime,
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});

		return {
			success: true,
			message: `Added audio '${asset.name}' at ${startTime}s (duration: ${duration}s)`,
		};
	},
};

export const updateElementTool: AgentTool = {
	name: "update_element",
	description:
		"Update static properties of an existing timeline element. Do not use this to edit animations.",
	parameters: {
		type: "object",
		properties: {
			trackId: { type: "string", description: "The track ID containing the element" },
			elementId: { type: "string", description: "The element ID to update" },
			content: {
				type: "string",
				description: "New text content (text elements only)",
			},
			fontSize: { type: "number", description: "Font size (text elements only)" },
			fontFamily: {
				type: "string",
				description: "Font family name (text elements only)",
			},
			fontWeight: {
				type: "string",
				description: "'normal' or 'bold' (text elements only)",
			},
			fontStyle: {
				type: "string",
				description: "'normal' or 'italic' (text elements only)",
			},
			color: {
				type: "string",
				description: "Text color as hex string (text elements only)",
			},
			backgroundColor: {
				type: "string",
				description: "Background color as hex string (text elements only)",
			},
			textAlign: {
				type: "string",
				description: "'left', 'center', or 'right' (text elements only)",
			},
			opacity: {
				type: "number",
				description: "Element opacity from 0 (transparent) to 1 (opaque)",
			},
			scale: {
				type: "number",
				description: "Transform scale factor",
			},
			positionX: {
				type: "number",
				description: "Horizontal pixel offset from canvas center",
			},
			positionY: {
				type: "number",
				description: "Vertical pixel offset from canvas center",
			},
			rotate: {
				type: "number",
				description: "Rotation angle in degrees",
			},
		},
		required: ["trackId", "elementId"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const trackId = args.trackId as string;
		const elementId = args.elementId as string;
		const updates: Record<string, unknown> = {};

		if (args.content !== undefined) updates.content = args.content;
		if (args.fontSize !== undefined) updates.fontSize = args.fontSize;
		if (args.fontFamily !== undefined) updates.fontFamily = args.fontFamily;
		if (args.fontWeight !== undefined) updates.fontWeight = args.fontWeight;
		if (args.fontStyle !== undefined) updates.fontStyle = args.fontStyle;
		if (args.color !== undefined) updates.color = args.color;
		if (args.backgroundColor !== undefined) {
			updates.backgroundColor = args.backgroundColor;
		}
		if (args.textAlign !== undefined) updates.textAlign = args.textAlign;
		if (args.opacity !== undefined) updates.opacity = args.opacity;

		const hasTransform =
			args.scale !== undefined ||
			args.positionX !== undefined ||
			args.positionY !== undefined ||
			args.rotate !== undefined;

		if (hasTransform) {
			const track = editor.timeline.getTrackById({ trackId });
			const element = track?.elements.find((candidate) => candidate.id === elementId);
			const currentTransform =
				element && "transform" in element
					? element.transform
					: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };

			updates.transform = {
				scale: (args.scale as number) ?? currentTransform.scale,
				position: {
					x: (args.positionX as number) ?? currentTransform.position.x,
					y: (args.positionY as number) ?? currentTransform.position.y,
				},
				rotate: (args.rotate as number) ?? currentTransform.rotate,
			};
		}

		if (Object.keys(updates).length === 0) {
			return { success: false, message: "No properties to update" };
		}

		editor.timeline.updateElements({
			updates: [{ trackId, elementId, updates }],
		});

		return {
			success: true,
			message: `Updated element: ${Object.keys(updates).join(", ")}`,
		};
	},
};

export const deleteElementTool: AgentTool = {
	name: "delete_element",
	description: "Delete one or more elements from the timeline.",
	parameters: {
		type: "object",
		properties: {
			elements: {
				type: "array",
				description: "Array of elements to delete",
				items: {
					type: "object",
					properties: {
						trackId: { type: "string", description: "Track ID" },
						elementId: { type: "string", description: "Element ID" },
					},
					required: ["trackId", "elementId"],
				},
			},
		},
		required: ["elements"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const elements = args.elements as Array<{
			trackId: string;
			elementId: string;
		}>;

		if (elements.length === 0) {
			return { success: false, message: "No elements specified" };
		}

		editor.timeline.deleteElements({ elements });

		return {
			success: true,
			message: `Deleted ${elements.length} element(s)`,
		};
	},
};

export const moveElementTool: AgentTool = {
	name: "move_element",
	description:
		"Move an element to a different time position or to a different track.",
	parameters: {
		type: "object",
		properties: {
			sourceTrackId: {
				type: "string",
				description: "Current track ID of the element",
			},
			elementId: {
				type: "string",
				description: "Element ID to move",
			},
			newStartTime: {
				type: "number",
				description: "New start time in seconds",
			},
			targetTrackId: {
				type: "string",
				description:
					"Target track ID (defaults to same track if not specified)",
			},
		},
		required: ["sourceTrackId", "elementId", "newStartTime"],
	},
	async execute(args) {
		const editor = EditorCore.getInstance();
		const sourceTrackId = args.sourceTrackId as string;
		const elementId = args.elementId as string;
		const newStartTime = args.newStartTime as number;
		const targetTrackId = (args.targetTrackId as string) ?? sourceTrackId;

		editor.timeline.moveElement({
			sourceTrackId,
			targetTrackId,
			elementId,
			newStartTime,
		});

		return {
			success: true,
			message: `Moved element to ${newStartTime}s on track ${targetTrackId}`,
		};
	},
};

export const timelineTools: AgentTool[] = [
	getTimelineStateTool,
	addVideoToTimelineTool,
	addTextToTimelineTool,
	addAudioToTimelineTool,
	getElementAnimationsTool,
	addKeyframesTool,
	removeKeyframesTool,
	setAnimationPresetTool,
	updateElementTool,
	deleteElementTool,
	moveElementTool,
];
