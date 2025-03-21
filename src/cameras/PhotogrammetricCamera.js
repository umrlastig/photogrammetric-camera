import { PerspectiveCamera, Vector2, Matrix4 } from 'three';

const ndcMatrix = new Matrix4().set(
    2, 0, 0, -1,
    0, -2, 0, 1,
    0, 0, 1, 0,
    0, 0, 0, 1);

Matrix4.prototype.lerp = function(m, t) {
    var te = this.elements;
    var me = m.elements;
    te[0]+=t*(me[0]-te[0]);   te[1]+=t*(me[1]-te[1]);   te[2]+=t*(me[2]-te[2]);   te[3]+=t*(me[3]-te[3]);
    te[4]+=t*(me[4]-te[4]);   te[5]+=t*(me[5]-te[5]);   te[6]+=t*(me[6]-te[6]);   te[7]+=t*(me[7]-te[7]);
    te[8]+=t*(me[8]-te[8]);   te[9]+=t*(me[9]-te[9]);   te[10]+=t*(me[10]-te[10]);te[11]+=t*(me[11]-te[11]);
    te[12]+=t*(me[12]-te[12]);te[13]+=t*(me[13]-te[13]);te[14]+=t*(me[14]-te[14]);te[15]+=t*(me[15]-te[15]);
    return this;
};

class PhotogrammetricCamera extends PerspectiveCamera {
    /**
     * @Constructor
     * @param {number|Vector2} focal - focal length in pixels (default: x=1024, y=x)
     * @param {number|Vector2} size - image size in pixels (default: x=1024, y=x)
     * @param {Vector2} point - principal point in pixels (default: size/2)
     * @param {number} skew - shear transform parameter (default: 0)
     * @param {Distortion[]} distos - array of distortions, in the order of application used during projection (default: [])
     * @param {number} near - Camera frustum near plane (default: see THREE.PerspectiveCamera).
     * @param {number} far - Camera frustum far plane (default: see THREE.PerspectiveCamera).
     * @param {number} aspect - aspect ratio of the camera (default: size.x/size.y).
     * @param {Matrix4} imageMatrix - an optional perspective post-distortion transform in image space (default: undefined).
     * @param {Texture} mask - an optional texture mask (default: undefined).
     */
    constructor(focal, size, point, skew, distos, near, far, aspect, imageMatrix, mask) {
        focal = Array.isArray(focal) ? new Vector2().fromArray(focal) : (focal || 1024);
        point = Array.isArray(point) ? new Vector2().fromArray(point) : point;
        size = Array.isArray(size) ? new Vector2().fromArray(size) : (size || 1024);
        focal = focal.isVector2 ? focal : new Vector2(focal, focal);
        size = size.isVector2 ? size : new Vector2(size, size);
        skew = skew || 0;
        point = point || size.clone().multiplyScalar(0.5);
        aspect = aspect || size.x / size.y;

        super(undefined, aspect, near, far);
        // for compatibility with THREE.PerspectiveCamera, provide a fov property (computed from focal.y and size.y)
        Object.defineProperty(this, 'fov', {
            get: () => Math.atan2(this.view.fullHeight, 2 * this.focal.y) * 360 / Math.PI,
            // setting the fov overwrites focal.x and focal.y
            set: (fov) => {
                var focal = 0.5 * this.view.fullHeight / Math.tan(fov * Math.PI / 360);
                this.focal.x = focal;
                this.focal.y = focal;
            },
        });
        this.isPhotogrammetricCamera = true;
        this.focal = focal;
        this.point = point;
        this.skew = skew;
        this.distos = distos || [];
        this.zoom = 1;
        this.view = {
            enabled: false,
            offsetX: 0,
            offsetY: 0,
            width: size.x,
            height: size.y,
            fullWidth: size.x,
            fullHeight: size.y,
        };
        this.radius = {r2img: 0, r2max: 0};

        // filmOffset is not supported
        // filmGauge is only used in compatibility PerspectiveCamera functions
        this.filmOffset = 0;
        this.mask = mask;

        this.preProjectionMatrix = new Matrix4();
        this.postProjectionMatrix = new Matrix4();
        this.textureMatrix = new Matrix4();
        this.imageMatrix = imageMatrix ? new Matrix4().copy(imageMatrix) : new Matrix4().identity();
        this.updateProjectionMatrix();
    }

