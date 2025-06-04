export default /* glsl */`
#ifdef USE_PROJECTIVE_TEXTURING
uniform vec3 textureCameraPosition;
uniform mat4 textureCameraPreTransform; // Contains the rotation and the intrinsics of the camera, but not the translation
varying vec4 vPosition;
varying float vDistanceCamera;
#endif
`;
