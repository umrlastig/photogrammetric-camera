import { ShaderMaterial, Matrix4, Vector3, Vector4, ShaderChunk } from 'three';
import { pop, definePropertyUniform, textureMatrix } from './materialUtils.js';
import proj_texture_pars_vertex from './chunks/proj_texture_pars_vertex.glsl.js';
import proj_texture_pars_fragment from './chunks/proj_texture_pars_fragment.glsl.js';
import proj_texture_fragment from './chunks/proj_texture_fragment.glsl.js';
import proj_texture_vertex from './chunks/proj_texture_vertex.glsl.js';
import ProjectingMaterialVS from './shaders/ProjectingMaterialVS.glsl.js';
import ProjectingMaterialFS from './shaders/ProjectingMaterialFS.glsl.js';

ShaderChunk.proj_texture_pars_vertex = proj_texture_pars_vertex;
ShaderChunk.proj_texture_vertex = proj_texture_vertex;
ShaderChunk.proj_texture_pars_fragment = proj_texture_pars_fragment;
ShaderChunk.proj_texture_fragment = proj_texture_fragment;

class ProjectingMaterial extends ShaderMaterial {
  constructor(options = {}) {
    const size = pop(options, 'size', 1);
    const textureCameraPosition = pop(options, 'textureCameraPosition', new Vector3());
    const textureCameraPreTransform = pop(options, 'textureCameraPreTransform', new Matrix4());
    const textureCameraPostTransform = pop(options, 'uvwPostTransform', new Matrix4());
    const uvDistortion = pop(options, 'uvDistortion', {R: new Vector4(), C: new Vector3()});
    const map = pop(options, 'map', null);
    const depthMap = pop(options, 'depthMap', null);
    const diffuseColorGrey = pop(options, 'diffuseColorGrey', true);

    options.defines = options.defines || {};
    options.defines.USE_COLOR = '';
    if (map) {
        options.defines.USE_PROJECTIVE_TEXTURING = '';
        options.defines.EPSILON = 1e-3;
    }

    super(options);

    definePropertyUniform(this, 'size', size);
    definePropertyUniform(this, 'textureCameraPosition', textureCameraPosition);
    definePropertyUniform(this, 'textureCameraPreTransform', textureCameraPreTransform);
    definePropertyUniform(this, 'textureCameraPostTransform', textureCameraPostTransform);
    definePropertyUniform(this, 'uvDistortion', uvDistortion);
    definePropertyUniform(this, 'map', map);
    definePropertyUniform(this, 'depthMap', depthMap);
    definePropertyUniform(this, 'diffuseColorGrey', diffuseColorGrey);

    this.vertexShader = ProjectingMaterialVS;
    this.fragmentShader = ProjectingMaterialFS;
  }

  setCamera(camera) {
      camera.getWorldPosition(this.textureCameraPosition);
      this.textureCameraPreTransform.copy(camera.matrixWorldInverse);
      this.textureCameraPreTransform.setPosition(0, 0, 0);
      this.textureCameraPreTransform.premultiply(camera.preProjectionMatrix);
      this.textureCameraPostTransform.copy(camera.postProjectionMatrix);
      this.textureCameraPostTransform.premultiply(textureMatrix);

      if (camera.distos && camera.distos.length == 1 && camera.distos[0].isRadialDistortion) {
          this.uvDistortion = camera.distos[0];
      } else {
          this.uvDistortion = { C: new THREE.Vector2(), R: new THREE.Vector4() };
          this.uvDistortion.R.w = Infinity;
      }
  }
}

export default ProjectingMaterial;
