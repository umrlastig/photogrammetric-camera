import { ShaderMaterial, ShaderLib, Matrix4, Vector2, Vector3, Color, Texture } from 'three';
import { pop, definePropertyUniform, setUvwCamera, setDistortion } from './materialUtils';

const noTexture = new Texture();
const noCamera = "noCamera";

class MultipleOrientedImageMaterial extends ShaderMaterial {
    constructor(cameras, maps, options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const orientedImageCount = pop(options, 'orientedImageCount', 0);
        const showImage = pop(options, 'showImage', true);
        const map = pop(options, 'map', null);
        const maxTexture = pop(options, 'maxTexture', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const debug = pop(options, 'debug', {borderSharpness: 1000, diffuseColorGrey: false, showImage: false});
        const footprint = pop(options, 'footprint', {border: 2, image: true, heatmap: true});
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

        this.extensions.derivatives = true; // use of derivatives

        this.cameras = cameras;
        this.maps = maps;

        const projected = [];
        const texture = [];
        const border = [];
        const uvwTexture = [];
        const uvDistortion = [];

        for (let i = 0; i < this.defines.MAX_TEXTURE; ++i) {
            projected[i] = noCamera;
            texture[i] = noTexture;
            border[i] = {color: new Color(0x000), linewidth: 5., fadein: 1., fadeout: 1.,
                dashed: false, dashwidth: 2., fadedash: 2., radius: 0.};
            uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }

        definePropertyUniform(this, 'size', size);
        definePropertyUniform(this, 'diffuse', diffuse);
        definePropertyUniform(this, 'orientedImageCount', orientedImageCount);
        definePropertyUniform(this, 'showImage', showImage);
        definePropertyUniform(this, 'projected', projected);
        definePropertyUniform(this, 'texture', texture);
        definePropertyUniform(this, 'uvwTexture', uvwTexture);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'debug', debug);
        definePropertyUniform(this, 'footprint', footprint);
        definePropertyUniform(this, 'border', border);
    }

    setRadius(camera, uvDistortion) {
        uvDistortion.R.w  = camera.radius.r2img;

        if(!(camera.distos && camera.distos.length == 1)) {
            const x = camera.view.fullWidth/2.;
            const y = camera.view.fullHeight/2.;
            uvDistortion.C = new Vector2(x, y);
        }
    }

    setBorder(camera, border = {}) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                this.border[index].color = pop(border, 'color', this.border[index].color);
                this.border[index].linewidth = pop(border, 'linewidth', this.border[index].linewidth);
                this.border[index].fadein = pop(border, 'fadein', this.border[index].fadein);
                this.border[index].fadeout = pop(border, 'fadeout', this.border[index].fadeout);
                this.border[index].dashed = pop(border, 'dashed', this.border[index].dashed);
                this.border[index].dashwidth = pop(border, 'dashwidth', this.border[index].dashwidth);
                this.border[index].fadedash = pop(border, 'fadedash', this.border[index].fadedash);
                this.border[index].radius = pop(border, 'radius', this.border[index].radius);
            } 
        }
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
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[index]);
                // Project the image if it has not being done
            } else if (this.orientedImageCount < this.defines.MAX_TEXTURE) {
                this.projected[this.orientedImageCount] = camera.name;
                this.texture[this.orientedImageCount] = this.maps[camera.name] || this.map; 
                this.uvwTexture[this.orientedImageCount] = setUvwCamera(camera);
                this.uvDistortion[this.orientedImageCount] = setDistortion(camera);
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[this.orientedImageCount]);

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
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[index]);
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
                    this.border[i] = this.border[i+1];
                    this.uvwTexture[i] = this.uvwTexture[i+1];
                    this.uvDistortion[i] = this.uvDistortion[i+1];
                }

                // Erase the last value
                this.projected[this.orientedImageCount] = noCamera;
                this.texture[this.orientedImageCount] = noTexture;
                this.border[this.orientedImageCount] = {color: new Color(0x000),
                    linewidth: 5., fadein: 1., fadeout: 1., dashed: false, dashwidth: 2., fadedash: 2., radius: 0.}
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
            this.border[i] = {color: new Color(0x000), linewidth: 5., fadein: 1., fadeout: 1.,
                dashed: false, dashwidth: 2., fadedash: 2., radius: 0.};
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
        vec3 color;

        float linewidth;
        float fadein;
        float fadeout; 

        bool dashed;
        float dashwidth;
        float fadedash;

        float radius;
    };

    struct Footprint {
        float border;
        bool image;
        bool heatmap;
    };
`,
};

export default MultipleOrientedImageMaterial;