// Scene Builder: converts IR scene into full HTML/CSS page for Puppeteer capture.

import type { IRScene, IRLayer, IROutput } from '../parser/types.js';
import { wrapInHtml } from './html-template.js';
import { renderImage } from '../assets/image.js';
import { renderText } from '../assets/text.js';
import { renderVideo } from '../assets/video.js';
import { renderRichText } from '../assets/richtext.js';
import { renderHtml } from '../assets/html.js';
import { renderShape } from '../assets/shape.js';
import { renderSvg } from '../assets/svg.js';
import { renderTitle } from '../assets/title.js';
import { renderLuma } from '../assets/luma.js';
import { buildKenBurns, getKenBurnsTransformAtTime } from '../effects/kenburns.js';
import { buildFilter } from '../effects/filters.js';
import { buildTransitionIn, buildTransitionOut, getTransitionInStyleAtTime, getTransitionOutStyleAtTime, getTransitionDuration } from '../effects/transitions.js';

/**
 * Render a single layer to HTML + CSS based on its asset type.
 */
function renderLayer(layer: IRLayer, index: number): { html: string; css: string } {
  switch (layer.asset.type) {
    case 'image':
      return renderImage(layer, index);
    case 'video':
      return renderVideo(layer, index);
    case 'text':
    case 'caption':
      return renderText(layer, index);
    case 'title':
      return renderTitle(layer, index);
    case 'richtext':
      return renderRichText(layer, index);
    case 'html':
      return renderHtml(layer, index);
    case 'shape':
      return renderShape(layer, index);
    case 'svg':
      return renderSvg(layer, index);
    case 'luma':
      return renderLuma(layer, index);
    default:
      // For unsupported types, return an empty placeholder
      return {
        html: `<div id="layer-${index}" class="unsupported"></div>`,
        css: `#layer-${index} { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }`,
      };
  }
}

/**
 * Calculate the total timeline duration from all layers.
 * This is the maximum (start + duration) across all visual layers.
 */
export function calcTimelineDuration(layers: IRLayer[]): number {
  let max = 0;
  for (const layer of layers) {
    if (layer.type !== 'visual') continue;
    const end = layer.timing.start + layer.timing.duration;
    if (end > max) max = end;
  }
  return max;
}

/**
 * Build CSS keyframes for timing-based layer visibility.
 *
 * Each layer is hidden (opacity: 0) by default, then becomes visible
 * only during its [start, start+duration] window within the total timeline.
 * Uses CSS `step-end` timing so transitions are instant (no fade).
 */
function buildVisibilityAnimation(
  index: number,
  start: number,
  duration: number,
  totalDuration: number,
): { keyframes: string; style: string } {
  // Edge case: if totalDuration is 0 or layer covers the entire timeline, always show
  if (totalDuration <= 0 || (start <= 0 && duration >= totalDuration)) {
    return { keyframes: '', style: '' };
  }

  const startPct = (start / totalDuration) * 100;
  const endPct = ((start + duration) / totalDuration) * 100;
  const name = `vis-${index}`;

  const keyframes = `@keyframes ${name} {
  0% { opacity: 0; }
  ${startPct.toFixed(4)}% { opacity: 1; }
  ${endPct.toFixed(4)}% { opacity: 0; }
  100% { opacity: 0; }
}`;

  const style = `#layer-${index} { opacity: 0; animation: ${name} ${totalDuration}s step-end forwards; }`;

  return { keyframes, style };
}

/**
 * Build the complete HTML page for a single scene.
 *
 * Layers are rendered with z-index so that the first layer in the array
 * appears on top (highest z-index), matching Shotstack's track ordering
 * where earlier tracks overlay later ones.
 *
 * Each layer gets timing-based visibility so it only appears during its
 * [start, start+duration] window. KenBurns and transition animations
 * use animation-delay to match the layer's start time.
 */
