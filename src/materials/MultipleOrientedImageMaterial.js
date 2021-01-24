import { ShaderMaterial, ShaderLib, Matrix4, Vector3, Color, Texture } from 'three';
import { default as PhotogrammetricCamera } from '../cameras/PhotogrammetricCamera';
import { pop, definePropertyUniform, setUvwCamera, setDistortion } from './materialUtils';

const noTexture = new Texture();
const noCamera = "noCamera";

class MultipleOrientedImageMaterial extends ShaderMaterial {
    constructor(cameras, maps, options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const orientedImageCount = pop(options, 'orientedImageCount', 0);
        const map = pop(options, 'map', null);
        const maxTexture = pop(options, 'maxTexture', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const debug = pop(options, 'debug', {borderSharpness: 1000, diffuseColorGrey: false, showImage: false});
        const border = pop(options, 'border', {thickness: 5});
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
        this.maps = maps;

        const projected = [];

        const texture = [];
        const uvwTexture = [];
        const uvDistortion = [];

        for (let i = 0; i < this.defines.MAX_TEXTURE; ++i) {
            projected[i] = noCamera;
            texture[i] = noTexture;
            uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }

        definePropertyUniform(this, 'size', size);
        definePropertyUniform(this, 'diffuse', diffuse);
        definePropertyUniform(this, 'orientedImageCount', orientedImageCount);
        definePropertyUniform(this, 'projected', projected);
        definePropertyUniform(this, 'texture', texture);
        definePropertyUniform(this, 'uvwTexture', uvwTexture);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'debug', debug);
        definePropertyUniform(this, 'border', border);
    }

    setCamera(camera) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                this.texture[index] = this.maps[camera.name] || this.map; 
                this.uvwTexture[index] = setUvwCamera(camera);
                this.uvDistortion[index] = setDistortion(camera);
                // Project the image if it has not being done
            } else if (this.orientedImageCount < this.defines.MAX_TEXTURE) {
                this.projected[this.orientedImageCount] = camera.name;
                this.texture[this.orientedImageCount] = this.maps[camera.name] || this.map; 
                this.uvwTexture[this.orientedImageCount] = setUvwCamera(camera);
                this.uvDistortion[this.orientedImageCount] = setDistortion(camera);
                this.orientedImageCount++;
            } else {
                console.log("The number of textures cannot be exceed from " + this.defines.MAX_TEXTURE + ".")
            }
        }
    }

    updateCamera(camera) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                this.texture[index] = this.maps[camera.name] || this.map; 
                this.uvwTexture[index] = setUvwCamera(camera);
                this.uvDistortion[index] = setDistortion(camera);
            } 
        }
    }

    removeCamera(camera) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                this.orientedImageCount--;
                
                // Move all the images one slot 
                for (let i = index; i < this.orientedImageCount; ++i) {
                    this.projected[i] = this.projected[i+1];
                    this.texture[i] = this.texture[i+1]; 
                    this.uvwTexture[i] = this.uvwTexture[i+1];
                    this.uvDistortion[i] = this.uvDistortion[i+1];
                }

                // Erase the last value
                this.projected[this.orientedImageCount] = noCamera;
                this.texture[this.orientedImageCount] = noTexture;
                this.uvwTexture[this.orientedImageCount] = {position: new Vector3(), preTransform: new Matrix4(), 
                    postTransform: new Matrix4(), postTransInv: new Matrix4()};
                this.uvDistortion[this.orientedImageCount] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                    P: new THREE.Vector2(), b: new THREE.Vector2()};
            }
        }
    }

    clean() {
        for (let i = 0; i < this.defines.MAX_TEXTURE; ++i) {
            this.projected[i] = noCamera;
            this.texture[i] = noTexture;
            this.uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            this.uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }
        this.orientedImageCount = 0;
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

    struct Border {
        float thickness;
    };
`,
};

export default MultipleOrientedImageMaterial;