// import * as THREE from 'three';

/* ---------------------- Variables ---------------------- */
var server = 'https://histovis.s3.eu-west-3.amazonaws.com/';
const size = {
    width: 0,
    height: 0,
}

const pCamera = {
    prev: new PhotogrammetricCamera(),
    view: new PhotogrammetricCamera(),
    next: new PhotogrammetricCamera(),
    texture: new PhotogrammetricCamera(),
}

const context ={
    renderer: null,
    scene: null,
    cameras: null,
    controls: null,
    environment: null,
    backgroundSphere: null,
    worldPlane: null,
    composer: null,
    scenePass: null,
    clock: new THREE.Clock(),
}

const materials = {
    basic: null,
    wire: null,
    texture: null,
    multipleTexture: null
};

var viewMaterials = {};

const uniforms = {
    textureMaterials: null,
    multipleTextureMaterial: null,
    viewMaterial: null,
    sceneMaterial: null,
}

var textureLoader = new THREE.TextureLoader();
const uvTexture = textureLoader.load('data/uv.jpg');

const whiteData = new Uint8Array(4);
whiteData.set([255, 255, 255, 255]);
const whiteTexture = new THREE.DataTexture(whiteData, 1, 1, THREE.RGBAFormat);
whiteTexture.name = 'white';

var textures = {};

var params = {
    cameras: {size: 10000},
    environment: {radius: 8000, epsilon: 5000, center: new THREE.Vector3(0.), elevation: 0},
    distortion: {rmax: 1},
    interpolation: {duration: 3.}
};


/* ----------------------- Functions --------------------- */

/* Materials ----------------------------------------- */
function initBasicMaterial(){
    return new THREE.MeshBasicMaterial({
        color: 0xffcc66,
        side: THREE.DoubleSide
    });
}

function initWireMaterial() {
    return new THREE.MeshBasicMaterial({
        color: 0xffcc66,
        wireframe: true,
    });
}

function initTextureMaterial(vs, fs, map = uvTexture) {
    var uniforms = {
        map: map,
        depthMap: whiteTexture,
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        // vertexColors: THREE.VertexColors,
        vertexColors: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        vertexShader: vs,
        fragmentShader: fs
    };

    var material =  new OrientedImageMaterial(uniforms);

    return [uniforms, material];
}

function initMultipleTextureMaterial(vs, fs, renderer, map = uvTexture) {
    // Maximum number of textures
    const maxTextures = getMaxTextureUnitsCount(renderer);

   var uniforms = {
        map: map,
        depthMap: whiteTexture,
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        // vertexColors: THREE.VertexColors,
        vertexColors: true,
        blending: THREE.NormalBlending,
        maxTexture: maxTextures,
        side: THREE.DoubleSide,
        vertexShader: vs,
        fragmentShader: fs
    };

   var material =  new MultipleOrientedImageMaterial(context.cameras, textures, uniforms);

   return [uniforms, material];
};

function initCameraMaterialUniforms(vs, fs, map) {
    var uniforms = {
        map: map,
        opacity: 1,
        transparent: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        vertexShader: vs,
        fragmentShader: fs
    };
    return uniforms;
}

function initSceneMaterialUniforms(vs, fs, material) {
    var uniforms = {
        uniforms: {
            tDiffuse: { value: null },
            diffuse:  { value: new THREE.Color(0xeeeeee) },
            opacity:  { value: 1.},
            debug: { value: material.debug },
            uvwView: { value: material.uvwView },
            uvDistortion: { value: material.uvDistortion },
            distortion: { value: material.distortion },
            extrapolation: { value: material.extrapolation },
            homography: { value: material.homography }
        },
        vertexShader: vs,
        fragmentShader: fs,
    };
    return uniforms;
}

/* Environment --------------------------------------- */
function initBackgroundSphere(material) {
    var sphere = new THREE.SphereGeometry(-1, 32, 32);
    var visibility = new Float32Array(sphere.attributes.position.count); // invisible
    sphere.setAttribute('visibility', new THREE.BufferAttribute(visibility, 1));
    return new THREE.Mesh(sphere, material);
}

