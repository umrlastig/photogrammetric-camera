export default /* glsl */`

#include <distortions/radial_pars_fragment>
uniform bool diffuseColorGrey;

#ifdef USE_PROJECTIVE_TEXTURING
uniform vec3 textureCameraPosition;
uniform mat4 textureCameraPreTransform; // Contains the rotation and the intrinsics of the camera, but not the translation
uniform mat4 textureCameraPostTransform;
uniform RadialDistortion uvDistortion;
uniform mat4 modelMatrix;
varying vec4 vPosition;
uniform sampler2D map;
uniform sampler2D depthMap;
#endif

varying vec4 vColor;

void main() {
  vec4 finalColor = vColor;

  if (diffuseColorGrey) {
    finalColor.rgb = vec3(dot(vColor.rgb, vec3(0.333333)));
  }

#ifdef USE_PROJECTIVE_TEXTURING
  // Project the point in the texture image
  // p' = M' * (P - C')
  // p': uvw
  // M': textureCameraPreTransform
  // P : vPositionWorld
  // C': textureCameraPosition

  vec4 uvw = vPosition;

  // For the shadowMapping, which is not distorted
  vec4 uvwNotDistorted = textureCameraPostTransform * uvw;
  uvwNotDistorted.xyz /= uvwNotDistorted.w;

  float minDist = texture2D(depthMap, uvwNotDistorted.xy).r;
  float distanceCamera = uvwNotDistorted.z;

  vec3 testBorderNotDistorted = min(uvwNotDistorted.xyz, 1. - uvwNotDistorted.xyz);

  // ShadowMapping
  if ( all(greaterThan(testBorderNotDistorted,vec3(0.))) && distanceCamera <= minDist + EPSILON ) {

  // Don't texture if uvw.w < 0
    if (uvw.w > 0. && distort_radial(uvw, uvDistortion)) {

      uvw = textureCameraPostTransform * uvw;
      uvw.xyz /= uvw.w;

      // If coordinates are valid, they will be between 0 and 1 after normalization
      // Test if coordinates are valid, so we can texture
      vec3 testBorder = min(uvw.xyz, 1. - uvw.xyz);

      if (all(greaterThan(testBorder,vec3(0.))))
      {
        vec4 color = texture2D(map, uvw.xy);
        finalColor.rgb = mix(finalColor.rgb, color.rgb, color.a);
      }
    }
  } else {
    finalColor.rgb = vec3(0.2); // shadow color
  }

#endif

  gl_FragColor =  finalColor;
}
`;
