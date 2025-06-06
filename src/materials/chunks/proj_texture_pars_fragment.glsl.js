export default /* glsl */`
#ifdef USE_PROJECTIVE_TEXTURING
#include <distortions/radial_pars_fragment>
uniform vec3 textureCameraPosition;
uniform mat4 textureCameraPreTransform; // Contains the rotation and the intrinsics of the camera, but not the translation
uniform mat4 textureCameraPostTransform;
uniform RadialDistortion uvDistortion;
uniform mat4 modelMatrix;
varying vec4 vPosition;
uniform sampler2D depthMap;
vec4 finalColor;
#endif
`;