function initWorldPlane(material) {
    var plane = new THREE.PlaneGeometry(-1, -1, 15, 15);
    var visibility = new Float32Array(plane.attributes.position.count); // invisible
    plane.setAttribute('visibility', new THREE.BufferAttribute(visibility, 1));
    return new THREE.Mesh(plane, material);
}

/* Cameras ------------------------------------------- */
function cameraAspect(camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
}

function cameraHelper(camera) {
    var group = new THREE.Group();
    const m = camera.projectionMatrix.clone().invert();
    var v = new Float32Array(15);
    // get the 4 corners on the near plane (neglecting distortion)
    new THREE.Vector3( -1, -1, -1 ).applyMatrix4(m).toArray(v,  3);
    new THREE.Vector3( -1,  1, -1 ).applyMatrix4(m).toArray(v,  6);
    new THREE.Vector3(  1,  1, -1 ).applyMatrix4(m).toArray(v,  9);
    new THREE.Vector3(  1, -1, -1 ).applyMatrix4(m).toArray(v, 12);

    // place a frustum
    {
        var vertices = v;
        var indices = [0, 1, 2,  0, 2, 3,  0, 3, 4,  0, 4, 1];
        var geometry = new THREE.BufferGeometry();
        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        var mesh = new THREE.Mesh(geometry, materials.wire);
        mesh.scale.set(params.cameras.size, params.cameras.size, params.cameras.size);
        group.add(mesh);
    }
    // place the image plane
    {
        viewMaterials[camera.name] = new OrientedImageMaterial(uniforms.viewMaterial);
        setMaterial(viewMaterials[camera.name], camera);
        viewMaterials[camera.name].debug.showImage = true;

        var vertices = v.slice(3);
        var uvs = new Float32Array([ 0., 0.,  0., 1.,  1., 1.,  1., 0.]);
        var visibility = new Float32Array(Array(geometry.attributes.position.count).fill(0.));
        var indices = [0, 2, 1,  0, 3, 2];
        var geometry = new THREE.BufferGeometry();
        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute( uvs, 2 ));
        geometry.setAttribute('visibility', new THREE.BufferAttribute(visibility, 1));
        var mesh = new THREE.Mesh(geometry, viewMaterials[camera.name]);
        mesh.scale.set(params.cameras.size, params.cameras.size, params.cameras.size);
        group.add(mesh);
    }
    // place a sphere at the camera center
    //{
        //var geometry = new THREE.SphereBufferGeometry(1, 8, 8);
        //group.add(new THREE.Mesh( geometry, basicMaterial));
    //}
    return group;
}

/* Callbacks ----------------------------------------- */
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    context.renderer.setSize(width, height);
    pCamera.view.aspect = aspect;
    pCamera.view.updateProjectionMatrix();
} 

function onDocumentKeyDown(event) {
    switch(event.key){
        case 's': setView(getCamera(pCamera.next, -1));  break;
        case 'z': setView(getCamera(pCamera.next, +1));  break;
        case 'q': setTexture(getCamera(pCamera.texture, -1));  break;
        case 'd': setTexture(getCamera(pCamera.texture, +1));  break;
        case 'a': setCamera(getCamera(pCamera.next, -1));  break;
        case 'e': setCamera(getCamera(pCamera.next, +1));  break;
        case 't': setTexture(getCamera(pCamera.next));  break;
        case 'v': setView(getCamera(pCamera.texture));  break;
        case 'c': console.log(pCamera.next); break;
        case 'p': console.log(pCamera.view.position); break;
        default : console.log(event.key, 'is not supported');
    }
}

/* Loading ------------------------------------------- */
function loadOrientation(url, source, name) {
    if (!name){
        const match = url.match(/Orientation-(.*)\.[\w\d]*\.xml/i);
        name = match ? match[1] : url;
    }
    return source.open(url, 'text')
        .then(parseOrientation(source, name))
        .then(handleOrientation(name));
}

