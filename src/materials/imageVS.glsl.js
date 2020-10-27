export default /* glsl */`
#ifdef USE_MAP4
    varying highp vec3 vPosition;
    #undef USE_MAP
#endif

void main(){
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    
    #ifdef USE_MAP4
        vPosition = position;
    #endif
}
`;