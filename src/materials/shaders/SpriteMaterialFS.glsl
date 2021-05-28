#include <distortions/radial_pars_fragment>

uniform bool diffuseColorGrey;
uniform sampler2D map;
uniform RadialDistortion uvDistortion;
uniform mat3 M_prime_Post;
varying mat3 vH;
varying vec4 vColor;
varying float passShadowMapTest;

void main() {
  vec4 finalColor = vColor;

  if (diffuseColorGrey) {
    finalColor.rgb = vec3(dot(vColor.rgb, vec3(0.333333)));
  }

  if (passShadowMapTest > 0.5) {

    vec3 texCoord = vH * vec3(gl_FragCoord.xy, 1.);

    // Don't texture if texCoord.z < 0 (z = w in this case)
    if (texCoord.z > 0. && distort_radial_vec3(texCoord, uvDistortion)) {

      texCoord = M_prime_Post * texCoord;
      texCoord /= texCoord.z;

      // Test if coordinates are valid, so we can texture
      vec2 testBorder = min(texCoord.xy, 1. - texCoord.xy);

      if (all(greaterThan(testBorder,vec2(0.))))
      {
        finalColor = texture2D(map, texCoord.xy);
      } else {
    	   finalColor.rgb = vec3(0.2); // shadow color
      }

    } else {
  	   finalColor.rgb = vec3(0.2); // shadow color
    }

  } else {
     finalColor.rgb = vec3(0.2); // shadow color
  }

  gl_FragColor =  finalColor;
}
