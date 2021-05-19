import { Uniform, ShaderMaterial, Vector2, Vector3, Vector4, Matrix3, Matrix4 } from 'three';
import { definePropertyUniform, textureMatrix } from './Material.js';
import SpriteMaterialVS from './shaders/SpriteMaterialVS.glsl';
import SpriteMaterialFS from './shaders/SpriteMaterialFS.glsl';


// M^(-1) -> this.viewProjectionInverse
// C -> uniform vec3 cameraPosition
// M' -> this.textureCameraPostTransform * this.textureCameraPreTransform
// C' -> this.textureCameraPosition
// P -> attribute vec3 position;

class SpriteMaterial extends ShaderMaterial {
  constructor() {
    super();

    this.uniforms.screenSize = new Uniform(new Vector2());
    definePropertyUniform(this, 'size', 3);
    definePropertyUniform(this, 'textureCameraPosition', new Vector3());
    definePropertyUniform(this, 'textureCameraPreTransform', new Matrix4());
    definePropertyUniform(this, 'textureCameraPostTransform', new Matrix4());
    definePropertyUniform(this, 'viewProjectionScreenInverse', new Matrix3());
    definePropertyUniform(this, 'M_prime', new Matrix3());
    definePropertyUniform(this, 'E_prime', new Vector3());
    definePropertyUniform(this, 'uvDistortion', {R: new Vector4(), C: new Vector3()});
    definePropertyUniform(this, 'map', null);
    definePropertyUniform(this, 'depthMap', null);
    definePropertyUniform(this, 'screenSize', new Vector2());
    definePropertyUniform(this, 'diffuseColorGrey', true);

    this.defines.USE_COLOR = '';

    this.vertexShader = SpriteMaterialVS;

    this.fragmentShader = SpriteMaterialFS;
  }

  setCamera(camera) {
      camera.getWorldPosition(this.textureCameraPosition);
      this.textureCameraPreTransform.copy(camera.matrixWorldInverse);
      this.textureCameraPreTransform.setPosition(0, 0, 0);
      this.textureCameraPreTransform.premultiply(camera.preProjectionMatrix);
      this.textureCameraPostTransform.copy(camera.postProjectionMatrix);
      this.textureCameraPostTransform.premultiply(textureMatrix);

      var tmp = new Matrix4().multiplyMatrices(this.textureCameraPostTransform, this.textureCameraPreTransform);
      var els = tmp.elements;
      this.M_prime.set(
        els[0], els[4], els[8],
        els[1], els[5], els[9],
        els[3], els[7], els[11]);

      if (camera.distos && camera.distos.length == 1 && camera.distos[0].type === 'ModRad') {
          this.uvDistortion = camera.distos[0];
      } else {
          this.uvDistortion = { C: new THREE.Vector2(), R: new THREE.Vector4() };
          this.uvDistortion.R.w = Infinity;
      }
  }

  setViewCamera(camera) {
    camera.updateMatrixWorld(); // the matrixWorldInverse should be up to date
    this.E_prime.subVectors(camera.position, this.textureCameraPosition).applyMatrix3(this.M_prime);

    var viewProjectionTransformMat4 = new Matrix4();
    viewProjectionTransformMat4.copy(camera.matrixWorldInverse);
    viewProjectionTransformMat4.setPosition(0, 0, 0);
    viewProjectionTransformMat4.premultiply(camera.preProjectionMatrix);
    viewProjectionTransformMat4.premultiply(camera.postProjectionMatrix);

    var els = viewProjectionTransformMat4.elements;
    this.viewProjectionScreenInverse.set(
      els[0], els[4], els[8],
      els[1], els[5], els[9],
      els[3], els[7], els[11]).invert();

    const screenInverse = new Matrix3().set(
      2/this.uniforms.screenSize.value.x, 0, -1,
      0, 2/this.uniforms.screenSize.value.y, -1,
      0, 0, 1
    );

    this.viewProjectionScreenInverse.multiply(screenInverse);

  }


   setScreenSize(width, height) {
     this.uniforms.screenSize.value.set(width, height);
   }
}

export default SpriteMaterial;
