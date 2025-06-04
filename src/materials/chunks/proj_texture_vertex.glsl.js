export default /* glsl */`
#ifdef USE_PROJECTIVE_TEXTURING
    mat4 m = modelMatrix;
    m[3].xyz -= textureCameraPosition;
    vPosition = textureCameraPreTransform * m * vec4(position, 1.0);
#endif
`;
