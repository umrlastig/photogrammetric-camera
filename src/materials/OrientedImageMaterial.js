import { ShaderMaterial, ShaderLib, Matrix4, Vector3, Vector4, Color } from 'three';

import {pop, definePropertyUniform} from './materialUtils';

class OrientedImageMaterial extends ShaderMaterial {
    constructor(options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const uvwPosition = pop(options, 'uvwPosition', new Vector3());
        const uvwPreTransform = pop(options, 'uvwPreTransform', new Matrix4());
        const uvwPostTransform = pop(options, 'uvwPostTransform', new Matrix4());
        const uvDistortion = pop(options, 'uvDistortion', {R: new Vector4(), C: new Vector3()});
        const map = pop(options, 'map', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const borderSharpness = pop(options, 'borderSharpness', 10000);
        const diffuseColorGrey = pop(options, 'diffuseColorGrey', true);
        const debugOpacity = pop(options, 'debugOpacity', 0);
        const showImage = pop(options, 'showImage', true);
        options.vertexShader = options.vertexShader || ShaderLib.points.vertexShader;
        options.fragmentShader = options.fragmentShader || ShaderLib.points.fragmentShader;
        options.defines = options.defines || {};
        if (map) {
            options.defines.USE_MAP4 = '';
        }
        if (alphaMap) options.defines.USE_ALPHAMAP = '';
        if (options.vertexColors) options.defines.USE_COLOR = '';
        if (options.logarithmicDepthBuffer) options.defines.USE_LOGDEPTHBUF = '';
        if (pop(options, 'sizeAttenuation')) options.defines.USE_SIZEATTENUATION = '';
        super(options);
        definePropertyUniform(this, 'size', size);
        definePropertyUniform(this, 'diffuse', diffuse);
        definePropertyUniform(this, 'uvwPosition', uvwPosition);
        definePropertyUniform(this, 'uvwPreTransform', uvwPreTransform);
        definePropertyUniform(this, 'uvwPostTransform', uvwPostTransform);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'borderSharpness', borderSharpness);
        definePropertyUniform(this, 'diffuseColorGrey', diffuseColorGrey);
        definePropertyUniform(this, 'debugOpacity', debugOpacity);
        definePropertyUniform(this, 'showImage', showImage);
    }

    setCamera(camera) {
        camera.getWorldPosition(this.uvwPosition);
        this.uvwPreTransform.copy(camera.matrixWorldInverse);
        this.uvwPreTransform.setPosition(0,0,0);
        this.uvwPreTransform.premultiply(camera.preProjectionMatrix);
        this.uvwPostTransform.copy(camera.postProjectionMatrix);

        // TODO: handle other distorsion types and arrays of distortions
        if (camera.distos && camera.distos.length == 1 && camera.distos[0].type === 'ModRad') {
            this.uvDistortion = camera.distos[0];
        } else {
            this.uvDistortion = { C: new THREE.Vector2(), R: new THREE.Vector4() };
            this.uvDistortion.R.w = Infinity;
        }
    }
}

export default OrientedImageMaterial;
