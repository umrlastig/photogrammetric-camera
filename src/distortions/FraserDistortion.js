import { Vector2 } from 'three';
import { default as PhotogrammetricDistortion } from './PhotogrammetricDistortion';
import { default as RadialDistortion } from './RadialDistortion';
import { default as TangentialDistortion } from './TangentialDistortion';

class FraserDistortion {

  /**
   * @Constructor
   * @param {Number[2]} C - distortion center in pixels
   * @param {Number[2]} P - coefficients
   * @param {Number[]} R - radial coefficients
   * @param {Number[2]} b - coefficients
   **/
  constructor(C, P, R, b) {
    const radial = new RadialDistortion(C, R);
    const tangential = new TangentialDistortion(C, P);
    this.C = radial.C;
    this.R = radial.R;
    this.P = tangential.P;
    this.b = new Vector2().fromArray(b);
    this.isFraserDistortion = true;
  }

// https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/photogram/phgr_ebner_brown_dist.cpp#L441-L475
// WithFraser=true
  project(p) {
    var x = p.x - this.C.x;
    var y = p.y - this.C.y;
    var x2 = x * x;
    var y2 = y * y;
    var xy = x * y;
    var r2 = x2 + y2;
    var R = this.R.toArray(); R.pop();
    var radial = r2 * PhotogrammetricDistortion.polynom(R, r2);
    p.x += radial * x + this.P.x * (2 * x2 + r2) + this.P.y * 2 * xy;
    p.y += radial * y + this.P.y * (2 * y2 + r2) + this.P.x * 2 * xy;
    p.x += this.b.x * x + this.b.y * y;
    return p;
  }
}

export default FraserDistortion;
