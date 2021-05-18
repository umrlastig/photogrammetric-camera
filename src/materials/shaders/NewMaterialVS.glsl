uniform float size;
#ifdef USE_PROJECTIVE_TEXTURING
uniform vec3 textureCameraPosition;
uniform mat4 textureCameraPreTransform; // Contains the rotation and the intrinsics of the camera, but not the translation
varying vec4 vPosition;
varying float vDistanceCamera;
#endif
varying vec4 vColor;

void main() {
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

#ifdef USE_PROJECTIVE_TEXTURING
    mat4 m = modelMatrix;
    m[3].xyz -= textureCameraPosition;
    vPosition = textureCameraPreTransform * m * vec4(position, 1.0);
#endif
    vColor = vec4(color, 1.);
}
