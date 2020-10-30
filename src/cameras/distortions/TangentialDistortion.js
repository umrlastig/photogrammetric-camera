import { Vector2 } from 'three';

class TangentialDistortion {
    /**
   * @Constructor
   * @param {Number[2]} C - distortion center in pixels
   * @param {Number[]} P - polynom coefficients
   **/
  constructor(C, P) {
      if(P.length > 2) {
          console.warn('TangentialDistortion is currently limited to 2 coefficients: Neglecting higher order coefficients.');
      }
      P[0] = P[0] || 0;
      P[1] = P[1] || 0;
      this.C = Array.isArray(C) ? new Vector2().fromArray(C) : C;
      this.P = new Vector2().fromArray(P);
  }

  project(p) {
      var x = p.x - this.C.x;
      var y = p.y - this.C.y;
      var x2 = x*x;
      var y2 = y*y;
      var xy = x*y;
      var r2 = x2 + y2;
      p.x += this.P.x*(2.*x2 + r2) + this.P.y*2.*xy;
      p.y += this.P.y*(2.*y2 + r2) + this.P.x*2.*xy;
  }
}

export default TangentialDistortion;
