export default /* glsl */`

uniform float size;
#ifdef USE_PROJECTIVE_TEXTURING
uniform sampler2D map;
#endif
#include <proj_texture_pars_vertex>
varying vec4 vColor;

void main() {
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    #include <proj_texture_vertex>

    vColor = vec4(color, 1.);
}`;