    updateProjectionMatrix() {
        if (!this.preProjectionMatrix) {
            // super() calls updateProjectionMatrix(), which is not yet fully initialized
            super.updateProjectionMatrix();
            return;
        }

        const c = -(this.far + this.near) / (this.far - this.near);
        const d = -2 * this.far * this.near / (this.far - this.near);
        this.preProjectionMatrix.set(
            this.focal.x, -this.skew, -this.point.x, 0,
            0, -this.focal.y, -this.point.y, 0,
            0, 0, c, d,
            0, 0, -1, 0);

        this.textureMatrix.makeScale(
            1 / this.view.fullWidth,
            1 / this.view.fullHeight,
            1);
        this.textureMatrix.multiply(this.imageMatrix);

        var textureAspect = this.view.fullWidth / this.view.fullHeight;
        if (this.view.enabled) {
            textureAspect = this.view.width / this.view.height;
            var sx = this.view.fullWidth / this.view.width;
            var sy = this.view.fullHeight / this.view.height;
            var ox = this.view.offsetX / this.view.width;
            var oy = this.view.offsetY / this.view.height;
            this.textureMatrix.premultiply(new Matrix4().set(
                sx, 0, 0, -ox,
                0, sy, 0, -oy,
                0, 0, 1, 0,
                0, 0, 0, 1));
        }

        // take zoom and aspect into account
        var aspectRatio = this.aspect / textureAspect;
        var zoom = new Vector2(this.zoom, this.zoom);
        if (aspectRatio > 1) {
            zoom.x /= aspectRatio;
        } else {
            zoom.y *= aspectRatio;
        }
        this.postProjectionMatrix.makeScale(zoom.x, zoom.y, 1);
        this.postProjectionMatrix.multiply(ndcMatrix);
        this.postProjectionMatrix.multiply(this.textureMatrix);

        // projectionMatrix is provided as an approximation: its usage neglects the effects of distortions
        this.projectionMatrix.multiplyMatrices(this.postProjectionMatrix, this.preProjectionMatrix);

        return this;
    }

    // transform in place a 3D point p from view coordinates to pixel coordinates in the distorted image frame:
    // Xleft=0, Xright=size.x, Ybottom=0, Ytop=size.y, Znear=-1, Zfar=1
    // this transform is not influenced by the aspect,  zoom
    distort(p) {
        p.applyMatrix4(this.matrixWorldInverse);
        p.applyMatrix4(this.preProjectionMatrix);
        p = this.distos.reduce((q, disto) => disto.project(q), p);
        return p;
    }

    // transform in place a 3D point p from view coordinates to texture coordinates:
    // Uleft=0, Uright=1, Vbottom=0, Vtop=1, Znear=-1, Zfar=1
    // this transform is not influenced by the aspect and zoom
    texture(p) {
        this.distort(p);
        p.applyMatrix4(this.textureMatrix);
        return p;
    }

    // transform in place a 3D point p from view coordinates to NDC coordinates:
    // Xleft=-1, Xright=1, Ybottom=-1, Ytop=1, Znear=-1, Zfar=1
    // this transform takes the aspect and zoom into account
    project(p) {
        this.distort(p);
        p.applyMatrix4(this.postProjectionMatrix);
        return p;
    }

    copy(source, recursive) {
			  if (this==source) return this;
        super.copy(source, recursive);
        return this.set(source);
    }

    // THREE.PerspectiveCamera compatibility
    getEffectiveFOV() {
        return Math.atan2(this.view.fullHeight, 2 * this.focal.y * this.zoom) * 360 / Math.PI;
    }

    getFocalLength() {
        return this.focal.y * this.getFilmHeight() / this.view.fullHeight;
    }

    setFocalLength(focalLength) {
        focalLength *= this.view.fullHeight / this.getFilmHeight();
        this.focal.x = focalLength;
        this.focal.y = focalLength;
        return this.updateProjectionMatrix();
    }

    setDistortionRadius() {
        // Width with a few extra pixels (TODO: remove the extra pixels)
        const w = this.view.fullWidth + 100;
        const h = this.view.fullHeight + 100;

        if(this.distos && this.distos.length == 1) {
            const disto = this.distos[0];
            const C = disto.C;

            var p1 = new Vector2(0, 0);
            var p2 = new Vector2(w, 0);
            var p3 = new Vector2(0, h);
            var p4 = new Vector2(w, h);

            var pimg = this.maxPoint(p4, this.maxPoint(p3, this.maxPoint(p2, p1, C), C), C);
            var rimg = new Vector2(pimg.x - C.x, pimg.y - C.y);
            var r2img = this.getRadius(pimg, C);

            var pdimg = pimg.clone(); disto.project(pdimg); 
            var rd2img = this.getRadius(pdimg, C);
            var ratio = Math.sqrt(r2img/rd2img);

            ratio = this.undistortPoint(pimg, r2img, rd2img, ratio, disto);

            if (ratio > 0.) {
                var p = new Vector2(C.x + ratio*rimg.x, C.y + ratio*rimg.y);
                this.radius.r2img = this.getRadius(p, C);
            } else this.radius.r2img = r2img;
            
            if(disto.R.w != Infinity) this.radius.r2max = disto.R.w;
            else this.radius.r2max = this.radius.r2img;     
        } else {
            const x = w/2.;
            const y = h/2.;
            this.radius.r2img = x*x + y*y;
            this.radius.r2max = x*x + y*y;
        }
    }

