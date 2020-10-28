import { default as RadialDistortion } from '../cameras/distortions/RadialDistortion';

export default /* glsl */`
${RadialDistortion.chunks.radial_pars_fragment}
uniform vec3 diffuse;
uniform float opacity;
uniform bool diffuseColorGrey;
uniform bool showImage;

#ifdef USE_MAP4
    varying highp vec3 vPosition;
    #undef USE_MAP
#endif

#ifdef USE_MAP4
  uniform mat4 modelMatrix;
  uniform vec3 uvwPosition;
  uniform mat4 uvwPreTransform;
  uniform mat4 uvwPostTransform;
  uniform RadialDistortion uvDistortion;
  uniform sampler2D map;
  uniform float borderSharpness;
  uniform float debugOpacity;
#endif

void main(){
    vec4 diffuseColor = vec4(diffuse, opacity);

    if (diffuseColorGrey) {
        diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.333333)));
    }

    #ifdef USE_MAP4
        if(showImage) {
            // "uvwPreTransform * m" is equal to "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
            // but more stable when both the texturing and viewing cameras have large coordinate values
            mat4 m = modelMatrix;
            m[3].xyz -= uvwPosition;
            vec4 uvw = uvwPreTransform * m * vec4(vPosition, 1.);
            if( uvw.w > 0. && distort_radial(uvw, uvDistortion)) {
                uvw = uvwPostTransform * uvw;
                uvw.xyz /= 2. * uvw.w;
                uvw.xyz += vec3(0.5);
                vec3 border = min(uvw.xyz, 1. - uvw.xyz);
                if (all(greaterThan(border,vec3(0.)))) {
                    vec4 color = texture2D(map, uvw.xy);
                    color.a *= min(1., borderSharpness*min(border.x, border.y));
                    diffuseColor.rgb = mix(diffuseColor.rgb, color.rgb, color.a);
                } else {
                    diffuseColor.rgb = mix(diffuseColor.rgb, fract(uvw.xyz), debugOpacity);
                }
            }
        }
    #endif

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, opacity);
}
`;