function loadImage(url, source, name) {
    if (!name){
        const match = url.match(/([^\/]*)\.[\w\d]/i);
        name = match ? match[1] : url;
    }
    return source.open(url, 'dataURL')
    .then(parseImage(source)).catch(err => console.log(url, name))
    .then(handleImage(name));
}

function loadOrientedImage(orientationUrl, imageUrl, source, name) {
    loadImage(imageUrl, source).then(() => loadOrientation(orientationUrl, source, name));
}

function loadPlyMesh(url, source, material){
    return source.open(url, 'arrayBuffer')
    .then(parsePly(source))
    .then(handleMesh(url, material));
}

function loadPlyPC(url, source, material){
    return source.open(url, 'arrayBuffer')
    .then(parsePly(source))
    .then(handlePointCloud(url, material));
}

function loadJSON(material, path, file) {
    file = file || 'index.json';
    var source = new FetchSource(path);
    source.open(file, 'text').then((json) => {
        json = JSON.parse(json);

        if(json.target) {
            params.environment.center.copy(json.target);
            if(context.controls) context.controls.target.copy(json.target);
        } 

        if(json.camera) {
            if(json.camera.scale) params.cameras.size = json.camera.scale;
            if(json.camera.zoom) pCamera.view.zoom = json.camera.zoom;
        }

        if(json.environment) {
            if(json.environment.radius) params.environment.radius = json.environment.radius;
            if(json.environment.epsilon) params.environment.epsilon = json.environment.epsilon;
            if(json.environment.elevation) params.environment.elevation = json.environment.elevation;
        }
        
        if(json.up) pCamera.view.up.copy(json.up);
        if(json.pointSize) material.size = json.pointSize;

        updateEnvironment();
        
        if(json.pc) json.pc.forEach((url) => loadPlyPC(url, source, material));
        if(json.mesh) json.mesh.forEach((url) => loadPlyMesh(url, source, material));

        if(json.ori && json.img) json.ori.forEach((orientationUrl, i) =>
            loadOrientedImage(orientationUrl, json.img[i], source));
    });
}

/* Parsing ------------------------------------------- */
function parseOrientation(source, name) {
    var parsers = [MicmacOrientationParser, MatisOrientationParser, OPKOrientationParser, BundlerOrientationParser];
    return (data) => {
        for(const parser of parsers) {
            var parsed = parser.parse(data, source, name);
            if (parsed) return parsed;
        }
        return undefined;
    }
}

function parseImage(source){
    return (data) => {
        return new Promise((resolve, reject) => {
            textureLoader.load(data, resolve, undefined, (err) => {
                return reject();
            })
        }).finally(() => source.close(data, 'dataURL'));
    }
}

var plyLoader = new photogrammetricCamera.PLYLoader();
var parsePly = (source) => (data => plyLoader.parse(data));

/* Handling ------------------------------------------ */
function handleOrientation(name) {
    return function(camera) {
        if (!camera) return;
        if (camera instanceof Array) return camera.map(c => handleOrientation(c.name)(c));
        handleCamera(camera, name);
        if(context.cameras.children.length < 2) setCamera(camera);
        return camera;
    };
}

function handleCamera(camera, name){
    if (!camera) return;
    camera.name = name;
    if (context.cameras.children.find(cam => cam.name == camera.name)) {
        console.warn(`Camera "${camera.name}" was already loaded, skipping`);
        return;
    }
    var check = '[?]';
    if (camera.check) check = camera.check() ? '[Y]' : '[N]';
    console.log(check, name);
    
    camera.near = 0.1;
    camera.far = params.environment.radius+params.environment.epsilon;
    camera.setDistortionRadius();
    camera.updateProjectionMatrix();

    // Camera helper
    var helper = cameraHelper(camera);
    helper.name = "helper";
    camera.add(helper);
    camera.updateMatrixWorld();

    // Camera renderer target
    var target = getRenderTarget();
    camera.renderTarget = target;

    context.renderer.setRenderTarget(target);
    context.renderer.render(context.scene, camera);
    context.renderer.setRenderTarget(null);
    
    context.cameras.add(camera);
    context.cameras.children.sort((a, b) => a.name.localeCompare(b.name));
}

