import { Vector2, Vector3, Vector4, Matrix4, Euler } from 'three';
import { default as BrownDistortion } from '../distortions/BrownDistortion';
import { default as EbnerDistortion } from '../distortions/EbnerDistortion';
import { default as FishEyeDistortion } from '../distortions/FishEyeDistortion';
import { default as FraserDistortion } from '../distortions/FraserDistortion';
import { default as PolynomDistortion } from '../distortions/PolynomDistortion';
import { default as RadialDistortion } from '../distortions/RadialDistortion';

function parseText(xml, tagName) {
    var node = xml.getElementsByTagName(tagName)[0];
    return node && node.childNodes[0].nodeValue.trim();
}

function parseNumbers(xml, tagName, value) {
    var text = parseText(xml, tagName);
    return text ? text.split(' ').filter(String).map(Number) : value;
}

function parseVector2(xml, tagName, value) {
    return new Vector2().fromArray(parseNumbers(xml, tagName, value));
}

function parseVector3(xml, tagName, value) {
    return new Vector3().fromArray(parseNumbers(xml, tagName, value));
}

function parseChildNumbers(xml, tagName) {
    return Array.from(xml.getElementsByTagName(tagName)).map(node => Number(node.childNodes[0].nodeValue));
}

function parseDistortion(xml) {
    xml = xml.children[0];
    var type = xml.tagName;
    var params;
    var states;
    if (type === 'ModUnif') {
        type = parseText(xml, 'TypeModele');
        params = parseChildNumbers(xml, 'Params');
        states = parseChildNumbers(xml, 'Etats');
    }

    switch (type) {
        case 'ModNoDist'     : return undefined;
        case 'eModeleEbner'  : return new Ebner(states[0], params);
        case 'eModeleDCBrown': return new BrownDistortion(states[0], params);
        case 'ModRad': {
            const R = parseChildNumbers(xml, 'CoeffDist', []); // radial distortion coefficients
            if(R.length == 0) return undefined;
            const C = parseVector2(xml, 'CDist'); // distortion center in pixels
            return new RadialDistortion(C, R);
        }
        case 'eModelePolyDeg2':
        case 'eModelePolyDeg3':
        case 'eModelePolyDeg4':
        case 'eModelePolyDeg5':
        case 'eModelePolyDeg6':
        case 'eModelePolyDeg7':
        {
            const S = states[0];
            const C = states.slice(1, 3);
            const degree = Number(type.substr('eModelePolyDeg'.length));
            const R = params;
            return new PolynomDistortion(C, S, R, degree);
        }
        case 'ModPhgrStd': {
            const C = parseNumbers(xml, 'CDist'); // distortion center in pixels
            const R = parseChildNumbers(xml, 'CoeffDist'); // radial distortion coefficients
            const P = parseNumbers(xml, 'P1', [0]).concat(parseNumbers(xml, 'P2', [0]));
            const b = parseNumbers(xml, 'b1', [0]).concat(parseNumbers(xml, 'b2', [0]));
            return new FraserDistortion(C, P, R, b);
        }
        case 'eModele_FishEye_10_5_5':
        case 'eModele_EquiSolid_FishEye_10_5_5': {
            const equisolid = type === 'eModele_EquiSolid_FishEye_10_5_5';
            const F = states[0];
            const C = params.slice(0, 2);
            const R = params.slice(2, 12);
            const P = params.slice(12, 22);
            const l = params.slice(22);
            return new FishEyeDistortion(P, C, F, l, R, equisolid);
        }
        default:
            throw new Error(`Error parsing micmac orientation : unknown distortion ${xml.tagName}`);
    }
}

