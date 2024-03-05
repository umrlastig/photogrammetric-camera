import { chunks as disto } from '../distortions/PhotogrammetricDistortion';
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
    uniform Distortion distortion;
    uniform Extrapolation extrapolation;
    uniform DistortionParams uvDistortion;
    uniform Homography homography;
    uniform sampler2D map;

    varying highp vec3 vPosition;
    varying float vValid;
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
        // "uvwPreTransform * m" is equal to :
        // "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
        // but more stable when both the texturing and viewing cameras have large
        // coordinate values
        mat4 m = modelMatrix;
        m[3].xyz -= uvwTexture.position;
        vec4 uvw = uvwTexture.preTransform * m * vec4(vPosition, 1.);

        bool extrapolatedRegion = true;
        vec4 debugColor = vec4(0.);
        if(distortion.method == 1 && debug.showRadius){
            vec2 v = uvw.xy/uvw.w - uvDistortion.C;
            float r = dot(v, v)/uvDistortion.R.w;
            debugColor = vec4(vec3(0.), fract(clamp(r*r*r*r*r, 0., 1.)));
            debugColor.a *= debug.debugOpacity;
        }
        if(debug.showImage && uvw.w > 0.) {
            if (distortion.texture) {
                if(distortion.type == 1) extrapolatedRegion = distortRadial(uvw, uvDistortion);
                else if(distortion.type == 2) extrapolatedRegion = distortHomography(uvw, uvDistortion, homography);
            }
            uvw = uvwTexture.postTransform * uvw;
            uvw.xyz /= 2. * uvw.w;
            uvw.xyz += vec3(0.5);
            vec3 border = min(uvw.xyz, 1. - uvw.xyz);
            if (all(greaterThan(border,vec3(0.)))) {
                vec4 color = texture2D(map, uvw.xy);
                color.a *= min(1., debug.borderSharpness*min(border.x, border.y));
                diffuseColor.rgb += color.rgb * opacity*color.a;
                diffuseColor.a += opacity*color.a;
            } else if(debug.showGrid){
                diffuseColor.rgb += fract(uvw.xyz) * debug.debugOpacity;
                diffuseColor.a += debug.debugOpacity;
            }
            if((vValid < 0.99 && !extrapolation.view) || (!extrapolatedRegion && !extrapolation.texture)) discard;
        }
        
        diffuseColor.rgb += debugColor.rgb * debugColor.a;
        diffuseColor.a += debugColor.a;
    #endif

    diffuseColor.rgb /= diffuseColor.a > 0. ? diffuseColor.a : 1.;
    diffuseColor.a = max(min(1., diffuseColor.a), 0.);

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, diffuseColor.a);
}
`;