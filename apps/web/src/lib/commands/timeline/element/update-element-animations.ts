import { Command } from "@/lib/commands/base-command";
import { EditorCore } from "@/core";
import type {
	AnimatableProperty,
	AnimationKeyframe,
	ElementAnimations,
	TimelineTrack,
} from "@/types/timeline";
import {
	addPropertyKeyframes,
	buildAnimationPreset,
	removePropertyKeyframes,
	type AnimationPreset,
} from "@/lib/timeline/animation-utils";

type AddKeyframesUpdate = {
	type: "add-keyframes";
	trackId: string;
	elementId: string;
	property: AnimatableProperty;
	keyframes: AnimationKeyframe[];
};

type RemoveKeyframesUpdate = {
	type: "remove-keyframes";
	trackId: string;
	elementId: string;
	property: AnimatableProperty;
	times?: number[];
};

type PresetUpdate = {
	type: "set-preset";
	trackId: string;
	elementId: string;
	preset: AnimationPreset;
	duration?: number;
};

export type ElementAnimationUpdate =
	| AddKeyframesUpdate
	| RemoveKeyframesUpdate
	| PresetUpdate;

export class UpdateElementAnimationsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(private update: ElementAnimationUpdate) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((track) => {
			if (track.id !== this.update.trackId) return track;

			return {
				...track,
				elements: track.elements.map((element) => {
					if (element.id !== this.update.elementId || element.type === "audio") {
						return element;
					}

					let animations: ElementAnimations | undefined;

					if (this.update.type === "add-keyframes") {
						animations = addPropertyKeyframes({
							animations: element.animations,
							property: this.update.property,
							keyframes: this.update.keyframes,
							duration: element.duration,
						});
					}

					if (this.update.type === "remove-keyframes") {
						animations = removePropertyKeyframes({
							animations: element.animations,
							property: this.update.property,
							times: this.update.times,
						});
					}

					if (this.update.type === "set-preset") {
						animations = buildAnimationPreset({
							preset: this.update.preset,
							baseTransform: element.transform,
							baseOpacity: element.opacity,
							duration: this.update.duration ?? element.duration,
						});
					}

					return {
						...element,
						animations,
					};
				}),
			} as typeof track;
		}) as TimelineTrack[];

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (!this.savedState) return;
		const editor = EditorCore.getInstance();
		editor.timeline.updateTracks(this.savedState);
	}
}
