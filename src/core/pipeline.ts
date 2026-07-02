import * as THREE from 'three'
import { PALETTE } from './palette'

// Everything renders into a low-res target, then one composite pass does:
// smear -> ink dissolve -> UI overlay -> 4x4 Bayer dither + palette quantize.
// Order matters: smear and dissolve run pre-quantize so their output
// re-enters the palette instead of introducing stray colors.

export const RT_WIDTH = 360

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uUI;
uniform vec2 uRes;
uniform float uTime;
uniform float uDisturb;
uniform float uDissolve;
uniform float uUIDisturb;
uniform float uVignette;
uniform vec2 uLocus;
uniform float uLocusAmp;
uniform vec3 uPal[5];

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Row displacement field, and a luminance wobble so drag reads even
// across flat fills. Returns (du, brightness delta).
vec3 driftUv(vec2 uv, float amount) {
  vec2 px = uv * uRes;
  float seed = floor(uTime * 1.7);
  float blendT = fract(uTime * 1.7);
  float rowC = floor(px.y / 5.0);
  float rowF = floor(px.y / 2.0);
  float nC0 = hash21(vec2(rowC, seed));
  float nC1 = hash21(vec2(rowC, seed + 1.0));
  float nC = mix(nC0, nC1, blendT);
  float nF = hash21(vec2(rowF, seed * 3.7 + 11.0));
  float gate = smoothstep(0.5, 0.9, nC);
  float dxPix = (nC - 0.5) * 2.0 * gate * 36.0 * amount + (nF - 0.5) * 4.0 * amount;
  float lum = (nC - 0.5) * gate * 0.34 * amount;
  return vec3(dxPix / uRes.x, 0.0, lum);
}