function handleImage(name) {
    return function(texture) {
        if (!texture) return;
        texture.name = name;
        textures[texture.name] = texture ;
        return texture;
    };
}

function handlePointCloud(name, material){
    return function(geometry){
        console.log(name);
        var points = new THREE.Points(geometry, material);
        context.environment.add(points);
        // Find center of the geometry
        geometry.computeBoundingBox();
        var center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        points.updateMatrixWorld(true);

        var visibility = new Float32Array(Array(geometry.attributes.position.count).fill(1.));
        geometry.setAttribute('visibility', new THREE.BufferAttribute(visibility, 1));
    }
}

function handleMesh(name, material){
    return function(geometry){
        console.log(name);
        geometry.computeVertexNormals();
        var mesh = new THREE.Mesh(geometry, material);
        context.environment.add(mesh);
        // Find center of the geometry
        geometry.computeBoundingBox();
        var center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.updateMatrixWorld(true);

        var visibility = new Float32Array(Array(geometry.attributes.position.count).fill(1.));
        geometry.setAttribute('visibility', new THREE.BufferAttribute(visibility, 1));
    }
}

/* Gets ---------------------------------------------- */
function getCamera(camera, delta = 0){
    const array = context.cameras.children;
    const index = array.findIndex(cam => cam.name == camera.name);
    return array[(index + delta + array.length) % array.length];
}

function getMaxTextureUnitsCount(renderer) {
    const gl = context.renderer.getContext();
    return gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
}

function getRenderTarget() {
    var target = new THREE.WebGLRenderTarget(1024, 1024); // (window.innerWidth, window.innerHeight);
    target.texture.format = THREE.RGBAFormat;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.stencilBuffer = false;
    target.depthBuffer = true;
    target.depthTexture = new THREE.DepthTexture();
    target.depthTexture.format = THREE.DepthFormat;
    target.depthTexture.type = THREE.UnsignedIntType;

    return target;
}

/* Sets ---------------------------------------------- */
function setView(camera) {
    if (!camera) return;
    console.log('View:', camera.name);
    pCamera.prev.set(pCamera.view);
    pCamera.next.set(camera);
    cameraAspect(pCamera.next);
    cameraAspect(pCamera.prev);
    pCamera.prev.timestamp = 0; // timestamp will be set in the update callback
    pCamera.next.zoom = pCamera.view.zoom; // keep the current zoom
    pCamera.next.near = 0.1;
    pCamera.next.far = params.environment.radius+params.environment.epsilon;
    pCamera.next.updateProjectionMatrix();
}

function setTexture(camera) {
    if (!camera) return;
    console.log('Texture:', camera.name);
    pCamera.texture.copy(camera);
    if(materials.texture) {
        setMaterial(materials.texture, camera);
        setRadius(materials.texture, camera);
        materials.texture.setHomography(camera);
    }
    if(materials.multipleTexture) materials.multipleTexture.setCamera(camera);
}

function setCamera(camera) {
    setView(camera);
    setTexture(camera);
}

function setMaterial(material, camera) {
    material.map =  textures[camera.name] || uvTexture;
    if(camera.renderTarget) material.depthMap = camera.renderTarget.depthTexture || whiteTexture;
    material.setCamera(camera, pCamera.view);
}

function setRadius(material, camera){
    material.setRadius(camera);
    material.setCenter(camera);
    material.uvDistortion.R.w = params.distortion.rmax*params.distortion.rmax*material.distortion.r2img;
}

/* Update -------------------------------------------- */
function updateEnvironment() {
    context.backgroundSphere.scale.set(params.environment.radius, params.environment.radius, params.environment.radius);
    context.backgroundSphere.position.copy(params.environment.center);
    context.backgroundSphere.updateWorldMatrix();

    var position = params.environment.center.clone().add(
        pCamera.view.up.clone().multiplyScalar(params.environment.elevation));
    var normal = pCamera.view.up.clone().multiplyScalar(-1.);
    context.worldPlane.position.copy(position);
    context.worldPlane.scale.set(params.environment.radius, params.environment.radius, 1);
    context.worldPlane.lookAt(position.clone().add(normal));
    context.worldPlane.updateWorldMatrix();

    context.controls.maxDistance = params.environment.radius;
    context.environment.visible = true;
}

