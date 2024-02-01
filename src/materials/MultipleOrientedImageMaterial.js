import { ShaderMaterial, ShaderLib, Matrix4, Vector2, Vector3, Color, Texture, DepthTexture } from 'three';
import { pop, definePropertyUniform, setUvwCamera, setDistortion } from './materialUtils';

const noTexture = new Texture();
const noDepthTexture = new DepthTexture();
const noCamera = "noCamera";

class MultipleOrientedImageMaterial extends ShaderMaterial {
    constructor(cameras, maps, options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const showImage = pop(options, 'showImage', true);
        const map = pop(options, 'map', null);
        const depthMap = pop(options, 'depthMap', null);
        const maxTexture = pop(options, 'maxTexture', null);
        const alphaMap = pop(options, 'alphaMap', null);
        const scale = pop(options, 'scale', 1);
        const line = pop(options, 'linewidth', 5);
        const debug = pop(options, 'debug', {borderSharpness: 1000, diffuseColorGrey: false, showImage: false});
        const footprint = pop(options, 'footprint', {border: 2, image: true, heatmap: false});
        const border = pop(options, 'border', {linewidth: line, fadein: 1., fadeout: 1.,
            dashed: false, dashwidth: 2., fadedash: 2., radius: 0.});
        options.vertexShader = options.vertexShader || ShaderLib.points.vertexShader;
        options.fragmentShader = options.fragmentShader || ShaderLib.points.fragmentShader;
        options.defines = options.defines || {};
        if (map) options.defines.USE_MAP4 = '';
        if (alphaMap) options.defines.USE_ALPHAMAP = '';
        if (options.vertexColors) options.defines.USE_COLOR = '';
        if (options.logarithmicDepthBuffer) options.defines.USE_LOGDEPTHBUF = '';
        if (pop(options, 'sizeAttenuation')) options.defines.USE_SIZEATTENUATION = '';

        options.defines.MAX_TEXTURE = maxTexture !== null ? Math.floor(maxTexture/2) - 1 : 0;
        options.defines.ORIENTED_IMAGE_COUNT = cameras.children.length > 0 ? cameras.children.length : 1;
        options.defines.PROY_IMAGE_COUNT = 0;
        options.defines.EPSILON = 1e-3;

        super(options);

        this.extensions.derivatives = true; // use of derivatives

        this.cameras = cameras;
        this.maps = maps;

        var projected = [];
        var textures = [];
        var depthTexture = [];
        var bColor = [];
        var uvwTexture = [];
        var uvDistortion = [];

        for (let i = 0; i < this.defines.ORIENTED_IMAGE_COUNT; ++i) {
            projected[i] = noCamera;
            textures[i] = noTexture;
            depthTexture[i] = noDepthTexture;
            bColor[i] = new Color(0x000);
            uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }

        definePropertyUniform(this, 'size', size);
        definePropertyUniform(this, 'diffuse', diffuse);
        definePropertyUniform(this, 'showImage', showImage);
        definePropertyUniform(this, 'projected', projected);
        definePropertyUniform(this, 'textures', textures);
        definePropertyUniform(this, 'depthTexture', depthTexture);
        definePropertyUniform(this, 'uvwTexture', uvwTexture);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'map', map);
        definePropertyUniform(this, 'depthMap', depthMap);
        definePropertyUniform(this, 'opacity', this.opacity);
        definePropertyUniform(this, 'alphaMap', alphaMap);
        definePropertyUniform(this, 'scale', scale);
        definePropertyUniform(this, 'line', line);
        definePropertyUniform(this, 'debug', debug);
        definePropertyUniform(this, 'footprint', footprint);
        definePropertyUniform(this, 'border', border);
        definePropertyUniform(this, 'bColor', bColor);
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
                this.bColor[index] = pop(border, 'color', this.bColor[index]);
            } 
        }

        this.border.linewidth = pop(border, 'linewidth', this.border.linewidth);
        this.border.fadein = pop(border, 'fadein', this.border.fadein);
        this.border.fadeout = pop(border, 'fadeout', this.border.fadeout);
        this.border.dashed = pop(border, 'dashed', this.border.dashed);
        this.border.dashwidth = pop(border, 'dashwidth', this.border.dashwidth);
        this.border.fadedash = pop(border, 'fadedash', this.border.fadedash);
        this.border.radius = pop(border, 'radius', this.border.radius);
    }

    setCamera(camera, opt = {}) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Update the number of cameras
            this.updateCameraData();
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                if (index < this.defines.MAX_TEXTURE) {
                    this.textures[index] = this.maps[camera.name] || this.map;
                    if(camera.renderTarget) this.depthTexture[index] = camera.renderTarget.depthTexture || this.depthMap; 
                }
                this.uvwTexture[index] = setUvwCamera(camera);
                this.uvDistortion[index] = setDistortion(camera);
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[index]);
                this.setBorder(camera, opt);
                // Project the image if it has not being done
            } else {
                this.projected[this.defines.PROY_IMAGE_COUNT] = camera.name;
                if (this.defines.PROY_IMAGE_COUNT < this.defines.MAX_TEXTURE) { 
                    this.textures[this.defines.PROY_IMAGE_COUNT] = this.maps[camera.name] || this.map;
                    if(camera.renderTarget) 
                        this.depthTexture[this.defines.PROY_IMAGE_COUNT] = camera.renderTarget.depthTexture || this.depthMap;
                }
                this.uvwTexture[this.defines.PROY_IMAGE_COUNT] = setUvwCamera(camera);
                this.uvDistortion[this.defines.PROY_IMAGE_COUNT] = setDistortion(camera);
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[this.defines.PROY_IMAGE_COUNT]);
                this.setBorder(camera, opt);
                this.defines.PROY_IMAGE_COUNT++;
            } 
            this.needsUpdate = true;
        }
    }

    updateCamera(camera, opt = {}) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                if (this.defines.PROY_IMAGE_COUNT < this.defines.MAX_TEXTURE) {
                    this.textures[index] = this.maps[camera.name] || this.map;
                    if(camera.renderTarget) this.depthTexture[index] = camera.renderTarget.depthTexture || this.depthMap; 
                }
                    
                this.uvwTexture[index] = setUvwCamera(camera);
                this.uvDistortion[index] = setDistortion(camera);
                // Change the value or maximum radius to the one that only surrounds the image.
                this.setRadius(camera, this.uvDistortion[index]);
                this.setBorder(camera, opt);
            } 
        }
    }

    updateCameraData() {
        if(this.cameras.children.length > 0 && this.defines.ORIENTED_IMAGE_COUNT != this.cameras.children.length) {
            // Update the data of each camera
            const projected = [];
            const texture = [];
            const depthTexture = [];
            const bColor = [];
            const uvwTexture = [];
            const uvDistortion = [];

            for (let i = 0; i < this.cameras.children.length; ++i) {
                projected[i] = noCamera;
                if(i < this.defines.MAX_TEXTURE) {
                    texture[i] = noTexture;
                    depthTexture[i] = noDepthTexture;
                } 
                bColor[i] = new Color(0x000);
                uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                    postTransform: new Matrix4(), postTransInv: new Matrix4()};
                uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                    P: new THREE.Vector2(), b: new THREE.Vector2()};
            }

            var count = 0;
            this.cameras.children.forEach(camera => {
                const index = this.projected.findIndex(proj => proj == camera.name);
                if(index > -1) {
                    projected[count] = this.projected[index];
                    if (count < this.defines.MAX_TEXTURE) {
                        texture[count] = this.textures[index];
                        depthTexture[count] = this.depthTexture[index];
                    } 
                    bColor[count] = this.bColor[index];
                    uvwTexture[count] = this.uvwTexture[index];
                    uvDistortion[count] = this.uvDistortion[index];
                    count++;
                }
            });

            this.projected = projected;
            this.textures = texture;
            this.depthTexture = depthTexture;
            this.bColor = bColor;
            this.uvwTexture = uvwTexture;
            this.uvDistortion = uvDistortion;

            // Update the number of cameras
            this.defines.ORIENTED_IMAGE_COUNT = this.cameras.children.length;
            this.needsUpdate = true;
        }
    }

    removeCamera(camera) {
        // The cameras have been loaded?
        if(this.cameras.children.length > 0) {
            // Check if the camera is already projected
            const index = this.projected.findIndex(proj => proj == camera.name);
            if (index > -1) {
                this.defines.PROY_IMAGE_COUNT--;
                
                // Move all the images one slot 
                for (let i = index; i < this.defines.PROY_IMAGE_COUNT; ++i) {
                    this.projected[i] = this.projected[i+1];
                    if (i < this.defines.MAX_TEXTURE) {
                        this.textures[i] = this.textures[i+1];
                        this.depthTexture[i] = this.depthTexture[i+1]; 
                    }
                    this.bColor[i] = this.bColor[i+1];
                    this.uvwTexture[i] = this.uvwTexture[i+1];
                    this.uvDistortion[i] = this.uvDistortion[i+1];
                }

                // Erase the last value
                this.projected[this.defines.PROY_IMAGE_COUNT] = noCamera;
                if (this.defines.PROY_IMAGE_COUNT < this.defines.MAX_TEXTURE) {
                    this.textures[this.defines.PROY_IMAGE_COUNT] = noTexture;
                    this.depthTexture[this.defines.PROY_IMAGE_COUNT] = noDepthTexture;
                }
                this.bColor[this.defines.PROY_IMAGE_COUNT] = new Color(0x000);
                this.uvwTexture[this.defines.PROY_IMAGE_COUNT] = {position: new Vector3(), preTransform: new Matrix4(), 
                    postTransform: new Matrix4(), postTransInv: new Matrix4()};
                this.uvDistortion[this.defines.PROY_IMAGE_COUNT] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                    P: new THREE.Vector2(), b: new THREE.Vector2()};
            }
        }
    }

    onBeforeCompile(shader) {
        shader.fragmentShader = shader.fragmentShader.replace(/PROY_IMAGE_COUNT/i, this.defines.PROY_IMAGE_COUNT);
        shader.fragmentShader = shader.fragmentShader.replace(/MAX_TEXTURE/i, this.defines.MAX_TEXTURE);
    }

    clean() {
        this.defines.PROY_IMAGE_COUNT = 0;
        this.ORIENTED_IMAGE_COUNT = this.cameras.children.length > 0 ? this.cameras.children.length : 1;

        for (let i = 0; i < this.defines.ORIENTED_IMAGE_COUNT; ++i) {
            this.projected[i] = noCamera;
            if (i < this.defines.MAX_TEXTURE) {
                this.textures[i] = noTexture;
                this.depthTexture[i] = noDepthTexture;
            }
            this.bColor[i] = new Color(0x000);
            this.uvwTexture[i] = {position: new Vector3(), preTransform: new Matrix4(), 
                postTransform: new Matrix4(), postTransInv: new Matrix4()};
            this.uvDistortion[i] = {type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(), 
                P: new THREE.Vector2(), b: new THREE.Vector2()};
        }
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