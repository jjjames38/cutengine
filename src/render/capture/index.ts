import { mkdirSync } from 'fs';
import { join } from 'path';
import { acquirePage, releasePage } from './browser-pool.js';

export interface CaptureOptions {
  html: string;
  outputDir: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  isStatic?: boolean;
  /**
   * Optional function that generates HTML for each frame at a given time.
   * When provided, the capture loop calls this instead of using CSS animation advancement.
   * This is the per-frame rendering approach that avoids CSS animation timing conflicts.
   */
  frameHtmlBuilder?: (time: number) => string;
}

export interface CaptureResult {
  frameDir: string;
  frameCount: number;
  framePattern: string;
}

export async function captureFrames(opts: CaptureOptions): Promise<CaptureResult> {
  mkdirSync(opts.outputDir, { recursive: true });

  const page = await acquirePage(opts.width, opts.height);

  try {
    // If a per-frame HTML builder is provided, use it for animated captures
    if (opts.frameHtmlBuilder && !opts.isStatic) {
      const totalFrames = Math.ceil(opts.fps * opts.duration);
      const frameDuration = 1 / opts.fps;

      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameDuration;
        const frameHtml = opts.frameHtmlBuilder(time);
        await page.setContent(frameHtml, { waitUntil: 'networkidle0' });

        const frameNum = String(i + 1).padStart(5, '0');
        await page.screenshot({
          path: join(opts.outputDir, `frame_${frameNum}.png`),
          type: 'png',
        });
      }

      return {
        frameDir: opts.outputDir,
        frameCount: totalFrames,
        framePattern: 'frame_%05d.png',
      };
    }

    await page.setContent(opts.html, { waitUntil: 'networkidle0' });

    if (opts.isStatic) {
      await page.screenshot({
        path: join(opts.outputDir, 'frame_00001.png'),
        type: 'png',
      });
      return {
        frameDir: opts.outputDir,
        frameCount: 1,
        framePattern: 'frame_%05d.png',
      };
    }

    const totalFrames = Math.ceil(opts.fps * opts.duration);
    const frameDuration = 1000 / opts.fps;

    const cdp = await page.createCDPSession();
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });

    for (let i = 0; i < totalFrames; i++) {
      const frameNum = String(i + 1).padStart(5, '0');
      await page.screenshot({
        path: join(opts.outputDir, `frame_${frameNum}.png`),
        type: 'png',
      });

      // Advance CSS animations to next frame time
      await page.evaluate((ms: number) => {
        document.getAnimations().forEach((anim) => {
          anim.currentTime = ms;
        });
      }, (i + 1) * frameDuration);
    }

    return {
      frameDir: opts.outputDir,
      frameCount: totalFrames,
      framePattern: 'frame_%05d.png',
    };
  } finally {
    await releasePage(page);
  }
}
