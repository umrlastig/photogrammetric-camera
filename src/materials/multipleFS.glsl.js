import { chunks as disto } from '../cameras/PhotogrammetricDistortion';
import { chunks as material } from '../materials/MultipleOrientedImageMaterial';

export default /* glsl */`
${disto.shaders}
${material.shaders}
uniform vec3 diffuse;
uniform float opacity;
uniform Debug debug;
uniform Border border;

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
    uniform Camera uvwTexture[MAX_TEXTURE];
    uniform DistortionParams uvDistortion[MAX_TEXTURE];
    uniform sampler2D texture[MAX_TEXTURE];

    varying highp vec3 vPosition;
#endif

varying float vVisibility;

float getAlphaBorder(vec2 p) {
    vec2 d = clamp(debug.borderSharpness * min(p, 1. - p), 0., 1.);
    return min(d.x, d.y);
}

float getBorder(vec2 p, float thickness) {
    float x = 0. - thickness;
    float y = 1. + thickness;
    vec2 d = clamp(min(p, 1. - p), x, y);
    
    return min(d.x, d.y);
}

vec4 mixBaseColor(vec4 aColor, vec4 baseColor) {
    baseColor.rgb += aColor.rgb * aColor.a;
    baseColor.a += aColor.a; 
    return baseColor;
}

vec4 projectiveTextureColor(vec4 coords, sampler2D texture, vec4 baseColor, inout float count, float thickness) {
    vec3 p = coords.xyz / (2. * coords.w);
    p += vec3(0.5);

    float d = getAlphaBorder(p.xy);
    float b = getBorder(p.xy, thickness);

    if(d > 0.) {
        if(count < 1.){
            baseColor.a = 0.;
            baseColor.rgb = vec3(0.);
        } 
        count += 1.; 

        vec4 color = texture2D(texture, p.xy);
        color.a *= d; 
        
        return mixBaseColor(color, baseColor);
    //} else if(b > -0.1){
    //    vec4 color = vec4(1., 0., 0., 1.);
    //    color.a *= 1.; 
        
    //    return mixBaseColor(color, baseColor);
    }

    return baseColor;
}

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

    float count = 0.;
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
                if( uvw.w > 0. && distortBasic(uvw, uvDistortion[i])) {
                    uvw = uvwTexture[i].postTransform * uvw;
                    vec4 thickness = vec4(border.thickness);
                    thickness = uvwTexture[i].postTransform * thickness;
                    diffuseColor = projectiveTextureColor(uvw, texture[i], diffuseColor, count, thickness.x);
                }
            }
        }
    #endif

    diffuseColor.rgb /= diffuseColor.a > 0. ? diffuseColor.a : 1.;

    float weight = count > 0. ? 1./count : 1.;
    diffuseColor.a *= weight;
    diffuseColor.a = min(1., diffuseColor.a);

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, diffuseColor.a * opacity);
}
`;