import { spawn } from 'child_process';
import { IROutput, IRAudioMix } from '../parser/types.js';
import { buildAudioMix } from './audio-mixer.js';

export interface EncodeOptions {
  frameDir: string;
  framePattern: string;
  frameCount: number;
  output: IROutput;
  audio?: IRAudioMix;
  outputPath: string;
}

const QUALITY_CRF: Record<string, number> = {
  verylow: 35,
  low: 28,
  medium: 23,
  high: 18,
  veryhigh: 15,
};

export async function encode(opts: EncodeOptions): Promise<string> {
  const args = buildFFmpegArgs(opts);
  return runFFmpeg(args, opts.outputPath);
}

export function buildFFmpegArgs(opts: EncodeOptions): string[] {
  const { output, frameDir, framePattern } = opts;
  const crf = QUALITY_CRF[output.quality] ?? 23;

  switch (output.format) {
    case 'mp4': {
      const hasAudio = opts.audio && (opts.audio.clips.length > 0 || opts.audio.soundtrack);

      if (hasAudio) {
        const totalDuration = opts.frameCount / output.fps;
        const mix = buildAudioMix(opts.audio!, totalDuration);

        if (mix.filterComplex) {
          return [
            '-framerate', String(output.fps),
            '-i', `${frameDir}/${framePattern}`,
            ...mix.inputArgs,
            '-filter_complex', mix.filterComplex,
            ...mix.mapArgs,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', String(crf),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-shortest',
            '-y',
            opts.outputPath,
          ];
        }
      }

      return [
        '-framerate', String(output.fps),
        '-i', `${frameDir}/${framePattern}`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', String(crf),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y',
        opts.outputPath,
      ];
    }
    case 'gif':
      return [
        '-framerate', String(output.fps),
        '-i', `${frameDir}/${framePattern}`,
        '-filter_complex', '[0:v] split [a][b]; [a] palettegen [pal]; [b][pal] paletteuse',
        '-y',
        opts.outputPath,
      ];
    case 'jpg':
    case 'png':
    case 'bmp':
      return [
        '-i', `${frameDir}/frame_00001.png`,
        '-frames:v', '1',
        '-y',
        opts.outputPath,
      ];
    default:
      return ['-i', `${frameDir}/${framePattern}`, '-y', opts.outputPath];
  }
}

function runFFmpeg(args: string[], outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number | null) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}
