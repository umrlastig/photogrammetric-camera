import { chunks as disto } from '../distortions/PhotogrammetricDistortion';
import { chunks as material } from '../materials/OrientedImageMaterial';

export default /* glsl */`
${disto.shaders}
${material.shaders}
uniform vec3 diffuse;
uniform float opacity;
uniform Debug debug;

uniform Camera uvwView;
uniform Distortion distortion;
uniform Extrapolation extrapolation;
uniform DistortionParams uvDistortion;
uniform Homography homography;
uniform sampler2D tDiffuse;

varying highp vec4 vUvw;

#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
    uniform float logDepthBufFC;
    varying float vFragDepth;
    varying float vIsPerspective;
#endif

void main(){
    #if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
        gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
    #endif
    
    vec4 uvw = uvwView.postTransInv * vUvw;

    bool extrapolatedRegion = true;
    if(distortion.view && distortion.method == 2) extrapolatedRegion = distortInverseRadial(uvw, uvDistortion);
    
    vec4 debugColor = vec4(0.);
    if(distortion.method == 2 && debug.showRadius) {
        vec2 v = uvw.xy/uvw.w - uvDistortion.C;
        float r = uvDistortion.R.w > 0. ? dot(v, v)/uvDistortion.R.w : 0.;
        debugColor = vec4(vec3(0.), fract(clamp(r*r*r*r*r, 0., 1.)));
        debugColor.a *= debug.debugOpacity;
    }

    uvw = uvwView.postTransform * uvw;
    uvw.xyz /= 2.*uvw.w;
    uvw.xyz += vec3(0.5);

    vec4 diffuseColor = texture2D(tDiffuse, uvw.xy); 

    if(!(extrapolatedRegion || extrapolation.view)) discard;

    diffuseColor.rgb += debugColor.rgb * debugColor.a;
    diffuseColor.a += debugColor.a;

    diffuseColor.rgb /= diffuseColor.a > 0. ? diffuseColor.a : 1.;
    diffuseColor.a = min(1., diffuseColor.a);

    vec3 outgoingLight = diffuseColor.rgb;
    gl_FragColor = vec4(outgoingLight, diffuseColor.a * opacity); 
}
`;