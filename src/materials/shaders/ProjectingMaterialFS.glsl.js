export default /* glsl */`

uniform bool diffuseColorGrey;

#include <proj_texture_pars_fragment>

varying vec4 vColor;

void main() {
  vec4 finalColor = vColor;

  if (diffuseColorGrey) {
    finalColor.rgb = vec3(dot(vColor.rgb, vec3(0.333333)));
  }

  #include <proj_texture_fragment>

  gl_FragColor =  finalColor;
}
`;
