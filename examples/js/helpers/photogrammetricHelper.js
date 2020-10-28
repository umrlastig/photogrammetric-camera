/* ---------------------- Variables ---------------------- */
var server = 'https://histovis.s3.eu-west-3.amazonaws.com/';
var width, height;

var prevCamera = new PhotogrammetricCamera();
var viewCamera = new PhotogrammetricCamera();
var nextCamera = new PhotogrammetricCamera();
var textureCamera = new PhotogrammetricCamera();

var renderer, scene, cameras, controls;
var environment, backgroundSphere;

var basicMaterial, wireMaterial, textureMaterial, viewMaterials = {};
var textureMaterialUniforms, viewMaterialUniforms;

var textureLoader = new THREE.TextureLoader();
const uvTexture = textureLoader.load('data/uv.jpg');

var cameraSize = 10000;
var environmentRadius = 15000;
var epsilonRadius = 5000;

var duration = 3.;

/* ----------------------- Functions --------------------- */

/* Materials ----------------------------------------- */
function initBasicMaterial(){
    return new THREE.MeshBasicMaterial({
        color: 0xffcc66,
    });
}

function initWireMaterial() {
    return new THREE.MeshBasicMaterial({
        color: 0xffcc66,
        wireframe: true,
    });
}

function initTextureMaterial(vs, fs, map) {
    var uniforms = {
        map: map,
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        vertexColors: THREE.VertexColors,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        vertexShader: vs,
        fragmentShader: fs
    };

    var material =  new OrientedImageMaterial(uniforms);

    return [uniforms, material];
}

function initCameraMaterialUniforms(vs, fs, map) {
    var uniforms = {
        map: map,
        opacity: 1,
        transparent: true,
        blending: THREE.NormalBlending,
        vertexShader: vs,
        fragmentShader: fs
    };
    return uniforms;
}

/* Environment --------------------------------------- */
function initBackgroundSphere(scale, material) {
    var sphere = new THREE.SphereBufferGeometry(scale, 32, 32);
    return new THREE.Mesh(sphere, material);
}

function updateEnvironment() {
    backgroundSphere.position.copy(viewCamera.position);
    backgroundSphere.updateWorldMatrix();
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
    m = new THREE.Matrix4().getInverse(camera.projectionMatrix);
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
        var mesh = new THREE.Mesh(geometry, wireMaterial);
        mesh.scale.set(cameraSize, cameraSize, cameraSize);
        group.add(mesh);
    }
    // place the image plane
    {
        viewMaterials[camera.name] = new OrientedImageMaterial(viewMaterialUniforms);
        setMaterial(viewMaterials[camera.name], camera, camera);

        var vertices = v.slice(3);
        var uvs = new Float32Array([ 0., 0.,  0., 1.,  1., 1.,  1., 0.]);
        var indices = [0, 2, 1,  0, 3, 2];
        var geometry = new THREE.BufferGeometry();
        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute( uvs, 2 ));
        var mesh = new THREE.Mesh(geometry, viewMaterials[camera.name]);
        mesh.scale.set(cameraSize, cameraSize, cameraSize);
        group.add(mesh);
    }
    // place a sphere at the camera center
    {
        var geometry = new THREE.SphereBufferGeometry(0.03, 8, 8);
        group.add(new THREE.Mesh( geometry, basicMaterial));
    }
    return group;
}

/* Callbacks ----------------------------------------- */
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    renderer.setSize(width, height);
    viewCamera.aspect = aspect;
    viewCamera.updateProjectionMatrix();
} 

