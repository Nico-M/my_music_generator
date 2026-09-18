import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCurrentFrame, useVideoConfig, delayRender, continueRender } from 'remotion';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;

const float PI = 3.14159265358979323846;
const float TAU = 6.28318530717958647692;

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
  float x = px * frequency;
  float y = py * frequency;

  float fx = floor(x); float fy = floor(y); float fz = floor(pz);
  float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

  vec3 g000 = gradientHash(vec3(fx, fy, fz));
  vec3 g100 = gradientHash(vec3(cx, fy, fz));
  vec3 g010 = gradientHash(vec3(fx, cy, fz));
  vec3 g110 = gradientHash(vec3(cx, cy, fz));
  vec3 g001 = gradientHash(vec3(fx, fy, cz));
  vec3 g101 = gradientHash(vec3(cx, fy, cz));
  vec3 g011 = gradientHash(vec3(fx, cy, cz));
  vec3 g111 = gradientHash(vec3(cx, cy, cz));

  float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
  float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
  float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
  float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
  float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
  float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
  float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
  float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

  float sx = quinticSmooth(x - fx);
  float sy = quinticSmooth(y - fy);
  float sz = quinticSmooth(pz - fz);

  float lx00 = mix(d000, d100, sx);
  float lx10 = mix(d010, d110, sx);
  float lx01 = mix(d001, d101, sx);
  float lx11 = mix(d011, d111, sx);

  float ly0 = mix(lx00, lx10, sy);
  float ly1 = mix(lx01, lx11, sy);

  return amplitude * mix(ly0, ly1, sz);
}

float auroraGlow(float t, vec2 shift) {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  uv += shift;

  float noiseVal = 0.0;
  float freq = uNoiseFreq;
  float amp = uNoiseAmp;
  vec2 samplePos = uv * uScale;

  for (float i = 0.0; i < 3.0; i += 1.0) {
    noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
    amp *= uOctaveDecay;
    freq *= 2.0;
  }

  float yBand = uv.y * 10.0 - uBandHeight * 10.0;
  return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float t = uSpeed * 0.4 * uTime;
  vec2 shift = vec2(0.0);

  float glow1 = auroraGlow(t, shift);
  float glow2 = auroraGlow(t + uLayerOffset, shift);
  vec3 gradient1 = cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20));
  vec3 gradient2 = cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25));

  vec3 col = 0.99 * glow1 * gradient1 * uColor1;
  col += 0.99 * glow2 * gradient2 * uColor2;

  col *= uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export interface SoftAuroraProps {
  width?: number;
  height?: number;
  speed?: number;
  scale?: number;
  brightness?: number;
  color1?: string;
  color2?: string;
  bandHeight?: number;
  bandSpread?: number;
  noiseFrequency?: number;
  noiseAmplitude?: number;
  vocalEnergy?: number;
  opacity?: number;
}

export const SoftAurora: React.FC<SoftAuroraProps> = ({
  width = 1080,
  height = 1920,
  speed = 0.5,
  scale = 1.45,
  brightness = 1.35,
  color1 = '#00F5FF',
  color2 = '#FF007A',
  bandHeight = 0.35,
  bandSpread = 1.1,
  noiseFrequency = 2.4,
  noiseAmplitude = 1.0,
  vocalEnergy = 0,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const programRef = useRef<any>(null);
  const meshRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Initializing SoftAurora WebGL'));

  // Initialize WebGL context once
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Create lightweight OGL renderer with transparent canvas
      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        width,
        height,
      });
      rendererRef.current = renderer;
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [width, height, width / height] },
          uSpeed: { value: speed },
          uScale: { value: scale },
          uBrightness: { value: brightness },
          uColor1: { value: hexToVec3(color1) },
          uColor2: { value: hexToVec3(color2) },
          uNoiseFreq: { value: noiseFrequency },
          uNoiseAmp: { value: noiseAmplitude },
          uBandHeight: { value: bandHeight },
          uBandSpread: { value: bandSpread },
          uOctaveDecay: { value: 0.12 },
          uLayerOffset: { value: 0.5 },
          uColorSpeed: { value: 1.0 },
        },
      });
      programRef.current = program;

      const mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(gl.canvas);

      // Render initial deterministic frame
      const t = (frame / fps);
      program.uniforms.uTime.value = t;
      renderer.render({ scene: mesh });
      continueRender(handle);
    } catch (err) {
      console.error('SoftAurora WebGL initialization failed:', err);
      continueRender(handle);
    }

    return () => {
      if (rendererRef.current?.gl) {
        rendererRef.current.gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, []);

  // Update uniforms deterministically on every Remotion frame
  useLayoutEffect(() => {
    if (!programRef.current || !rendererRef.current || !meshRef.current) return;

    const t = frame / fps;
    const dynamicBrightness = brightness + vocalEnergy * 0.45;
    const dynamicBandHeight = bandHeight + vocalEnergy * 0.03;

    programRef.current.uniforms.uTime.value = t;
    programRef.current.uniforms.uSpeed.value = speed;
    programRef.current.uniforms.uScale.value = scale;
    programRef.current.uniforms.uBrightness.value = dynamicBrightness;
    programRef.current.uniforms.uBandHeight.value = dynamicBandHeight;
    programRef.current.uniforms.uColor1.value = hexToVec3(color1);
    programRef.current.uniforms.uColor2.value = hexToVec3(color2);

    rendererRef.current.render({ scene: meshRef.current });
  }, [frame, fps, speed, scale, brightness, color1, color2, bandHeight, vocalEnergy]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        pointerEvents: 'none',
        opacity,
      }}
    />
  );
};