export function buildScene(scene: IRScene, output: IROutput, totalDuration?: number): string {
  const allCss: string[] = [];
  const allHtml: string[] = [];

  const totalLayers = scene.layers.length;

  // Calculate the effective total duration for visibility animations
  const effectiveDuration = totalDuration ?? calcTimelineDuration(scene.layers);

  for (let i = 0; i < totalLayers; i++) {
    const layer = scene.layers[i];
    if (layer.type !== 'visual') continue;

    const { html, css } = renderLayer(layer, i);
    const classes: string[] = [];

    // z-index: first layer on top
    const zIndex = totalLayers - i;
    let layerCss = css;
    layerCss += `\n  #layer-${i} { z-index: ${zIndex}; }`;

    // Timing-based visibility: show layer only during its time window
    const vis = buildVisibilityAnimation(i, layer.timing.start, layer.timing.duration, effectiveDuration);
    if (vis.keyframes) {
      allCss.push(vis.keyframes);
      layerCss += `\n  ${vis.style}`;
    }

    // Apply motion (Ken Burns) effect with animation-delay matching layer start
    if (layer.effects.motion) {
      const kb = buildKenBurns(layer.effects.motion);
      if (kb) {
        // Override animation-delay to match layer start time
        const delayedKeyframes = kb.keyframes.replace(
          /animation: ([^ ]+) ([^ ]+) ([^ ]+) forwards;/,
          `animation: $1 $2 $3 forwards; animation-delay: ${layer.timing.start}s;`
        );
        allCss.push(delayedKeyframes);
        classes.push(kb.className);
      }
    }

    // Apply filter effect
    if (layer.effects.filter) {
      const filterVal = buildFilter(layer.effects.filter);
      if (filterVal) {
        layerCss += `\n  #layer-${i} { ${filterVal}; }`;
      }
    }

    // Apply opacity (only when no visibility animation, to avoid conflicts)
    if (layer.effects.opacity !== undefined && typeof layer.effects.opacity === 'number' && !vis.keyframes) {
      layerCss += `\n  #layer-${i} { opacity: ${layer.effects.opacity}; }`;
    }

    // Apply crop
    if (layer.crop) {
      const { top, bottom, left, right } = layer.crop;
      layerCss += `\n  #layer-${i} { clip-path: inset(${top * 100}% ${right * 100}% ${bottom * 100}% ${left * 100}%); }`;
    }

    // Apply transition-in with animation-delay matching layer start
    if (layer.timing.transitionIn) {
      const transIn = buildTransitionIn(layer.timing.transitionIn);
      if (transIn) {
        const delayedKeyframes = transIn.keyframes.replace(
          /animation: ([^ ]+) ([^ ]+) ([^ ]+) forwards;/,
          `animation: $1 $2 $3 forwards; animation-delay: ${layer.timing.start}s;`
        );
        allCss.push(delayedKeyframes);
        classes.push(transIn.className);
      }
    }

    // Apply transition-out with animation-delay matching layer end time
    if (layer.timing.transitionOut) {
      const transOut = buildTransitionOut(layer.timing.transitionOut);
      if (transOut) {
        const outStart = layer.timing.start + layer.timing.duration - transOut.duration;
        const delayedKeyframes = transOut.keyframes.replace(
          /animation: ([^ ]+) ([^ ]+) ([^ ]+) forwards;/,
          `animation: $1 $2 $3 forwards; animation-delay: ${Math.max(0, outStart)}s;`
        );
        allCss.push(delayedKeyframes);
        classes.push(transOut.className);
      }
    }

    allCss.push(layerCss);

    // Inject classes into the HTML element
    if (classes.length > 0) {
      const withClasses = html.replace(
        /id="layer-(\d+)"/,
        `id="layer-$1" class="${classes.join(' ')}"`
      );
      allHtml.push(withClasses);
    } else {
      allHtml.push(html);
    }
  }

  return wrapInHtml(allHtml.join('\n'), allCss.join('\n'), output.width, output.height);
}

/**
 * Build HTML for a single frame at a specific time.
 *
 * Instead of relying on CSS animations for visibility, KenBurns, and transitions,
 * this function computes the exact styles for each layer at the given time.
 * Only layers visible at time T are included. This eliminates CSS animation
 * timing conflicts between visibility, KenBurns, and transitions.
 */
export function buildFrameAtTime(scene: IRScene, output: IROutput, time: number): string {
  const allCss: string[] = [];
  const allHtml: string[] = [];

  const totalLayers = scene.layers.length;

  for (let i = 0; i < totalLayers; i++) {
    const layer = scene.layers[i];
    if (layer.type !== 'visual') continue;

    const layerStart = layer.timing.start;
    const layerEnd = layerStart + layer.timing.duration;

    // Skip layers not visible at this time
    if (time < layerStart || time >= layerEnd) continue;

    const { html, css } = renderLayer(layer, i);

    // z-index: first layer on top
    const zIndex = totalLayers - i;
    let layerCss = css;
    layerCss += `\n  #layer-${i} { z-index: ${zIndex}; }`;

    // Time relative to layer start
    const localTime = time - layerStart;
    const inlineStyles: string[] = [];

    // Compute KenBurns transform at this time
    if (layer.effects.motion) {
      const transform = getKenBurnsTransformAtTime(
        layer.effects.motion,
        localTime,
        layer.timing.duration,
      );
      if (transform) {
        inlineStyles.push(`transform: ${transform}`);
      }
    }

    // Compute transition-in opacity/style at this time
    if (layer.timing.transitionIn) {
      const transStyle = getTransitionInStyleAtTime(layer.timing.transitionIn, localTime);
      if (transStyle) {
        inlineStyles.push(transStyle);
      }
    }

    // Compute transition-out style at this time
    if (layer.timing.transitionOut) {
      const outDuration = getTransitionDuration(layer.timing.transitionOut);
      const outStart = layer.timing.duration - outDuration;
      const outLocalTime = localTime - outStart;
      if (outLocalTime > 0) {
        const transStyle = getTransitionOutStyleAtTime(layer.timing.transitionOut, outLocalTime);
        if (transStyle) {
          inlineStyles.push(transStyle);
        }
      }
    }

    // Apply filter effect
    if (layer.effects.filter) {
      const filterVal = buildFilter(layer.effects.filter);
      if (filterVal) {
        layerCss += `\n  #layer-${i} { ${filterVal}; }`;
      }
    }

    // Apply static opacity (when not handled by transitions)
    if (layer.effects.opacity !== undefined && typeof layer.effects.opacity === 'number') {
      if (!layer.timing.transitionIn && !layer.timing.transitionOut) {
        layerCss += `\n  #layer-${i} { opacity: ${layer.effects.opacity}; }`;
      }
    }

    // Apply crop
    if (layer.crop) {
      const { top, bottom, left, right } = layer.crop;
      layerCss += `\n  #layer-${i} { clip-path: inset(${top * 100}% ${right * 100}% ${bottom * 100}% ${left * 100}%); }`;
    }

    allCss.push(layerCss);

    // Inject inline styles into the HTML element
    if (inlineStyles.length > 0) {
      const styleAttr = inlineStyles.join(' ');
      const withStyle = html.replace(
        /id="layer-(\d+)"/,
        `id="layer-$1" style="${styleAttr}"`,
      );
      allHtml.push(withStyle);
    } else {
      allHtml.push(html);
    }
  }

  return wrapInHtml(allHtml.join('\n'), allCss.join('\n'), output.width, output.height);
}
