import { chunks as disto } from '../cameras/PhotogrammetricDistortion';
import { chunks as material } from '../materials/OrientedImageMaterial';

export default /* glsl */`
${disto.shaders}
${material.shaders}
uniform vec3 diffuse;
uniform float opacity;
uniform Debug debug;

#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
    uniform float logDepthBufFC;
    varying float vFragDepth;
    varying float vIsPerspective;
#endif

#ifdef USE_COLOR
    varying vec3 vColor;
#endif

#ifdef USE_MAP4
    #undef USE_MAP
    uniform mat4 modelMatrix;
    uniform Camera uvwTexture;
    uniform DistortionParams uvDistortion;
    uniform sampler2D map;

    varying highp vec3 vPosition;
#endif

varying float vVisibility;

void main(){
    vec4 diffuseColor = vec4(diffuse*vVisibility, vVisibility);

    #ifdef USE_COLOR
        diffuseColor.rgb *= vColor;
    #endif

    if (debug.diffuseColorGrey) {
        diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.333333)));
    }

    #if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
        gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
    #endif

    #ifdef USE_MAP4
        if(debug.showImage) {
            // "uvwPreTransform * m" is equal to :
            // "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
            // but more stable when both the texturing and viewing cameras have large
            // coordinate values
            mat4 m = modelMatrix;
            m[3].xyz -= uvwTexture.position;
            vec4 uvw = uvwTexture.preTransform * m * vec4(vPosition, 1.);
            if( uvw.w > 0. && distortBasic(uvw, uvDistortion)) {
                uvw = uvwTexture.postTransform * uvw;
                uvw.xyz /= 2. * uvw.w;
                uvw.xyz += vec3(0.5);
                vec3 border = min(uvw.xyz, 1. - uvw.xyz);
                if (all(greaterThan(border,vec3(0.)))) {
                    vec4 color = texture2D(map, uvw.xy);
                    color.a *= min(1., debug.borderSharpness*min(border.x, border.y));
                    diffuseColor.rgb += color.rgb * color.a;
                    diffuseColor.a += color.a;
                } else {
                    diffuseColor.rgb += fract(uvw.xyz) * debug.debugOpacity;
                    diffuseColor.a += debug.debugOpacity;
                }
            }
        }
    #endif

    diffuseColor.rgb /= diffuseColor.a > 0. ? diffuseColor.a : 1.;
    diffuseColor.a = min(1., diffuseColor.a);

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, diffuseColor.a * opacity);
}
`;