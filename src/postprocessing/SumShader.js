import { Vector2 } from 'three';

/**
 * Sum Shader
 */

const SumShader = {
  uniforms: {
      'tDiffuse': { value: null },
      'center': { value: new Vector2(0.5,0.5) },
      'resolution': { value: new Vector2(1,1) },
      'stride': { value: 1 },
      'amount': { value: 1000000 }
  },

  fragmentShader: /* glsl */`
precision highp float;
precision highp int;

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float amount;
uniform float stride;

in vec2 vUv;
out highp vec4 pc_fragColor;

void main() {
  vec3 step = vUv.y>0.5 ?
  vec3(1./resolution.x,0.,vUv.x*resolution.x) :
  vec3(0.,0.5/resolution.y,vUv.y*2.*resolution.y) ;
  step.xy *= stride;
  vec4 c0 = vec4(0.);
  float imax = min(amount,step.z/stride);
  for(float i=0.; i<imax; ++i)
    c0 += textureGrad(tDiffuse, vUv - i * step.xy, vec2(0.), vec2(0.));
  pc_fragColor = c0;

}`

};

export { SumShader };
