export default /* glsl */`
#ifdef USE_LOGDEPTHBUF
    #ifdef USE_LOGDEPTHBUF_EXT
        varying float vFragDepth;
        varying float vIsPerspective;
    #else
        uniform float logDepthBufFC;
    #endif
#endif

#ifdef USE_MAP4
    #undef USE_MAP
    varying highp vec3 vPosition;
#endif

#ifdef USE_COLOR
    varying vec3 vColor;
#endif

uniform float size;
attribute float visibility;
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
    #endif

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);

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