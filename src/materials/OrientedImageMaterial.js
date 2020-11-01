import { ShaderMaterial, ShaderLib, Matrix3, Matrix4, Vector2, Vector3, Vector4, Color } from 'three';
import numeric from 'numeric';
import {pop, definePropertyUniform, setUvwCamera, setDistortion} from './materialUtils';

class OrientedImageMaterial extends ShaderMaterial {
    constructor(options = {}) {
        const size = pop(options, 'size', 1);
        const diffuse = pop(options, 'diffuse', new Color(0xeeeeee));
        const uvwTexture = pop(options, 'uvwTexture', {position: new Vector3(), preTransform: new Matrix4(),
            postTransform: new Matrix4(), postTransInv: new Matrix4()});
        const uvwView = pop(options, 'uvwView', {position: new Vector3(), preTransform: new Matrix4(),
            postTransform: new Matrix4(), postTransInv: new Matrix4()});
        const distortion = pop(options, 'distortion', {method: 1, type: 1, texture: true, view: false,
            r2img: 0., r2max: 0.});
        const extrapolation = pop(options, 'extrapolation', {texture: true, view: true});
        const uvDistortion = pop(options, 'uvDistortion', {type: 0, R: new Vector4(), C: new Vector3()});
        const homography = pop(options, 'homography', {H: new Matrix3(), invH: new Matrix3});
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
        definePropertyUniform(this, 'distortion', distortion);
        definePropertyUniform(this, 'extrapolation', extrapolation);
        definePropertyUniform(this, 'uvDistortion', uvDistortion);
        definePropertyUniform(this, 'homography', homography);
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

    setRadius(camera) {
        this.distortion.r2img = camera.radius.r2img;
        this.distortion.r2max = camera.radius.r2max;
    }

    setCenter(camera) {
        if(!(camera.distos && camera.distos.length == 1)) {
            const x = camera.view.fullWidth/2.;
            const y = camera.view.fullHeight/2.;
            this.uvDistortion.C = new Vector2(x, y);
        }
    }

    setHomography(camera) { 
        if(camera.distos && camera.distos.length == 1 && this.uvDistortion.R.w > 0) {
            var r = Math.sqrt(this.uvDistortion.R.w);
            var p1 = new Vector2(this.uvDistortion.C.x, this.uvDistortion.C.y+r);
            var p2 = new Vector2(this.uvDistortion.C.x+r, this.uvDistortion.C.y);
            var p3 = new Vector2(this.uvDistortion.C.x, this.uvDistortion.C.y-r);
            var p4 = new Vector2(this.uvDistortion.C.x-r, this.uvDistortion.C.y);
            var srcPts = [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y];

            const disto = camera.distos[0];
            var p1d = p1.clone(); disto.project(p1d);
            var p2d = p2.clone(); disto.project(p2d);
            var p3d = p3.clone(); disto.project(p3d);
            var p4d = p4.clone(); disto.project(p4d);
            var dstPts = [p1d.x, p1d.y, p2d.x, p2d.y, p3d.x, p3d.y, p4d.x, p4d.y];

            this.homography.H.copy(this.calculateHomography(srcPts, dstPts));
            this.homography.invH.copy(this.calculateHomography(dstPts, srcPts));
        
        } else { 
            var H = new Matrix3().fromArray([1,0,0,0,1,0,0,0]);
            this.homography.H.copy(H);
            this.homography.invH.copy(H);
        }
    }

    /* Reference: https://github.com/jlouthan/perspective-transform/blob/master/dist/perspective-transform.js */
    calculateHomography(srcPts, dstPts) {
        var r1 = [srcPts[0], srcPts[1], 1, 0, 0, 0, -1*dstPts[0]*srcPts[0], -1*dstPts[0]*srcPts[1]];
        var r2 = [0, 0, 0, srcPts[0], srcPts[1], 1, -1*dstPts[1]*srcPts[0], -1*dstPts[1]*srcPts[1]];
        var r3 = [srcPts[2], srcPts[3], 1, 0, 0, 0, -1*dstPts[2]*srcPts[2], -1*dstPts[2]*srcPts[3]];
        var r4 = [0, 0, 0, srcPts[2], srcPts[3], 1, -1*dstPts[3]*srcPts[2], -1*dstPts[3]*srcPts[3]];
        var r5 = [srcPts[4], srcPts[5], 1, 0, 0, 0, -1*dstPts[4]*srcPts[4], -1*dstPts[4]*srcPts[5]];
        var r6 = [0, 0, 0, srcPts[4], srcPts[5], 1, -1*dstPts[5]*srcPts[4], -1*dstPts[5]*srcPts[5]];
        var r7 = [srcPts[6], srcPts[7], 1, 0, 0, 0, -1*dstPts[6]*srcPts[6], -1*dstPts[6]*srcPts[7]];
        var r8 = [0, 0, 0, srcPts[6], srcPts[7], 1, -1*dstPts[7]*srcPts[6], -1*dstPts[7]*srcPts[7]];
        var matA = [r1, r2, r3, r4, r5, r6, r7, r8];
        var matB = dstPts;
        var matC;
        try{
            matC = numeric.inv(numeric.dotMMsmall(numeric.transpose(matA), matA));
        }catch(e){
            console.log(e);
            return new Matrix3().fromArray([1,0,0,0,1,0,0,0]);
        }
        var matD = numeric.dotMMsmall(matC, numeric.transpose(matA));
        var matX = numeric.dotMV(matD, matB);
        var res = numeric.dotMV(matA, matX);
        matX[8] = 1;

        var H = new Matrix3().fromArray(matX).transpose();
        return H;
    }

    setUniforms(pass){
        pass.debug.value = this.debug;
        pass.uvwView.value = this.uvwView;
        pass.uvDistortion.value = this.uvDistortion;
        pass.distortion.value = this.distortion;
        pass.extrapolation.value = this.extrapolation;
        pass.homography.value = this.homography;
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
        float debugOpacity;
        bool showImage;
    };
`,
};

export default OrientedImageMaterial;
