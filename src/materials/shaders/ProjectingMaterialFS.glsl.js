export default /* glsl */`

uniform bool diffuseColorGrey;
uniform sampler2D map;
uniform sampler2D depthMap;

#include <proj_texture_pars_fragment>

varying vec4 vColor;

void main() {
  gl_FragColor.a = 1.0;
  if (diffuseColorGrey) {
    gl_FragColor.rgb = vec3(dot(vColor.rgb, vec3(0.333333)));
  }

  gl_FragColor.rgb = projectTexture(map, depthMap, textureCameraPostTransform, vPosition).rgb;

}
`;
