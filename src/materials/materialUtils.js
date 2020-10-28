import { Uniform } from 'three';
import { default as RadialDistortion } from '../cameras/distortions/RadialDistortion';

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

export function handleDistortion(camera) {
    var distortion = { C: new THREE.Vector2(), R: new THREE.Vector4() };
    distortion.R.w = Infinity;
    // TODO: handle other distorsion types and arrays of distortions
    if (camera.distos && camera.distos.length == 1) {
        const disto = camera.distos[0];
        switch (true){
            case disto instanceof RadialDistortion:
                distortion.C = disto.C;
                distortion.R = disto.R;
            default:
                break;
        }
    } 
    return distortion;
}