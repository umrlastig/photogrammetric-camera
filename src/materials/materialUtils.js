import { Uniform, Vector2, Vector3, Vector4, Matrix4 } from 'three';
import { default as RadialDistortion } from '../distortions/RadialDistortion';
import { default as FraserDistortion } from '../distortions/FraserDistortion';
import { default as FishEyeDistortion } from '../distortions/FishEyeDistortion';

// maps [-1,1]^3 to [0,1]^3
export const textureMatrix = new Matrix4().set(
    1, 0, 0, 1,
    0, 1, 0, 1,
    0, 0, 1, 1,
    0, 0, 0, 2);

export function pop(options, property, defaultValue) {
    if (options[property] === undefined) {
        delete options[property];
        return defaultValue
    };
    const value = options[property];
    delete options[property];
    return value;
}

export function popUniform(options, property, defaultValue) {
    const value = pop(options, property, defaultValue);
    if (options.uniforms[property])
        return options.uniforms[property];
    return new Uniform(value);
}

export function definePropertyUniform(object, property, defaultValue) {
    object.uniforms[property] = new Uniform(object[property] || defaultValue);
    Object.defineProperty(object, property, {
        get: () => object.uniforms[property].value,
        set: (value) => {
            if (object.uniforms[property].value != value) {
                object.uniformsNeedUpdate = true;
                object.uniforms[property].value = value;
            }
        }
    });
}

export function setDistortion(camera) {
    var distortion = { type: 0, F: 0., C: new Vector2(), R: new Vector4(),
        P: new Vector2(), b: new Vector2() };
    distortion.R.w = Infinity;
    // TODO: handle other distorsion types and arrays of distortions
    if (camera.distos && camera.distos.length == 1) {
        const disto = camera.distos[0];
        switch (true){
            case disto instanceof RadialDistortion:
                distortion.type = 1;
                distortion.C = disto.C;
                distortion.R = disto.R;
                break;
            case disto instanceof FraserDistortion:
                distortion.type = 2;
                distortion.C = disto.C;
                distortion.R = disto.R;
                distortion.P = disto.P;
                distortion.b = disto.b;
                break;
            case disto instanceof FishEyeDistortion:
                distortion.type = 3;
                distortion.F = disto.F;
                distortion.C = disto.C;
                distortion.R = disto.R;
                distortion.P = disto.P;
                distortion.b = disto.l;
                break;
            default:
                break;
        }
    } 
    return distortion;
}

export function setUvwCamera(camera) {
    var uvw = {position: new Vector3(), preTransform: new Matrix4(), postTransform: new Matrix4(), postTransInv: new Matrix4()};
    camera.getWorldPosition(uvw.position);
    uvw.preTransform.copy(camera.matrixWorldInverse);
    uvw.preTransform.setPosition(0,0,0);
    uvw.preTransform.premultiply(camera.preProjectionMatrix);
    uvw.postTransform.copy(camera.postProjectionMatrix);

    uvw.postTransInv = camera.postProjectionMatrix.clone().invert();
    return uvw;
}