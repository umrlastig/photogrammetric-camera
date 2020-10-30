// polynom with coefficients c evaluated at x using Horner's method
function polynom(c, x) {
    var res = c[c.length - 1];
    for (var i = c.length - 2; i >= 0; --i) {
        res = res * x + c[i];
    }
    return res;
}

// if anyone needs support for RadFour7x2, RadFour11x2, RadFour15x2 or RadFour19x2, micmac code is here :
// https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/photogram/phgr_ebner_brown_dist.cpp#L720-L875

export const chunks = {
    shaders: `

    struct Distortion {
        int method;
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

    void distortPoint(inout vec2 p, DistortionParams disto) {
        vec2 r = p.xy - disto.C;
        if (disto.type == 1) radial(p, disto, r);
        else if (disto.type == 2) fraser(p, disto, r);
    }

    bool distortBasic(inout vec4 p, DistortionParams disto) {
        if(disto.type == 0) return true;
        p /= p.w;
        vec2 r = p.xy - disto.C;
        float r2 = dot(r, r);
        if (r2 > disto.R.w) return false; // to be culled
        distortPoint(p.xy, disto);
        return true;
    }
`,
};

export default { polynom };
