import { chunks as disto } from '../cameras/PhotogrammetricDistortion';
import { chunks as material } from '../materials/OrientedImageMaterial';

export default /* glsl */`
${disto.shaders}
${material.shaders}
#ifdef USE_LOGDEPTHBUF
    #ifdef USE_LOGDEPTHBUF_EXT
        varying float vFragDepth;
        varying float vIsPerspective;
    #else
        uniform float logDepthBufFC;
    #endif
#endif

uniform Camera uvwView;
uniform Distortion distortion;
uniform DistortionParams uvDistortion;
varying highp vec4 vUvw;

bool isPerspectiveMatrix( mat4 m ) {
    return m[ 2 ][ 3 ] == - 1.0;
}

void main () {
    // Transform from normalized coords to pixel coords
    vec2 vUv = (uv*2.) - 1.;
    vUvw = vec4(vUv, 0., 1.);

    vec4 uvw = uvwView.postTransInv * vUvw;

    if(distortion.view && distortion.method == 2){
        vec4 distorted = uvw;
        distortInverseRadial(distorted, uvDistortion);
        if (uvDistortion.type > 0 && uvDistortion.type < 4) uvw.xy = distorted.xy*uvw.w;
    }

    gl_Position = uvwView.postTransform * uvw;

    #ifdef USE_LOGDEPTHBUF
        #ifdef USE_LOGDEPTHBUF_EXT
            vFragDepth = 1.0 + gl_Position.w;
            vIsPerspective = float(isPerspectiveMatrix( projectionMatrix ));
        #else
            if (isPerspectiveMatrix( projectionMatrix )) {
                gl_Position.z = log2(max( EPSILON, gl_Position.w + 1.0 )) * logDepthBufFC - 1.0;
                gl_Position.z *= gl_Position.w;
            }
        #endif
    #endif
}
`;