vec3 toDisplay(vec3 linear) {
  return pow(max(linear, 0.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes;

  float amt = uDisturb;
  if (uLocusAmp > 0.001) {
    amt += uLocusAmp * smoothstep(52.0, 9.0, distance(px, uLocus));
  }

  vec3 col;
  vec3 drift = driftUv(uv, amt);
  vec2 duv = drift.xy;
  if (amt > 0.002) {
    vec3 s0 = texture2D(uScene, uv + duv).rgb;
    vec3 s1 = texture2D(uScene, uv + duv * 1.7).rgb;
    vec3 s2 = texture2D(uScene, uv + duv * 0.4).rgb;
    col = toDisplay(vec3(s1.r, s0.g, s2.b)) * (1.0 + drift.z);
  } else {
    col = toDisplay(texture2D(uScene, uv).rgb);
  }

  if (uDissolve > 0.001) {
    vec2 np = vec2(px.x * 0.014 + uDissolve * 0.35, px.y * 0.085);
    float n = vnoise(np) * 0.62 + vnoise(np * 3.9 + 17.0) * 0.38;
    float d = uDissolve * 1.12;
    if (n < d - 0.05) {
      col = uPal[2];
    } else if (n < d) {
      col = uPal[0];
    }
  }

  if (uVignette > 0.001) {
    float r = length((uv - 0.5) * vec2(1.0, uRes.y / uRes.x));
    col = mix(col, uPal[2], uVignette * smoothstep(0.5, 1.2, r));
  }

  vec2 uiUv = uv;
  if (uUIDisturb > 0.002) {
    uiUv += driftUv(uv + 0.31, uUIDisturb).xy;
  }
  vec4 ui = texture2D(uUI, uiUv);

  mat4 B = mat4(
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );
  float bay = B[int(mod(px.x, 4.0))][int(mod(px.y, 4.0))] / 16.0;

  vec3 c = clamp(col + (bay - 0.5) * 0.34, 0.0, 1.0);
  bool hasUI = ui.a > 0.004;
  if (hasUI) {
    c = clamp(mix(col, ui.rgb, ui.a) + (bay - 0.5) * 0.1, 0.0, 1.0);
  }
  // Machine green only where the interface itself is green — a pale UI
  // pixel blended over a warm surface must not gild into green.
  bool wantGreen = hasUI && ui.g > ui.r * 1.15 && ui.g > ui.b * 1.15;

  float best = 1e9;
  vec3 outc = uPal[0];
  for (int i = 0; i < 5; i++) {
    if (i == 4 && !wantGreen) break;
    vec3 p = uPal[i];
    vec3 dd = c - p;
    float rbar = (c.r + p.r) * 0.5;
    float dist = (2.0 + rbar) * dd.r * dd.r + 4.0 * dd.g * dd.g + (3.0 - rbar) * dd.b * dd.b;
    if (dist < best) {
      best = dist;
      outc = p;
    }
  }

  gl_FragColor = vec4(outc, 1.0);
}
`

const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export class Pipeline {
  readonly renderer: THREE.WebGLRenderer
  rt: THREE.WebGLRenderTarget
  rtWidth = RT_WIDTH
  rtHeight: number

  readonly uiCanvas: HTMLCanvasElement
  readonly uiCtx: CanvasRenderingContext2D
  private uiTexture: THREE.CanvasTexture

  private postScene: THREE.Scene
  private postCam: THREE.OrthographicCamera
  private uniforms: Record<string, THREE.IUniform>

  onResize: ((rtW: number, rtH: number) => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.rtHeight = this.computeRtHeight()
    this.rt = this.makeRT()

    this.uiCanvas = document.createElement('canvas')
    this.uiCanvas.width = this.rtWidth
    this.uiCanvas.height = this.rtHeight
    this.uiCtx = this.uiCanvas.getContext('2d')!
    this.uiTexture = this.makeUITexture()

    this.uniforms = {
      uScene: { value: this.rt.texture },
      uUI: { value: this.uiTexture },
      uRes: { value: new THREE.Vector2(this.rtWidth, this.rtHeight) },
      uTime: { value: 0 },
      uDisturb: { value: 0 },
      uDissolve: { value: 0 },
      uUIDisturb: { value: 0 },
      uVignette: { value: 0.5 },
      uLocus: { value: new THREE.Vector2(-999, -999) },
      uLocusAmp: { value: 0 },
      uPal: { value: PALETTE.map((c) => new THREE.Vector3(c.r, c.g, c.b)) },
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    })
    this.postScene = new THREE.Scene()
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    this.postScene.add(quad)

    this.applySize()
    window.addEventListener('resize', () => this.applySize())
  }

  private computeRtHeight() {
    const w = window.innerWidth
    const h = window.innerHeight
    return Math.max(64, Math.round((RT_WIDTH * h) / w))
  }

  private makeRT() {
    return new THREE.WebGLRenderTarget(this.rtWidth, this.rtHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    })
  }

  private makeUITexture() {
    const t = new THREE.CanvasTexture(this.uiCanvas)
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.NoColorSpace
    return t
  }

  private applySize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3))
    this.renderer.setSize(w, h)

    const newH = this.computeRtHeight()
    if (newH !== this.rtHeight) {
      this.rtHeight = newH
      this.rt.dispose()
      this.rt = this.makeRT()
      this.uiCanvas.height = newH
      this.uiTexture.dispose()
      this.uiTexture = this.makeUITexture()
      this.uniforms.uScene.value = this.rt.texture
      this.uniforms.uUI.value = this.uiTexture
      ;(this.uniforms.uRes.value as THREE.Vector2).set(this.rtWidth, this.rtHeight)
    }
    this.onResize?.(this.rtWidth, this.rtHeight)
  }

  set disturb(v: number) {
    this.uniforms.uDisturb.value = v
  }
  set uiDisturb(v: number) {
    this.uniforms.uUIDisturb.value = v
  }
  set dissolve(v: number) {
    this.uniforms.uDissolve.value = v
  }
  set vignette(v: number) {
    this.uniforms.uVignette.value = v
  }
  setLocus(x: number, y: number, amp: number) {
    ;(this.uniforms.uLocus.value as THREE.Vector2).set(x, y)
    this.uniforms.uLocusAmp.value = amp
  }
  get dissolve(): number {
    return this.uniforms.uDissolve.value as number
  }

  lastSceneStats = { calls: 0, triangles: 0 }

  render(scene: THREE.Scene, camera: THREE.Camera, t: number) {
    this.uniforms.uTime.value = t
    this.uiTexture.needsUpdate = true
    this.renderer.setRenderTarget(this.rt)
    this.renderer.render(scene, camera)
    this.lastSceneStats.calls = this.renderer.info.render.calls
    this.lastSceneStats.triangles = this.renderer.info.render.triangles
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.postScene, this.postCam)
  }
}
