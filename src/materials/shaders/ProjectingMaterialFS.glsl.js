export default /* glsl */`

uniform bool diffuseColorGrey;
uniform sampler2D map;

#include <proj_texture_pars_fragment>

varying vec4 vColor;

void main() {
  gl_FragColor.a = 1.0;
  if (diffuseColorGrey) {
    gl_FragColor.rgb = vec3(dot(vColor.rgb, vec3(0.333333)));
  }

  #include <proj_texture_fragment>
}
`;
