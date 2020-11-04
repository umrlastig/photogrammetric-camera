import { ShaderMaterial, ShaderLib, Matrix3, Matrix4, Vector2, Vector3, Vector4, Color, Texture } from 'three';
import {pop, definePropertyUniform, setUvwCamera, setDistortion} from './materialUtils';

const noTexture = new Texture();
class MultipleOrientedImageMaterial extends ShaderMaterial {
    constructor(cameras, options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const orientedImageCount = pop(options, 'orientedImageCount', 1);
        const map = pop(options, 'map', null);
        const maxTexture = pop(options, 'maxTexture', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const debug = pop(options, 'debug', {borderSharpness: 1000, diffuseColorGrey: true, showImage: false});
        options.vertexShader = options.vertexShader || ShaderLib.points.vertexShader;
        options.fragmentShader = options.fragmentShader || ShaderLib.points.fragmentShader;
        options.defines = options.defines || {};
        if (map) options.defines.USE_MAP4 = '';
        if (alphaMap) options.defines.USE_ALPHAMAP = '';
        if (options.vertexColors) options.defines.USE_COLOR = '';
        if (options.logarithmicDepthBuffer) options.defines.USE_LOGDEPTHBUF = '';
        if (pop(options, 'sizeAttenuation')) options.defines.USE_SIZEATTENUATION = '';
        options.defines.MAX_TEXTURE = maxTexture !== null ? maxTexture : 1;
        super(options);

        this.cameras = cameras;

        const texture = [];
        const uvwTexture = [];
        const uvDistortion = [];

        for (let i = 0; i < this.defines.MAX_TEXTURE; ++i) {
            texture[i] = noTexture;
            uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }

        definePropertyUniform(this, 'size', size);
        definePropertyUniform(this, 'diffuse', diffuse);
        definePropertyUniform(this, 'orientedImageCount', orientedImageCount);
        definePropertyUniform(this, 'texture', texture);
        definePropertyUniform(this, 'uvwTexture', uvwTexture);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'debug', debug);
    }

    setCamera(camera, maps) {
        for (let i = 0; i < this.defines.MAX_TEXTURE; ++i) {
            if (i < this.orientedImageCount) {
                const cam = getCamera(camera, i);
                if (cam) {
                    this.texture[i] = maps[cam.name] || this.map; 
                    this.uvwTexture[i] = setUvwCamera(cam);
                    this.uvDistortion[i] = setDistortion(cam);
                }
            } else {
                this.texture[i] = noTexture;
                this.uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                    postTransform: new Matrix4(), postTransInv: new Matrix4()};
                this.uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                    P: new THREE.Vector2(), b: new THREE.Vector2()};
            }
        };
    }

    getCamera(camera, delta = 0){
        const array = this.cameras.children;
        const index = array.findIndex(cam => cam.name == camera.name);
        return array[(index + delta + array.length) % array.length];
    }
}

export const chunks = {
    shaders: `
    struct Camera {
        vec3 position;
        mat4 preTransform;
        mat4 postTransform;
        mat4 postTransInv;
    };
    
    struct Debug {
        float borderSharpness;
        bool diffuseColorGrey;
        bool showImage;
    };
`,
};

export default MultipleOrientedImageMaterial;