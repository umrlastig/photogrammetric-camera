import { Vector2 } from 'three';
import { default as PhotogrammetricDistortion } from './PhotogrammetricDistortion';
import { default as RadialDistortion } from './RadialDistortion';
import { default as TangentialDistortion } from './TangentialDistortion';

class FishEyeDistortion {

  /**
   * @Constructor
   * @param {Number[]} P - ?
   * @param {Number[2]} C - distortion center in pixels
   * @param {Number} F - focal length in pixels
   * @param {Number[]} l - coefficients
   * @param {Number[]} R - radial coefficients
   * @param {Bool} equisolid - equisolid fisheye or not
   **/
  constructor(P, C, F, l, R, equisolid) {
    if(R.length > 3) {
      console.warn('RadialDistortion is currently limited to 3 coefficients: Neglecting higher order coefficients.');
    }
    const radial = new RadialDistortion(C, R);
    const tangential = new TangentialDistortion(C, P);
    this.F = F;
    this.C = radial.C;
    this.R = radial.R;
    this.R.w = Infinity;
    this.P = tangential.P;
    if(l.length > 2) {
        console.warn('FishEyeDistortion is currently limited to 2 coefficients: Neglecting higher order coefficients.');
    }
    l[0] = l[0] || 0;
    l[1] = l[1] || 0;
    this.l = new Vector2().fromArray(l);
    this.equisolid = equisolid;
    this.isFishEyeDistortion = true;
  }

  project(p) {
    // https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/photogram/phgr_ebner_brown_dist.cpp#L2169-L2352
    // Apply N normalization
    var A = (p.x - this.C.x) / this.F;
    var B = (p.y - this.C.y) / this.F;
    var R = Math.sqrt(A * A + B * B);
    var theta = Math.atan(R);
    if (this.equisolid) theta = 2 * Math.sin(0.5 * theta);
    var lambda = theta / R;
    var x = lambda * A;
    var y = lambda * B;
    var x2 = x * x;
    var xy = x * y;
    var y2 = y * y;
    var r2 = x2 + y2;

    // radial distortion and degree 1 polynomial
    var Radial = this.R.toArray(); Radial.pop();
    var radial = 1 + r2 * PhotogrammetricDistortion.polynom(Radial, r2);
    p.x = y * this.l.y + x * (radial + this.l.x);
    p.y = x * this.l.y + y * radial;

    // tangential distortion
    p.x += this.P.x*(2.*x2 + r2) + this.P.y*2.*xy;
    p.y += this.P.y*(2.*y2 + r2) + this.P.x*2.*xy;

    // Unapply N normalization
    p.x = this.C.x + this.F * p.x;
    p.y = this.C.y + this.F * p.y;
    return p;
  }

 //
 
/*
   projectHighDegree(p) {
    // https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/photogram/phgr_ebner_brown_dist.cpp#L2169-L2352
    // Apply N normalization
    var A = (p.x - this.C[0]) / this.F;
    var B = (p.y - this.C[1]) / this.F;
    var R = Math.sqrt(A * A + B * B);
    var theta = Math.atan(R);
    if (this.equisolid) theta = 2 * Math.sin(0.5 * theta);
    var lambda = theta / R;
    var x = lambda * A;
    var y = lambda * B;
    var x2 = x * x;
    var xy = x * y;
    var y2 = y * y;
    var r2 = x2 + y2;

    // radial distortion and degree 1 polynomial
    var radial = 1 + r2 * PhotogrammetricDistortion.polynom(this.R, r2);
    p.x = y * this.l[1] + x * (radial + this.l[0]);
    p.y = x * this.l[1] + y * radial;

    // tangential distortion
    var rk = 1;
    for (var k = 0; k < this.P.length; k += 2) {
        var K = k + 2;
        p.x += rk * ((r2 + K * x2) * this.P[k] + this.P[k + 1] * K * xy);
        p.y += rk * ((r2 + K * y2) * this.P[k + 1] + this.P[k] * K * xy);
        rk *= r2;
    }

    // degree 3+ polynomial (no degree 2)
    var X = [x2, xy, y2];
    var j = 2;
    for (var d = 3; j < this.l.length; ++d) {
        X[d] = y * X[d - 1];
        X[0] *= x;
        p.y += this.l[j++] * X[0];
        for (var l = 1; l < d; ++l) {
            X[l] *= x;
            p.x += this.l[j++] * X[l];
            p.y += this.l[j++] * X[l];
        }
        p.x += this.l[j++] * X[d];
        if (d % 2) {
            p.y += this.l[j++] * X[d];
        }
    }

    // Unapply N normalization
    p.x = this.C[0] + this.F * p.x;
    p.y = this.C[1] + this.F * p.y;
    return p;
  }
*/
}

export default FishEyeDistortion;
