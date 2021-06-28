import { chunks as disto } from '../cameras/PhotogrammetricDistortion';
import { chunks as material } from '../materials/MultipleOrientedImageMaterial';

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
    uniform Camera uvwTexture[ORIENTED_IMAGE_COUNT];
    uniform DistortionParams uvDistortion[ORIENTED_IMAGE_COUNT];
    uniform sampler2D texture[MAX_TEXTURE];
    uniform sampler2D depthTexture[MAX_TEXTURE];

    varying highp vec3 vPosition;
#endif

varying float vVisibility;

void main() {
    vec4 diffuseColor = vec4(diffuse*vVisibility, vVisibility);
    vec4 borderColor = vec4(0.);

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
            for (int i = 0; i < MAX_TEXTURE; i++) {
                // "uvwPreTransform * m" is equal to :
                // "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
                // but more stable when both the texturing and viewing cameras have large
                // coordinate values
                mat4 m = modelMatrix;
                m[3].xyz -= uvwTexture[i].position;
                vec4 uvw = uvwTexture[i].preTransform * m * vec4(vPosition, 1.);

                // Shadow mapping
                vec4 uvwNotDistorted = uvwTexture[i].postTransform * uvw;
                uvwNotDistorted.xyz /= 2. * uvwNotDistorted.w;
                uvwNotDistorted.xyz += vec3(0.5);

                float minDist = texture2D(depthTexture[i], uvwNotDistorted.xy).r;
                float distanceCamera = uvwNotDistorted.z;

                vec3 testBorderNotDistorted = min(uvwNotDistorted.xyz, 1. - uvwNotDistorted.xyz);

                // Test for shadow mapping
                if (all(greaterThan(testBorderNotDistorted, vec3(0.))) && distanceCamera <= minDist + EPSILON) {
                    if(uvw.w > 0. && distortBasic(uvw, uvDistortion[i])) {
                        uvw = uvwTexture[i].postTransform * uvw;
                        uvw.xyz /= 2. * uvw.w;
                        uvw.xyz += vec3(0.5);

                        vec3 border = min(uvw.xyz, 1. - uvw.xyz);
                        if (all(greaterThan(border, vec3(0.)))) {
                            vec4 imageColor = texture2D(texture[i], uvw.xy);
                            imageColor.a *= min(1., debug.borderSharpness*min(border.x, border.y));

                            diffuseColor.rgb += imageColor.rgb * imageColor.a;
                            diffuseColor.a += imageColor.a;
                        } 
                    }
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