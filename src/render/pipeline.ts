import { parseTimeline } from './parser/index.js';
import { buildScene } from './builder/index.js';
import { captureFrames } from './capture/index.js';
import { encode } from './encoder/index.js';
import type { IRTimeline } from './parser/types.js';
import { mkdirSync } from 'fs';
import { join } from 'path';

export interface PipelineResult {
  outputPath: string;
  format: string;
  duration: number;
}

export type StatusCallback = (status: string) => Promise<void> | void;

export async function executePipeline(
  editJson: { timeline: any; output: any; merge?: any[]; callback?: string },
  workDir: string,
  onStatus?: StatusCallback,
): Promise<PipelineResult> {
  mkdirSync(workDir, { recursive: true });

  // Stage 1: Parse
  await onStatus?.('fetching');
  const ir: IRTimeline = parseTimeline(editJson);

  // Stage 2: Build HTML scene
  await onStatus?.('rendering');
  const sceneHtml = buildScene(ir.scenes[0], ir.output);

  // Stage 3: Capture frames
  const frameDir = join(workDir, 'frames');
  const totalDuration = ir.scenes.reduce((sum, s) => sum + s.duration, 0);
  const isStatic = !ir.scenes.some(s =>
    s.layers.some(l => l.effects.motion || l.timing.transitionIn || l.timing.transitionOut),
  );

  const captureResult = await captureFrames({
    html: sceneHtml,
    outputDir: frameDir,
    width: ir.output.width,
    height: ir.output.height,
    fps: ir.output.fps,
    duration: totalDuration,
    isStatic,
  });

  // Stage 4: Encode
  await onStatus?.('saving');
  const outputPath = join(workDir, `output.${ir.output.format}`);

  await encode({
    frameDir: captureResult.frameDir,
    framePattern: captureResult.framePattern,
    frameCount: captureResult.frameCount,
    output: ir.output,
    audio: ir.audio.clips.length > 0 || ir.audio.soundtrack ? ir.audio : undefined,
    outputPath,
  });

  return {
    outputPath,
    format: ir.output.format,
    duration: totalDuration,
  };
}
