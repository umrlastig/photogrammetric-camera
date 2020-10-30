import { ShaderMaterial, ShaderLib, Matrix4, Vector3, Vector4, Color } from 'three';

import {pop, definePropertyUniform, setUvwCamera, setDistortion} from './materialUtils';

class OrientedImageMaterial extends ShaderMaterial {
    constructor(options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const uvwTexture = pop(options, 'uvwTexture', {position: new Vector3(),
            preTransform: new Matrix4(), postTransform: new Matrix4()});
        const uvwView = pop(options, 'uvwView', {position: new Vector3(),
            preTransform: new Matrix4(), postTransform: new Matrix4()});
        const uvDistortion = pop(options, 'uvDistortion', {R: new Vector4(), C: new Vector3()});
        const map = pop(options, 'map', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const debug = pop(options, 'debug', {borderSharpness: 500, diffuseColorGrey: true,
            debugOpacity: 0, showImage: false});
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
        definePropertyUniform(this, 'uvwTexture', uvwTexture);
        definePropertyUniform(this, 'uvwView', uvwView);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'debug', debug);
    }

    setCamera(texture, view) {
        this.uvwTexture = setUvwCamera(texture);
        this.uvwView = setUvwCamera(view);
        this.uvDistortion = setDistortion(texture);
    }
}

export const chunks = {
    shaders: `
    struct Debug {
        float borderSharpness;
        bool diffuseColorGrey;
        float debugOpacity;
        bool showImage;
    };
`,
};

export default OrientedImageMaterial;
