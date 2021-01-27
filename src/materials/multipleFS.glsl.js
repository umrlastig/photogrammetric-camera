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

vec2 screenSpaceDistance(vec2 p) {
    vec2 dx = dFdx(p);
    vec2 dy = dFdy(p);
    float lx = length(vec2(dx.x,dy.x));
    float ly = length(vec2(dx.y,dy.y));
    if (lx>0.0) p.x/=lx;
    if (ly>0.0) p.y/=ly;
    
    return vec2(min(p.x,p.y),max(p.x,p.y)); // miter join
}

vec4 mixBaseColor(vec4 aColor, vec4 baseColor) {
    baseColor.rgb += aColor.rgb * aColor.a;
    baseColor.a += aColor.a; 
    return baseColor;
}

vec4 projectiveTextureColor(vec4 coords, sampler2D texture, vec4 baseColor, inout float count) {
    vec3 p = coords.xyz / (2. * coords.w);
    p += vec3(0.5);

    float distImage = getAlphaBorder(p.xy);

    if(distImage > 0.) {
        if(count < 1.){
            baseColor.a = 0.;
            baseColor.rgb = vec3(0.);
        } 
        count += 1.; 

        vec4 color = texture2D(texture, p.xy);
        color.a *= distImage; 
        
        return mixBaseColor(color, baseColor);
    } else if(border.visible){
        vec4 borderColor = vec4(border.color, 0.);

        vec3 q = coords.xyz / coords.w;

        if(q.z > 0. && q.z < 1.) {
            vec2 d = screenSpaceDistance(abs(q.xy) - vec2(1.));

            float distBorder = d.y;

            float borderin  = (border.fadein > 0.) ? smoothstep(0., border.fadein, distBorder) : float(distBorder > 0.);
            float borderout = (border.fadeout > 0.) ? smoothstep(0., border.fadeout, border.linewidth - distBorder) : float(distBorder < border.linewidth);

            borderColor.a = borderin * borderout;

            if(border.dashed) {
                float dashwidth = border.dashwidth * border.linewidth; 

                float dashratio = 0.75;         // ratios
                float dashoffset = 0.; 

                float dash = fract((dashoffset + d.x) / dashwidth);

                float dashinout = (border.fadedash > 0.) ? smoothstep(0., border.fadedash/dashwidth, min(dash, dashratio - dash)) : float(dash < dashratio);

                borderColor.a *= dashinout;
            }

            return mixBaseColor(borderColor, baseColor);
        }
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

                vec2 v = uvw.xy/uvw.w - uvDistortion[i].C;
                float r = dot(v, v);

                if(uvw.w > 0. && distortBasic(uvw, uvDistortion[i])) {
                    uvw = uvwTexture[i].postTransform * uvw;
                    diffuseColor = projectiveTextureColor(uvw, texture[i], diffuseColor, count);
                } 
                //else {
                //    diffuseColor.rgb += fract(uvw.xyz) * 0.5;
                //    diffuseColor.a += 0.5;
                //}
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