// components/visualizer/haze.ts
// The Haze: a noise-warped glow behind an anchor (album art, timer ring).
// Raw WebGL fragment shader, no library. Every pixel is soft falloff — no solid
// core — written as premultiplied alpha over whatever surface sits behind.
//
// Opacity follows the old Focus glow's 0.08→0.55 bass ramp, and bass swells
// the radius the way that glow's ellipse grew. Mids ruffle the outline into
// slow lobes; highs shimmer inside it.

export type HazeParams = {
  /** Anchor centre in canvas pixels, y down. */
  ax: number;
  ay: number;
  /** Anchor width in canvas pixels. */
  aSize: number;
  w: number;
  h: number;
  t: number;
  bass: number;
  mid: number;
  high: number;
  /** 0–255 per channel; fractional is fine (the colour eases between tracks). */
  rgb: [number, number, number];
};

export type Haze = {
  draw(p: HazeParams): void;
  dispose(): void;
};

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

// OCT is injected: 4 on desktop, 3 on touch devices. The haze is soft enough
// that the fourth octave's fine detail doesn't survive the upscale anyway.
const frag = (oct: number) => `precision mediump float;
uniform vec2 uC;uniform float uR,uT,uB,uM,uH;uniform vec3 uCol;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<${oct};i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-uC)/uR;
  float r=length(uv);
  vec2 dir=uv/max(r,1e-4);
  float w=fbm(dir*1.6+vec2(uT*.25,-uT*.18)+fbm(uv*1.2+uT*.08));
  float edge=.75+uB*.85+(w-.5)*(.5+uM*.9);
  float d=r-edge;
  float body=1.-smoothstep(-1.,1.1,d);
  body*=body;
  float sh=fbm(uv*3.-uT*.4)*uH;
  float a=body*(.08+uB*.47)+sh*body*.06;
  a=min(a,.55)+(h(gl_FragCoord.xy)-.5)/255.;
  a=max(a,0.);
  gl_FragColor=vec4(uCol*a,a);
}`;

/** Returns null when WebGL is unavailable or the context is already lost. */
export function createHaze(canvas: HTMLCanvasElement, octaves: number): Haze | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl || gl.isContextLost()) return null;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("[haze] shader:", gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram()!;
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, frag(octaves));
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  // Shaders are only needed until link — flag them now so deleteProgram frees
  // them too; the context outlives the effect (see dispose), so leaks pile up.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl.deleteProgram(prog); return null; }
  gl.useProgram(prog);

  // One oversized triangle covers the viewport.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (k: string) => gl.getUniformLocation(prog, k);
  const U = { C: u("uC"), R: u("uR"), T: u("uT"), B: u("uB"), M: u("uM"), H: u("uH"), Col: u("uCol") };
  gl.clearColor(0, 0, 0, 0);

  return {
    draw(p) {
      gl.viewport(0, 0, p.w, p.h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.C, p.ax, p.h - p.ay); // GL y is bottom-up
      gl.uniform1f(U.R, p.aSize * 0.62);
      gl.uniform1f(U.T, p.t);
      gl.uniform1f(U.B, p.bass);
      gl.uniform1f(U.M, p.mid);
      gl.uniform1f(U.H, p.high);
      gl.uniform3f(U.Col, p.rgb[0] / 255, p.rgb[1] / 255, p.rgb[2] / 255);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      // No loseContext(): getContext() hands the same (now lost) context back
      // to a re-run effect (StrictMode, fast refresh) and every compile fails.
    },
  };
}