function onDocumentKeyDown(event) {
    switch(event.key){
        case 'a': setCamera(getCamera(nextCamera, -1));  break;
        case 'e': setCamera(getCamera(nextCamera, +1));  break;
        case 'v': setView(getCamera(textureCamera));  break;
        case 'c': console.log(textureCamera); break;
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
        .then(parseOrientation(source))
        .then(handleOrientation(name));
}

/* Parsing ------------------------------------------- */
function parseOrientation(source) {
    var parsers = [MicmacOrientationParser, MatisOrientationParser];
    return (data) => {
        for(const parser of parsers) {
            var parsed = parser.parse(data, source);
            if (parsed) return parsed;
        }
        return undefined;
    }
}

/* Handling ------------------------------------------ */
function handleOrientation(name) {
    return function(camera) {
        if (!camera) return;
        handleCamera(camera, name);
        setCamera(camera);
        return camera;
    };
}

function handleCamera(camera, name){
    if (!camera) return;
    camera.name = name;
    if (cameras.children.find(cam => cam.name == camera.name)) {
        console.warn(`Camera "${camera.name}" was already loaded, skipping`);
        return;
    }
    var check = '[?]';
    if (camera.check) check = camera.check() ? '[Y]' : '[N]';
    console.log(check, name);
    
    camera.far = environmentRadius+epsilonRadius;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    var helper = cameraHelper(camera);
    helper.name = "helper";
    camera.add(helper);
    camera.updateMatrixWorld();

    cameras.add(camera);
    cameras.children.sort((a, b) => a.name.localeCompare(b.name));
}

/* Gets ---------------------------------------------- */
function getCamera(camera, delta = 0){
    const array = cameras.children;
    const index = array.findIndex(cam => cam.name == camera.name);
    return array[(index + delta + array.length) % array.length];
}

/* Sets ---------------------------------------------- */
function setMaterial(material, camera) {
    material.map =  uvTexture;
    material.setCamera(camera);
}

function setView(camera) {
    if (!camera) return;
    console.log('View:', camera.name);
    prevCamera.set(viewCamera);
    nextCamera.set(camera);
    cameraAspect(nextCamera);
    cameraAspect(prevCamera);
    prevCamera.timestamp = 0; // timestamp will be set in the update callback
    nextCamera.zoom = viewCamera.zoom; // keep the current zoom
    nextCamera.near = 0.1;
    nextCamera.far = environmentRadius+epsilonRadius;;
    nextCamera.updateProjectionMatrix();
}

function setTexture(camera) {
    if (!camera) return;
    console.log('Texture:', camera.name);
    textureCamera.copy(camera);
    setMaterial(textureMaterial, textureCamera);
}

function setTexture(camera) {
    if (!camera) return;
    console.log('Texture:', camera.name);
    textureCamera.copy(camera);
    setMaterial(textureMaterial, camera);
}

function setCamera(camera) {
    setView(camera);
    setTexture(camera);
}

/* Update -------------------------------------------- */
function updateControls() {
    var distance = new THREE.Vector3().subVectors(textureCamera.position, controls.target).length();
    // apply transformation - matrix, euler rotation, or quaternion?
    var normal = new THREE.Vector3(0,0,-1).applyQuaternion(textureCamera.quaternion);
    // instead of quaternion, you could also use .applyEuler(camera.rotation);
    // or if you used matrix, extract quaternion from matrix
    controls.target = new THREE.Vector3().add(textureCamera.position).add(normal.setLength(distance));
    controls.saveState();
}

/* Movement ------------------------------------------ */
function interpolateCamera(timestamp) {
    if (prevCamera.timestamp !== undefined) {
        if (prevCamera.timestamp == 0) {
            prevCamera.timestamp = timestamp;
            nextCamera.timestamp = prevCamera.timestamp + 1000 * duration;
        }
        if (timestamp < nextCamera.timestamp) {
            const t = 0.001 * (timestamp - prevCamera.timestamp) / duration;
            viewCamera.set(prevCamera).lerp(nextCamera, t);
        } else {
            viewCamera.set(nextCamera);
            updateControls();
            prevCamera.timestamp = undefined;
            nextCamera.timestamp = undefined;
        }
        viewCamera.updateProjectionMatrix();
    }
    updateEnvironment();
};

/* Clean --------------------------------------------- */
function basicClean() {
    const camera = new PhotogrammetricCamera();
    prevCamera.set(camera);
    nextCamera.set(camera);
    prevCamera.timestamp = undefined;
    nextCamera.timestamp = undefined;
    textureCamera.copy(viewCamera);

    viewCamera.zoom = 0.8;
    viewCamera.up.set(0, 0, 1);
    textureMaterial.map = null;
    while(cameras.children.length) cameras.remove(cameras.children[0]);
}

