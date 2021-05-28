void fromRadial(const vec2 center, const vec2 resolution, const float pad, inout vec2 p) {
  p.y *= 2.;
  if(p.y>1.) {
    p.y -= 1.;
    p = ((resolution+2.*pad)*p-pad)/resolution;
    float t = p.x < center.x ? p.x/center.x : (1.-p.x)/(1.-center.x) ;
    p.y = mix(p.y, center.y, t);
  } else {
    p = ((resolution+2.*pad)*p-pad)/resolution;
    float t = p.y < center.y ? p.y/center.y : (1.-p.y)/(1.-center.y) ;
    p.x = mix(p.x, center.x, t);
  }
}

void toRadial(const vec2 center, const vec2 resolution, const float pad, inout vec2 p) {
  float t = p.y < center.y ? p.y/center.y : (1.-p.y)/(1.-center.y) ;
  float u = p.x < center.x ? p.x/center.x : (1.-p.x)/(1.-center.x) ;
  if(t>u) {
    p.x -= 0.5/resolution.x;
    p.y = mix(p.y, center.y, -u/(1.-u));
    p = clamp(p, 0., 1.);
    p = (resolution*p +pad)/(resolution+2.*pad);
    p.y++;
  } else {
    p.y -= 0.5/resolution.y;
    p.x = mix(p.x, center.x, -t/(1.-t));
    p = clamp(p, 0., 1.);
    p = (resolution*p +pad)/(resolution+2.*pad);
  }
  p.y *= 0.5;
}
