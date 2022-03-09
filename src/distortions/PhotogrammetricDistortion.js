// polynom with coefficients c evaluated at x using Horner's method
function polynom(c, x) {
    var res = c[c.length - 1];
    for (var i = c.length - 2; i >= 0; --i) {
        res = res * x + c[i];
    }
    return res;
}
function polynomVector3(c, x) {
    return c.x+x*(c.y+x*c.z);
}

// if anyone needs support for RadFour7x2, RadFour11x2, RadFour15x2 or RadFour19x2, micmac code is here :
// https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/photogram/phgr_ebner_brown_dist.cpp#L720-L875

export const chunks = {
    shaders: `
    struct Distortion {
        int method;
        int type;
        bool texture;
        bool view;
        float r2img;
        float r2max;
    };

    struct DistortionParams {
        int type;
        float F;
        vec2 C;
        vec4 R;
        vec2 P;
        vec2 b;
    };

    struct Extrapolation {
        bool texture;
        bool view;
    };

    struct Homography{
        mat3 H;
        mat3 invH;
    };

    float polynom(vec3 R, float x) {
        float x2 = x*x;
        return dot(R, vec3(x, x2, x*x2));
    }

    void radial(inout vec2 p, DistortionParams disto, vec2 r) {
        float r2 = dot(r, r);
        p.xy += r * polynom(disto.R.xyz, r2);
    }

    void tangentional(inout vec2 p, DistortionParams disto, vec2 r) {
        float x2 = r.x*r.x;
        float y2 = r.y*r.y;
        float xy = r.x*r.y;
        float r2 = dot(r, r);
        p.x += disto.P.x*(2.*x2 + r2) + disto.P.y*2.*xy;
        p.y += disto.P.y*(2.*y2 + r2) + disto.P.x*2.*xy;
    }

    void fraser(inout vec2 p, DistortionParams disto, vec2 r) {
        // Radial
        radial(p.xy, disto, r);
        // Tangentional
        tangentional(p, disto, r);
        // Affine
        p.x += disto.b.x*r.x + disto.b.y*r.y;
    }

    void fisheye(inout vec2 p, DistortionParams disto, vec2 r) {
        vec2 AB = r/disto.F;
        float R = sqrt(dot(AB, AB));
        float theta = atan(R);
        float lambda = theta/R;
        vec2 P = lambda*AB;
        float r2 = dot(P, P);
        // Radial distortion and degree 1 polynomial
        vec2 rad = P;
        radial(rad, disto, rad);
        p.x = P.y*disto.b.y + P.x*disto.b.x + rad.x;
        p.y = P.x*disto.b.y + rad.y;
        // Tangential distortion
        tangentional(p, disto, P);
        // Normalization
        p = disto.C + disto.F*p;
    }

    void fisheyeRadial(inout vec2 p, DistortionParams disto, vec2 r) {
        vec2 AB = r/disto.F;
        float R = sqrt(dot(AB, AB));
        float theta = atan(R);
        float lambda = theta/R;
        vec2 P = lambda*AB;
        float r2 = dot(P, P);
        // Radial distortion 
        vec2 rad = P;
        radial(rad, disto, rad);
        p.x = rad.x;
        p.y = rad.y;
        // Normalization
        p = disto.C + disto.F*p;
    }

    void distortPoint(inout vec2 p, DistortionParams disto) {
        vec2 r = p.xy - disto.C;
        if (disto.type == 1) radial(p, disto, r);
        else if (disto.type == 2) fraser(p, disto, r);
        else if (disto.type == 3) fisheye(p, disto, r);
    }

    void distortPointRadial(inout vec2 p, DistortionParams disto) {
        vec2 r = p.xy - disto.C;
        if (disto.type == 1 || disto.type == 2) radial(p, disto, r);
        else if (disto.type == 3) fisheyeRadial(p, disto, r);
    }

    bool distortBasic(inout vec4 p, DistortionParams disto) {
        if(disto.R.w == 0. || disto.type < 1 || disto.type > 3) return true;
        p /= p.w;
        vec2 r = p.xy - disto.C;
        float r2 = dot(r, r);
        if (r2 > disto.R.w) return false; // to be culled
        distortPoint(p.xy, disto);
        return true;
    }

    bool distortRadial(inout vec4 p, DistortionParams disto) {
        if(disto.R.w == 0. || disto.type < 1 || disto.type > 3) return true;
        p /= p.w;
        vec2 r = p.xy - disto.C;
        float r2 = dot(r, r);
        vec2 point = p.xy;

        if (r2 > disto.R.w) point = normalize(r)*sqrt(disto.R.w) + disto.C;

        distortPointRadial(point, disto);

        if (r2 > disto.R.w){
            vec2 d = point - disto.C;
            float d2 = dot(d, d);
            p.xy = disto.C + (r*sqrt(d2))/sqrt(disto.R.w);
            return false;
        }else p.xy = point;
        return true;
    }

    void extrapolateHomography(inout vec2 p, mat3 H){
        vec3 point = vec3(p.x, p.y, 1.);
        point = H * point;
        p = point.xy/point.z;
    }

    bool distortHomography(inout vec4 p, DistortionParams disto, Homography h) {
        if(disto.R.w == 0. || disto.type < 1 || disto.type > 3) return true;
        p /= p.w;
        vec2 r = p.xy - disto.C;
        float r2 = dot(r, r);

        if (r2 > disto.R.w) {
            extrapolateHomography(p.xy, h.H);
            return false;
        } 
        
        distortPoint(p.xy, disto);
        return true;
    }

    const int N = 50;
    const float m_err2_max = 0.5;

    bool distortInverseRadial(inout vec4 p, DistortionParams disto) {
        if(disto.R.w == 0. || disto.type < 1 || disto.type > 3) return true;
        p /= p.w;
        vec2 v = p.xy - disto.C;
        float v2 = dot(v, v);

        float r2_max = disto.R.w;
        float r_max = sqrt(r2_max);
        vec2 point_rmax = normalize(v)*r_max + disto.C;
        distortPointRadial(point_rmax, disto);
        vec2 rd_max = point_rmax - disto.C;
        float rd2_max = dot(rd_max, rd_max);
        vec3 derivative = disto.R.xyz * vec3(3.,5.,7.);
        float ratio = r_max/sqrt(rd2_max);

        if(v2 < rd2_max) {
            if (disto.type < 1 || disto.type > 3) return true;
            float rd = sqrt(v2), r0 = r_max, r1 = rd*ratio, r = r1;
            vec2 point = normalize(v)*r + disto.C;
            distortPointRadial(point, disto);
            vec2 r_point = point - disto.C;
            float r2_point = dot(r_point, r_point);
            float d_r0 = sqrt(rd2_max), d_r1 = sqrt(r2_point);
            float err = rd - sqrt(r2_point), err2 = err*err;
            for (int i = 0; i < N; i++) { // iterate max N times
                if (err2 < m_err2_max) break;
                r = clamp(r + (err*(r1-r0)/(d_r1-d_r0)), 0., r_max);
                r0 = r1; r1 = r;
                point = normalize(v)*r + disto.C;
                distortPointRadial(point, disto);
                r_point = point - disto.C;
                r2_point = dot(r_point, r_point);
                d_r0 = d_r1; d_r1 = sqrt(r2_point);
                err = rd - sqrt(r2_point), err2 = err*err;
            }
            if(err2 > m_err2_max) return false;
            p.xy = disto.C + (r/rd)*v;
        }else {
            if (disto.type < 1 || disto.type > 3) return false;
            p.xy = disto.C + ratio*v;
            return false;
        }
        return true;
    }
`,
};

export default {
    polynom,
    polynomVector3,
};