    maxPoint(p1, p2, Center) {
        var r1 = this.getRadius(p1, Center);
        var r2 = this.getRadius(p2, Center);
        if(r1>r2) return p1;
        else return p2;
    }

    getRadius(p, Center) {
        var x = p.x - Center.x;
        var y = p.y - Center.y;
        return x*x + y*y;
    }

    undistortPoint(p, r2, rd2, ratio, d) {
        const disto = this.distos[0];
        const rmax = Math.sqrt(disto.R.w);
        var rd = Math.sqrt(r2);
        var r0 = rd; var r1 = rd*ratio;
        var r = r1;
        var point = new Vector2(p.normalize().x*r + disto.C.x, p.normalize().y*r + disto.C.y);
        d.project(point);
        var rpoint = new Vector2(point.x - disto.C.x, point.y - disto.C.y);
        var r2point = rpoint.x*rpoint.x + rpoint.y*rpoint.y;
        var dr0 = Math.sqrt(rd2); var dr1 = Math.sqrt(r2point);
        var err = rd - dr1; var err2 = err*err;
        for (var i=0; i<50; i++) {
            if(err2 < 0.5) break;
            r = Math.min(Math.max(r + (err*(r1-r0)/(dr1-dr0)), 0.), rmax);
            r0 = r1; r1 = r;
            point = new Vector2(p.normalize().x*r + disto.C.x, p.normalize().y*r + disto.C.y);
            d.project(point);
            rpoint = new Vector2(point.x - disto.C.x, point.y - disto.C.y);
            r2point = rpoint.x*rpoint.x + rpoint.y*rpoint.y;
            dr0 = dr1; dr1 = Math.sqrt(r2point);
            err = rd - dr1, err2 = err*err;
        }
        if(err2 > 0.5) return 0.;
        else return r/rd;
    }

    lerp(camera, t) {
        this.focal.lerp(camera.focal, t);
        this.point.lerp(camera.point, t);
        this.position.lerp(camera.position, t);
        this.quaternion.slerp(camera.quaternion, t);
        this.imageMatrix.lerp(camera.imageMatrix, t);
        this.skew += t * (camera.skew - this.skew);
        this.zoom += t * (camera.zoom - this.zoom);
        this.aspect += t *(camera.aspect - this.aspect);
        this.near += t * (camera.near - this.near);
        this.far += t *(camera.far - this.far);
        this.view.offsetX += t * (camera.view.offsetX - this.view.offsetX);
        this.view.offsetY += t * (camera.view.offsetY - this.view.offsetY);
        this.view.width += t * (camera.view.width - this.view.width);
        this.view.height += t * (camera.view.height - this.view.height);
        this.view.fullWidth += t * (camera.view.fullWidth - this.view.fullWidth);
        this.view.fullHeight += t * (camera.view.fullHeight - this.view.fullHeight);
        // Distortion interpolation
        if(t < 0.2) this.radius.r2img += (t - 0.2) * this.radius.r2img;
        else if(t < 0.8) this.radius.r2img = 0;
        else this.radius.r2img += (1. - t) * (camera.radius.r2img - this.radius.r2img);
        return this.updateProjectionMatrix();
    }

    set(source) {
        this.name = source.name;
        this.focal.copy(source.focal);
        this.point.copy(source.point);
        this.position.copy(source.position);
        this.quaternion.copy(source.quaternion);
        this.distos = source.distos.slice(0); 
        this.skew = source.skew;
        this.zoom = source.zoom;
        this.aspect = source.aspect;
        this.near = source.near;
        this.imageMatrix.copy(source.imageMatrix);
        this.radius = source.radius;
        Object.assign(this.view, source.view);
        return this.updateProjectionMatrix();
    }

    setDefinetly(source) {
        this.name = source.name;
        this.focal.copy(source.focal);
        this.point.copy(source.point);
        this.position.copy(source.position);
        this.quaternion.copy(source.quaternion);
        this.distos = source.distos.slice(0); 
        this.skew = source.skew;
        this.zoom = source.zoom;
        this.aspect = source.aspect;
        this.near = source.near;
        this.imageMatrix.copy(source.imageMatrix);
        Object.assign(this.radius, source.radius);
        Object.assign(this.view, source.view);
        return this.updateProjectionMatrix();
    }
}

export default PhotogrammetricCamera;
