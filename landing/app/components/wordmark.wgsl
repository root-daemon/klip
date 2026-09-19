// flicky wordmark — the hero headline as a live WebGPU surface.
//
// The glyphs come in as a mask texture rasterized by the DOM font
// (R = sharp coverage, G = blurred coverage for the halo). Inside the
// letters we pour a slow, domain-warped simplex "liquid" in the brand
// blues, overlay the desktop's dotted wallpaper grid, and sweep a thin
// glint across every few seconds. The pointer pushes ripples through
// the liquid, and the whole thing reveals left-to-right on load.

import { fbmSimplex3d, simplex3d } from "@vgpu/wgsl-std/noise/simplex";

struct Params {
  time: f32,
  theme: f32,            // 0 = light, 1 = dark
  aspect: f32,           // canvas width / height
  reveal: f32,           // 0..1 intro wipe
  pointer: vec2f,        // pointer in uv space (far away when absent)
  texel: vec2f,          // 1 / canvas size
  pointerStrength: f32,  // eased 0..1
  motion: f32,           // 0 = reduced motion (freeze), 1 = animate
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var mask: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

fn palette(t: f32, theme: f32) -> vec3f {
  // light: deep royal -> flicky blue -> sky -> near-white highlight
  let l0 = vec3f(0.114, 0.306, 0.847); // #1d4ed8
  let l1 = vec3f(0.145, 0.388, 0.922); // #2563eb
  let l2 = vec3f(0.220, 0.741, 0.973); // #38bdf8
  let l3 = vec3f(0.859, 0.918, 0.996); // #dbeafe
  // dark: brighter, cooler, more cyan
  let d0 = vec3f(0.180, 0.420, 0.930);
  let d1 = vec3f(0.357, 0.608, 1.000); // #5b9bff
  let d2 = vec3f(0.404, 0.910, 0.976); // #67e8f9
  let d3 = vec3f(0.930, 0.980, 1.000);

  let c0 = mix(l0, d0, theme);
  let c1 = mix(l1, d1, theme);
  let c2 = mix(l2, d2, theme);
  let c3 = mix(l3, d3, theme);

  let a = smoothstep(0.00, 0.45, t);
  let b = smoothstep(0.40, 0.82, t);
  let c = smoothstep(0.84, 1.00, t) * 0.75; // keep highlights from blowing out to white
  return mix(mix(mix(c0, c1, a), c2, b), c3, c);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = params.time * params.motion;
  let m = textureSample(mask, samp, uv);
  let ink = m.r;
  let halo = m.g;

  // early out for pixels that touch neither the glyphs nor the halo
  if (ink < 0.002 && halo < 0.002) {
    return vec4f(0.0);
  }

  // aspect-correct coordinates, y in [0, 1]
  let p = vec2f(uv.x * params.aspect, uv.y);

  // --- liquid: low-frequency warp, mid-frequency detail, bounded time
  let z = sin(t * 0.11) * 3.0 + cos(t * 0.07) * 2.0;
  let drift = p * 1.6 + vec2f(t * 0.05, -t * 0.02);
  let warp = vec2f(
    fbmSimplex3d(vec3f(drift, z), 3, 2.0, 0.5),
    fbmSimplex3d(vec3f(drift + vec2f(41.0, -23.0), z + 17.0), 3, 2.0, 0.5),
  );
  var field = fbmSimplex3d(vec3f(p * 2.2 + warp * 0.6, z * 0.5 + 9.0), 3, 2.17, 0.5);

  // --- pointer ripple: rings fanning out from the cursor, fading with distance
  let pp = vec2f(params.pointer.x * params.aspect, params.pointer.y);
  let d = distance(p, pp);
  let ripple = sin(d * 34.0 - t * 5.5) * exp(-d * 3.2) * params.pointerStrength;
  field = field + ripple * 0.35;

  // --- shape the field into a palette position, biased toward the mid blues
  let tone = clamp((field + 0.55) / 1.1, 0.0, 1.0);
  var col = palette(tone, params.theme);

  // vertical sheen so the letters read as glossy, not flat
  let sheen = smoothstep(0.0, 1.0, 1.0 - uv.y) * 0.10;
  col = col + sheen * mix(vec3f(0.6, 0.8, 1.0), vec3f(0.7, 0.95, 1.0), params.theme);

  // --- the desktop's dotted wallpaper, printed through the glyphs
  let cell = fract(p * 22.0) - 0.5;
  let dot = 1.0 - smoothstep(0.10, 0.16, length(cell));
  col = col * (1.0 - dot * mix(0.10, 0.15, params.theme));

  // --- glint: a thin diagonal streak that sweeps across every ~7s
  let phase = fract(t * 0.14);
  let axis = (p.x * 0.72 + uv.y * 0.28) / max(params.aspect, 0.001);
  let streak = 1.0 - smoothstep(0.0, 0.035, abs(axis - (phase * 1.6 - 0.3)));
  let glintOn = smoothstep(0.0, 0.08, phase) * (1.0 - smoothstep(0.92, 1.0, phase));
  col = col + streak * glintOn * 0.55 * vec3f(1.0);

  // --- intro reveal: a noisy left-to-right wipe
  let edge = simplex3d(vec3f(p * 5.0, 3.0)) * 0.08;
  let wipe = smoothstep(params.reveal * 1.25 - 0.25 + edge, params.reveal * 1.25 - 0.05 + edge, uv.x);
  let show = 1.0 - wipe;

  // --- halo outside the letters, tinted by the same field
  let haloCol = mix(vec3f(0.36, 0.60, 1.0), vec3f(0.42, 0.72, 1.0), params.theme);
  let haloA = halo * (1.0 - ink) * mix(0.28, 0.55, params.theme) * (0.75 + 0.25 * field) * show;

  let inkA = ink * show;
  let rgb = col * inkA + haloCol * haloA;
  let a = inkA + haloA;
  return vec4f(rgb, a); // premultiplied
}
