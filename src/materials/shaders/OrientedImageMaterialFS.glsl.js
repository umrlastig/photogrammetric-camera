export default /* glsl */`

uniform vec3 diffuse;
uniform float opacity;
#include <common>

uniform bool diffuseColorGrey;
#ifdef USE_MAP4
#include <distortions/radial_pars_fragment>
uniform mat4 uvwPostTransform;
uniform RadialDistortion uvDistortion;
uniform sampler2D map;
uniform float borderSharpness;
uniform float debugOpacity;

varying highp vec4 vPosition;
#undef USE_MAP
#endif

#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {
  #include <clipping_planes_fragment>
  vec3 outgoingLight = vec3( 0.0 );
  vec4 diffuseColor = vec4( diffuse, opacity );
  #include <logdepthbuf_fragment>
  #include <map_particle_fragment>
  #include <color_fragment>

  if (diffuseColorGrey) {
    diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.333333)));
  }
  #ifdef USE_MAP4
  vec4 uvw = vPosition;
  if( uvw.w > 0. && distort_radial(uvw, uvDistortion))
  {
    uvw = uvwPostTransform * uvw;
    uvw.xyz /= uvw.w;
    vec3 border = min(uvw.xyz, 1. - uvw.xyz);
    if (all(greaterThan(border,vec3(0.))))
    {
      vec4 color = texture2D(map, uvw.xy);
      color.a *= min(1., borderSharpness*min(border.x, border.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, color.rgb, color.a);
    } else {
      diffuseColor.rgb = mix(diffuseColor.rgb, fract(uvw.xyz), debugOpacity);
    }
  }
  #endif

  #include <alphatest_fragment>
  outgoingLight = diffuseColor.rgb;
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <fog_fragment>
  #include <premultiplied_alpha_fragment>
}

`;
