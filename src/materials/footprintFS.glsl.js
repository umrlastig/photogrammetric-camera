import { chunks as disto } from '../cameras/PhotogrammetricDistortion';
import { chunks as material } from '../materials/MultipleOrientedImageMaterial';

export default /* glsl */`
${disto.shaders}
${material.shaders}

uniform vec3 diffuse;
uniform float opacity;
uniform Debug debug;
uniform Footprint footprint;

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
    uniform Border border[ORIENTED_IMAGE_COUNT];

    varying highp vec3 vPosition;
#endif

varying float vVisibility;

vec3 heatmapGradient(float t) {
    float tt = t*3.14159265/2.;
    return vec3(sin(tt), sin(tt*2.), cos(tt));
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
            float count = 0.;
            for (int i = 0; i < PROY_IMAGE_COUNT; i++) {
                // "uvwPreTransform * m" is equal to :
                // "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
                // but more stable when both the texturing and viewing cameras have large
                // coordinate values
                mat4 m = modelMatrix;
                m[3].xyz -= uvwTexture[i].position;
                vec4 uvw = uvwTexture[i].preTransform * m * vec4(vPosition, 1.);

                vec2 v = uvw.xy/uvw.w - uvDistortion[i].C;
                float r = dot(v, v);

                if(uvw.w > 0. && distortBasic(uvw, uvDistortion[i]) && r < uvDistortion[i].R.w) {
                    uvw = uvwTexture[i].postTransform * uvw;
                    vec3 p = uvw.xyz / (2. * uvw.w);
                    p += vec3(0.5);
    
                    vec3 distImage = min(p, 1. - p);
                    if (all(greaterThan(distImage, vec3(0.)))) {
                        if(count < 1.) diffuseColor = vec4(0.); 
                        count += 1.; 
                        if(footprint.image && i < MAX_TEXTURE) {
                            vec4 imageColor = texture2D(texture[i], p.xy);
                            imageColor.a *= min(1., debug.borderSharpness*min(distImage.x, distImage.y));
                            //imageColor.a *= 1./(p.z*p.z);

                            diffuseColor.rgb += imageColor.rgb * imageColor.a;
                            diffuseColor.a += imageColor.a;
                        }
                    } else if(footprint.border > 0.) {
                        vec3 q = uvw.xyz / uvw.w;
                        if(q.z > 0. && q.z < 1.) {
                            vec2 d = screenSpaceDistance(abs(q.xy) - vec2(1.));
                
                            float distBorder = d.y;
                
                            float borderin  = (border[i].fadein > 0.) ? smoothstep(0., border[i].fadein, distBorder) : float(distBorder > 0.);
                            float borderout = (border[i].fadeout > 0.) ? smoothstep(0., border[i].fadeout, border[i].linewidth - distBorder) : float(distBorder < border[i].linewidth);

                            vec4 color = vec4(border[i].color, borderin * borderout);

                            if(border[i].dashed) {
                                float dashwidth = border[i].dashwidth * border[i].linewidth; 
                
                                float dashratio = 0.75;         // ratios
                                float dashoffset = 0.; 
                
                                float dash = fract((dashoffset + d.x) / dashwidth);
                
                                float dashinout = (border[i].fadedash > 0.) ? smoothstep(0., border[i].fadedash/dashwidth, min(dash, dashratio - dash)) : float(dash < dashratio);
        
                                color.a *= dashinout;
                            }

                            borderColor.rgb += color.rgb * color.a;
                            borderColor.a += color.a;
                        }
                    }
                }
            }

            diffuseColor.rgb /= diffuseColor.a > 0. ? diffuseColor.a : 1.;

            if(count > 0. && footprint.heatmap) {
                float proyImages = float(PROY_IMAGE_COUNT);
                float weight = count/proyImages;
                vec4 heatColor = vec4(heatmapGradient(weight), 1.);

                diffuseColor.rgb = footprint.image ? mix(diffuseColor.rgb, heatColor.rgb, .75) : heatColor.rgb;
                diffuseColor.a += heatColor.a;
            } 

            if(footprint.border > 1. || (count < 1. && footprint.border > 0.)) {
                borderColor.rgb /= borderColor.a > 0. ? borderColor.a : 1.;
                borderColor.a = min(1., borderColor.a);

                diffuseColor.rgb = mix(diffuseColor.rgb, borderColor.rgb, borderColor.a);
                diffuseColor.a += borderColor.a;
            }
            
            diffuseColor.a = min(1., diffuseColor.a);
        }
    #endif

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, diffuseColor.a * opacity);
}
`;