function parseIntrinsics(xml, imageMatrix) {
    if (!xml) {
        throw new Error('Error parsing micmac orientation, no intrinsics');
    }
    if (!(xml instanceof Node)) {
        xml = new window.DOMParser().parseFromString(xml, 'text/xml');
    }
    var KnownConv = parseText(xml, 'KnownConv');
    if (KnownConv !== 'eConvApero_DistM2C') {
        throw new Error(`Error parsing micmac orientation : unknown convention ${KnownConv}`);
    }
    var focal = parseVector2(xml, 'F'); // focal length in pixels
    var point = parseVector2(xml, 'PP'); // image projection center in pixels
    var size = parseVector2(xml, 'SzIm'); // image size in pixels
    var skew = 0;
    var rmax = parseNumbers(xml, 'RayonUtile', [])[0];
    focal.y = focal.y || focal.x; // fy defaults to fx
    var distos = Array.from(xml.getElementsByTagName('CalibDistortion'))
        .map(parseDistortion)
        .filter(x => x) // filter undefined values
        .reverse(); // see the doc
    var near = focal.x * 0.035 / size.x; // horizontal focal length in meters, assuming a 35mm-wide sensor
    var far = 1000; // 1km
    var camera = new PhotogrammetricCamera(focal, size, point, skew, distos, near, far, undefined, imageMatrix);
    if (rmax) {
        camera.r2max = rmax * rmax;
    }
    return camera;
}

// https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/ori_phot/orilib.cpp#L3069-L3190
function parseConv(xml) {
    var KnownConv = parseText(xml, 'KnownConv');
    if (!KnownConv) return undefined;
    var degree = Math.PI / 180;
    var grade = Math.PI / 200;
    var lin = [1, 1, 1];
    var Cardan = true;
    switch (KnownConv) {
        case 'eConvApero_DistM2C' : return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: true, col: [1, 1, 1], scale: degree, order: 'ZYX' };
        case 'eConvApero_DistC2M': return { Cardan, lin, Video: true, DistC2M: true, MatrC2M: true, col: [1, 1, 1], scale: degree, order: 'ZYX' };
        case 'eConvOriLib': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: true, col: [1, 1, 1], scale: degree, order: 'XYZ' };
        case 'eConvMatrPoivillier_E': return { Cardan, lin, Video: false, DistC2M: false, MatrC2M: false, col: [1, -1, -1], scale: degree, order: 'XYZ' };
        case 'eConvAngErdas' : return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: false, col: [1, -1, -1], scale: degree, order: 'XYZ' };
        case 'eConvAngErdas_Grade': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: false, col: [1, -1, -1], scale: grade, order: 'XYZ' };
        case 'eConvAngPhotoMDegre': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: true, col: [1, -1, -1], scale: degree, order: 'XYZ' };
        case 'eConvAngPhotoMGrade': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: true, col: [1, -1, -1], scale: grade, order: 'XYZ' };
        case 'eConvMatrixInpho': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: false, col: [1, -1, -1], scale: undefined, order: 'XYZ' };
        case 'eConvAngLPSDegre': return { Cardan, lin, Video: true, DistC2M: false, MatrC2M: true, col: [1, -1, -1], scale: degree, order: 'YXZ' };
        default: throw new Error(`Error parsing micmac orientation : unknown rotation convention : ${KnownConv}`);
    }
}

// https://github.com/micmacIGN/micmac/blob/e0008b7a084f850aa9db4dc50374bd7ec6984da6/src/ori_phot/orilib.cpp#L4127-L4139
// https://github.com/micmacIGN/micmac/blob/bee473615bec715884aaa639642add0812e8c378/src/uti_files/CPP_Ori_txt2Xml.cpp#L1546-L1600
function parseExtrinsics(xml) {
    var conv = xml.getElementsByTagName('ConvOri')[0];
    xml = xml.getElementsByTagName('Externe')[0];
    conv = parseConv(xml) || parseConv(conv);

    var rotation = xml.getElementsByTagName('ParamRotation')[0];
    var encoding = rotation && rotation.children[0] ? rotation.children[0].tagName : 'No or empty ParamRotation tag';
    var M = new Matrix4();
    switch (encoding) {
        case 'CodageMatr':
            var L1 = parseNumbers(rotation, 'L1');
            var L2 = parseNumbers(rotation, 'L2');
            var L3 = parseNumbers(rotation, 'L3');
            M.set(
                L1[0], L1[1], L1[2], 0,
                L2[0], L2[1], L2[2], 0,
                L3[0], L3[1], L3[2], 0,
                0, 0, 0, 1);
            break;

        case 'CodageAngulaire':
            console.warn('CodageAngulaire has never been tested');
            var A = parseNumbers(rotation, 'CodageAngulaire').map(x => x * conv.scale);
            var E = new Euler(A[0], A[1], A[2], conv.order);
            M.makeRotationFromEuler(E);
            break;

        default:
            throw new Error(`Error parsing micmac orientation, rotation encoding : ${encoding}`);
    }
    if (!conv.MatrC2M) M.transpose();
    for (var i = 0; i < 3; ++i) {
        for (var j = 0; j < 3; ++j) {
            // it is one or the other (to be checked):
            // M.elements[4*j+i] *= conv.col[i] * conv.lin[j];
            M.elements[4 * j + i] *= conv.col[j] * conv.lin[i];
        }
    }

    M.setPosition(parseVector3(xml, 'Centre'));

    // go from photogrammetric convention (X right, Y down, Z front) to js conventions (X right, Y up, Z back)
    M.scale(new Vector3(1, -1, -1));

    return M;
}

