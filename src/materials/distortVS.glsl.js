import { chunks as material } from '../materials/OrientedImageMaterial';

export default /* glsl */`
${material.shaders}
#ifdef USE_LOGDEPTHBUF
    #ifdef USE_LOGDEPTHBUF_EXT
        varying float vFragDepth;
        varying float vIsPerspective;
    #else
        uniform float logDepthBufFC;
    #endif
#endif

#ifdef USE_COLOR
    varying vec3 vColor;
#endif

#ifdef USE_MAP4
    #undef USE_MAP
    uniform Camera uvwView;
    attribute float visibility;

    varying highp vec3 vPosition;
#endif

uniform float size;
varying float vVisibility;

bool isPerspectiveMatrix( mat4 m ) {
    return m[ 2 ][ 3 ] == - 1.0;
}

void main() {
    #ifdef USE_COLOR
        vColor.xyz = color.xyz;
    #endif

    vVisibility = visibility;
    
    #ifdef USE_MAP4
        vPosition = position;
        // "uvwPreTransform * m" is equal to :
        // "camera.preProjectionMatrix * camera.matrixWorldInverse * modelMatrix"
        // but more stable when both the texturing and viewing cameras have large
        // coordinate values
        mat4 m = modelMatrix;
        m[3].xyz -= uvwView.position;
        vec4 uvw = uvwView.preTransform * m * vec4(vPosition, 1.);
        gl_Position = uvwView.postTransform * uvw;
    #else 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    #endif

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

    if (size > 0.) {
        gl_PointSize = size;
    } else {
        gl_PointSize = clamp(-size/gl_Position.w, 3.0, 10.0);
    }
}
`;