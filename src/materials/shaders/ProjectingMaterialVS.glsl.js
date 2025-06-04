export default /* glsl */`

uniform float size;
#include <proj_texture_pars_vertex>
varying vec4 vColor;

void main() {
    gl_PointSize = size;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    #include <proj_texture_vertex>

    vColor = vec4(color, 1.);
}`;