function updateMaterial(material) {
    material.setCamera(pCamera.texture, pCamera.view);
    setRadius(material, pCamera.view);
}

function updateControls() {
    var distance = new THREE.Vector3().subVectors(pCamera.view.position, context.controls.target).length();
    // apply transformation - matrix, euler rotation, or quaternion?
    var normal = new THREE.Vector3(0,0,-1).applyQuaternion(pCamera.view.quaternion);
    // instead of quaternion, you could also use .applyEuler(camera.rotation);
    // or if you used matrix, extract quaternion from matrix
    context.controls.target = new THREE.Vector3().add(pCamera.view.position).add(normal.setLength(distance));
    //var vector = (new THREE.Vector3( 0, 0, -environmentRadius )).applyQuaternion( pCamera.view.quaternion ).add( pCamera.view.position );
    //context.controls.target.copy(vector);
    context.controls.saveState();
}

function showMaterials(state) {
    if (materials.texture) materials.texture.debug.showImage = state;
    if (materials.multipleTexture) materials.multipleTexture.debug.showImage = state;
}

/* Movement ------------------------------------------ */
function interpolateCamera(timestamp) {
    if (pCamera.prev.timestamp !== undefined) {
        if (pCamera.prev.timestamp == 0) {
            pCamera.prev.timestamp = timestamp;
            pCamera.next.timestamp = pCamera.prev.timestamp + 1000 * params.interpolation.duration;
        }
        if (timestamp < pCamera.next.timestamp) {
            const t = 0.001 * (timestamp - pCamera.prev.timestamp) / params.interpolation.duration;
            pCamera.view.set(pCamera.prev).lerp(pCamera.next, t);
            showMaterials(false);
        } else {
            pCamera.view.setDefinetly(pCamera.next);
            pCamera.prev.timestamp = undefined;
            pCamera.next.timestamp = undefined;

            context.controls.saveState();
            showMaterials(true);
        }
        pCamera.view.updateProjectionMatrix();
    }
};

/* Clean --------------------------------------------- */
function basicClean() {
    params = {
        cameras: {size: 10000},
        environment: {radius: 8000, epsilon: 5000, center: new THREE.Vector3(0.), elevation: 0},
        distortion: {rmax: 1},
        interpolation: {duration: 3.}
    };

    const camera = new PhotogrammetricCamera();
    pCamera.prev.set(camera);
    pCamera.next.set(camera);
    pCamera.prev.timestamp = undefined;
    pCamera.next.timestamp = undefined;
    pCamera.texture.copy(pCamera.view);

    pCamera.view.zoom = 0.5;
    pCamera.view.up.set(0, 0, 1);
    
    if(materials.texture) materials.texture.map = null;

    context.controls.target.set(0, 0, 0);

    while(context.environment.children.length > 2) context.environment.remove(context.environment.children[context.environment.children.length - 1]);

    context.backgroundSphere.visible = true;
    context.worldPlane.visible = true;

    Object.keys(textures).forEach(key => textures[key].dispose());
    while(context.cameras.children.length) context.cameras.remove(context.cameras.children[0]);

    if(materials.multipleTexture) materials.multipleTexture.clean();
}

const photogrammetricHelper = {
    initBasicMaterial,
    initWireMaterial,
    initTextureMaterial,
    initCameraMaterialUniforms,
    initSceneMaterialUniforms,
    initMultipleTextureMaterial,
    initBackgroundSphere,
    initWorldPlane,
    interpolateCamera,
    updateMaterial,
    onWindowResize,
    onDocumentKeyDown,
    uvTexture,
    uniforms,
    materials,
    context,
    size,
    pCamera,
    basicClean,
    loadOrientation,
    loadImage,
    loadOrientedImage,
    loadJSON,
    loadPlyPC,
    loadPlyMesh,
    updateEnvironment,
    server,
    params,
    textures,
};

export default photogrammetricHelper;