import { Uniform, Vector3, Matrix4 } from 'three';
import { default as RadialDistortion } from '../cameras/distortions/RadialDistortion';
import { default as FraserDistortion } from '../cameras/distortions/FraserDistortion';

export function pop(options, property, defaultValue) {
    if (options[property] === undefined) return defaultValue;
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
    var distortion = { type: 0, F: 0., C: new THREE.Vector2(), R: new THREE.Vector4(),
        P: new THREE.Vector2(), b: new THREE.Vector2() };
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
                uvDistortion.type = 3;
                uvDistortion.F = disto.F;
                uvDistortion.C = disto.C;
                uvDistortion.R = disto.R;
                uvDistortion.P = disto.P;
                uvDistortion.b = disto.l;
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
    uvw.postTransInv = new Matrix4().getInverse(camera.postProjectionMatrix);
    return uvw;
}