function parseOrIntImaM2C(xml) {
    xml = xml.getElementsByTagName('OrIntImaM2C')[0];
    if (!xml) return null;
    var C = parseVector2(xml, 'I00');
    var X = parseVector2(xml, 'V10');
    var Y = parseVector2(xml, 'V01');
    if (C.x === 0 && C.y === 0 && X.x === 1 && X.y === 0 && Y.x === 0 && Y.y === 1) {
        return undefined;
    }
    return new Matrix4().set(
        X.x, Y.x, 0, C.x,
        X.y, Y.y, 0, C.y,
        0, 0, 1, 0,
        0, 0, 0, 1,
    );
}

function parseCheck(xml) {
    xml = xml.getElementsByTagName('Verif')[0];
    if (!xml) return undefined;
    function check(epsilon, N) {
        epsilon = epsilon || this.check.epsilon;
        var array = N ? this.check.points.slice(0, N) : this.check.points;
        return array.reduce((ok, point) => {
            var pp = this.distort(point.p3.clone());
            var d = point.p2.distanceTo(pp);
            if (d > epsilon) {
                ok = false;
                console.warn(point.id, d, pp, point.p2, point.p3);
            }
            return ok;
        }, true);
    }
    check.epsilon = parseNumbers(xml, 'Tol')[0];
    check.points = Array.from(xml.getElementsByTagName('Appuis')).map(point => ({
        id: parseNumbers(point, 'Num')[0],
        p2: parseVector2(point, 'Im'),
        p3: parseVector3(point, 'Ter'),
    }));
    return check;
}

function parseOrientation(xml, name, intrinsics) {
    var camera = parseIntrinsics(intrinsics, parseOrIntImaM2C(xml));
    camera.name = name;
    camera.matrix = parseExtrinsics(xml);
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.updateMatrixWorld(true);
    camera.check = parseCheck(xml);
    return camera;
}


export default {
    /** @module MicmacParser */
    /** Parse an Orientation*.xml from Micmac (see {@link https://github.com/micmacIGN})
     * @function parse
     * @param {string|XMLDocument} xml - the xml content of the orientation file.
     * @param {Source} source - source function ({@link FilesSource}, {@link FetchSource})
     * @return {Promise} - a promise that resolves with a camera.
     *
     */
    parse: function parse(xml, source, name) {
        if (!(xml instanceof Node)) {
            xml = new window.DOMParser().parseFromString(xml, 'text/xml');
        }
        const match = name.match(/Orientation-(.*)\.[\w\d]*\.xml/i);
        if (match) name = match[1];

        // sanity check for format
        xml = xml.getElementsByTagName('OrientationConique')[0];
        if (!xml) return undefined;

        var file = parseText(xml, 'FileInterne');
        var TypeProj = parseText(xml, 'TypeProj');
        if (TypeProj !== 'eProjStenope') {
            var error = new Error(`Error parsing micmac orientation : unknown projection type ${TypeProj}`);
            return Promise.reject(error);
        }

        if (file) {
            return source.open(file, 'text').then(intrinsics => parseOrientation(xml, name, intrinsics));
        } else {
            var intrinsics = xml.getElementsByTagName('Interne')[0];
            return Promise.resolve(parseOrientation(xml, name, intrinsics));
        }
    },
    format: 'micmac/orientation',
    extensions: ['xml'],
    mimetypes: ['application/xml'],
    fetchtype: 'xml',
};
