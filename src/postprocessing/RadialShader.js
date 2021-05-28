import { Vector2, ShaderChunk } from 'three';
import Radial_glsl from './Radial.glsl';
/**
 * Radial Shader
 */

 ShaderChunk["postprocessing/radial"] = Radial_glsl;

const RadialShader = {

  uniforms: {
      'tDiffuse': { value: null },
      'center': { value: new Vector2(0.5,0.5) },
      'resolution': { value: new Vector2(1,1) },
      'pad': { value: 2 }
  },

  fragmentShader: /* glsl */`
precision highp float;
precision highp int;

#include <postprocessing/radial>

uniform sampler2D tDiffuse;
uniform vec2 center;
uniform vec2 resolution;
uniform float pad;

in vec2 vUv;
out highp vec4 pc_fragColor;

void main() {
  vec2 uv = vUv;
  fromRadial(center, resolution, pad, uv);
  // discardOut(uv);
  pc_fragColor = texture(tDiffuse, uv);
  pc_fragColor.rgb -= 0.5;
}`

};



export { RadialShader };
