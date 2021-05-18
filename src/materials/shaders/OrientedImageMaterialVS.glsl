uniform float size;
uniform float scale;
#include <common>

#ifdef USE_MAP4
uniform vec3 uvwPosition;
uniform mat4 uvwPreTransform;
varying highp vec4 vPosition;
#undef USE_MAP
#endif

#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
  #include <color_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>
  gl_PointSize = size;
  #ifdef USE_SIZEATTENUATION
    bool isPerspective = isPerspectiveMatrix( projectionMatrix );
    if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
  #endif
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  #include <worldpos_vertex>

  #ifdef USE_MAP4
    // "uvwPreTransform * m" is equal to "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
    // but more stable when both the texturing and viewing cameras have large coordinate values
    mat4 m = modelMatrix;
    m[3].xyz -= uvwPosition;
    vec4 uvw = uvwPreTransform * m * vec4(transformed, 1.);
    vPosition = uvw;
  #endif

  #include <fog_vertex>
}
