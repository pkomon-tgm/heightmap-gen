import * as THREE from "three";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";

class Utils {

    static ensureRectangular(array) {
        array.forEach((row, _) => console.assert(row.length === array[0].length));
    }

    static clamp(min, value, max) {
        return Math.max(min, Math.min(value, max));
    }

    static normalize2dArray(values) {
        const minResult = Math.min(...values.map(row => Math.min(...row)));
        const maxResult = Math.max(...values.map(row => Math.max(...row)));
        return values.map(valueArray => valueArray.map(value => (value - minResult) / (maxResult - minResult)));
    }
}

class HeightmapScene {
    dragSensitivity = 0.005;
    orbitSensitivity = 0.005;
    scrollSensitivity = 0.5;

    // camera parameters
    radius = 5;
    phi = Math.PI / 2;
    theta = 3 * Math.PI / 8;
    cameraCenter = new THREE.Vector3(0, 0, 0);

    perspectiveCamera = undefined;
    scene = new THREE.Scene();
    renderer = undefined;

    updateCallback = undefined;
    lastTimeStamp = undefined;
    lastPointerCoordinates = undefined;

    constructor(domElement) {
        const {width, height} = domElement.getBoundingClientRect();

        this.perspectiveCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.perspectiveCamera.up.set(0, 1, 0);

        this.updateArcballCamera();

        this.renderer = new THREE.WebGLRenderer({canvas: domElement});
        this.renderer.setSize(width, height);

        domElement.addEventListener("pointerdown", (event) => {
            this.lastPointerCoordinates = [event.clientX, event.clientY];
        });
        domElement.addEventListener("pointerup", (_) => {
            this.lastPointerCoordinates = undefined;

        });
        domElement.addEventListener("pointermove", (event) => {
            this.handleMouseMove(event);
        });
        domElement.addEventListener("wheel", (event) => {
            this.handleMouseScroll(event);
        });
    }

    updateArcballCamera() {
        HeightmapScene.updateCamera(this.perspectiveCamera, this.radius, this.theta, this.phi, this.cameraCenter);
    }

    handleMouseMove(event) {
        if (this.lastPointerCoordinates === undefined) {
            return;
        }

        const movementX = this.lastPointerCoordinates[0] - event.clientX;
        const movementY = this.lastPointerCoordinates[1] - event.clientY;
        this.lastPointerCoordinates = [event.clientX, event.clientY];

        if (event.shiftKey) {
            const relativeMovement = new THREE.Vector3(movementY * this.dragSensitivity, 0, -movementX * this.dragSensitivity)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.phi);
            this.cameraCenter.add(relativeMovement);
            this.updateArcballCamera();
        } else {
            this.theta = Utils.clamp(this.orbitSensitivity, this.theta + movementY * this.orbitSensitivity, Math.PI - this.orbitSensitivity);
            this.phi = this.phi - movementX * this.orbitSensitivity;
            this.updateArcballCamera();
        }
    }

    handleMouseScroll(event) {
        const newRadius = this.radius + Math.sign(event.deltaY) * this.scrollSensitivity;
        if (newRadius >= 1) {
            this.radius = newRadius;
            this.updateArcballCamera();
        }
    }

    animate(currentTimestamp = performance.now()) {
        requestAnimationFrame(this.animate.bind(this));

        if (this.lastTimeStamp === undefined) {
            this.lastTimeStamp = currentTimestamp;
        }

        const timeElapsedSinceLastFrame = (currentTimestamp - this.lastTimeStamp) / 1000;
        this.lastTimeStamp = currentTimestamp;

        if (this.updateCallback !== undefined) {
            this.updateCallback(timeElapsedSinceLastFrame);
        }

        this.renderer.render(this.scene, this.perspectiveCamera);
    }

    static updateCamera(camera, radius, theta, phi, center) {
        camera.position.set(radius * Math.sin(theta) * Math.cos(phi), radius * Math.cos(theta), radius * Math.sin(theta) * Math.sin(phi))
            .add(center);
        camera.lookAt(center);
    }

}

function generateGridMeshIndices(numRows, numCols) {
    const indices = [];
    for (let i = 0; i < (numCols + 1) * numRows; i++) {

        if ((i + 1) % (numCols + 1) === 0) {
            continue;
        }

        indices.push(i, i + numCols + 1, i + 1, i + 1, i + numCols + 1, i + numCols + 2);
    }
    return indices;
}

function generateGridMeshVertices(numRows, numCols, cellSizeAlongX = 1.0, cellSizeAlongZ = 1.0) {
    return [...new Array(numRows)]
        .map((_, rowIndex) => [...new Array(numCols)]
            .map((_, colIndex) => [colIndex * cellSizeAlongX, 0, rowIndex * cellSizeAlongZ,]));
}

function generateGridMeshUv(numRows, numCols) {
    return [...new Array(numRows)]
        .map((_, rowIndex) => [...new Array(numCols)]
            .map((_, colIndex) => [colIndex / numCols + 1/(2*numCols), rowIndex / numRows +  1/(2*numRows)]));
}

// used for transforming spectrum
function hurstExponentWithFrequencyScaling(hurstExponent, rowFrequencyFactor = 1.0, colFrequencyFactor = 1.0) {
    return function (coefficient, rowIndex, colIndex, coefficientArray) {
        return math.dotMultiply(coefficient, 1 / Math.pow((rowFrequencyFactor * rowIndex + colFrequencyFactor * colIndex + 1), hurstExponent));
    };
}


function generateValueGrid(numRows, numCols, func) {
    return [...Array(numRows)]
        .map((_, rowIndex) => [...Array(numCols)]
            .map((_, colIndex) => func(rowIndex, colIndex)));
}


const whiteNoise = Math.random;
const identityFunction = i => i;

class TerrainGenerator {

    spectrumTransform = identityFunction;

    samples = undefined;
    spectrum = undefined;
    modifiedSpectrum = undefined;

    calculateOutput(inputSamples) {
        Utils.ensureRectangular(inputSamples);
        if (inputSamples !== this.samples) {
            this.samples = inputSamples;
            this.spectrum = TerrainGenerator.fourierTransform(this.samples);
        }
        this.modifiedSpectrum = TerrainGenerator.#transformSpectrum(this.spectrum, this.spectrumTransform);
        return Utils.normalize2dArray(TerrainGenerator.inverseFourierTransform(this.modifiedSpectrum));
    }

    // fourier transform functions, maybe swap with faster versions later on
    static fourierTransform(samples) {
        return math.fft(samples);
    }

    static inverseFourierTransform(spectrum) {
        return math.ifft(spectrum)
            .map(valueArray => valueArray.map(value => value.re));
    }

    static #transformSpectrum(spectrum, transform) {
        // transform spectrum (frequency coefficients) based on function passed
        return spectrum
            .map((coefficientArray, rowIndex) => coefficientArray
                .map((coefficient, colIndex) => transform(coefficient, rowIndex, colIndex, spectrum)));
    }

}

// TODO use for shading
function generateNormalsTexture(normals) {
    Utils.ensureRectangular(normals);

    const height = normals.length; //rows
    const width = normals[0].length; //cols

    //add 0 for 4th component, transform from -1.0, +1.0 to 0.0, 1.0
    let paddedNormals = normals.map(row => row.map(normal => [...math.dotDivide(math.add(normal, 1), 2), 0]));
    //let paddedNormals = normals.map(row => row.map(normal => [...normal, 0]));


    const typedArray = new Float32Array(paddedNormals.flat(3));

    const texture = new THREE.DataTexture(typedArray, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function createHeightmapTexture(data) {
    Utils.ensureRectangular(data);

    const height = data.length; //rows
    const width = data[0].length; //cols

    const typedArray = new Float32Array(data.flat());
    const texture = new THREE.DataTexture(typedArray, width, height, THREE.RedFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function createHeightMapShaderMaterial(heightmapTexture = undefined, normalsTexture = undefined, wireframe = true) {
    return new THREE.ShaderMaterial({
        uniforms: {
            shadingMode: {value: 1},
            time: {value: 0.0},
            heightMap: {value: heightmapTexture},
            normals: {value: normalsTexture},
            animationEnabled: {value: false},
            animationSpeed: {value: new THREE.Vector2(0.0, 0.0)},
        },
        vertexShader: heightmapVertexShaderText,
        fragmentShader: heightmapFragmentShaderText,
        wireframe: wireframe,
        side: THREE.FrontSide,
    });
}

function createHeightmapTexture(heightmapData) {
    const textureData = heightmapData.map(row => row.map(value => Math.round(value * 255))); //TODO
    return generateTexture(textureData);
}

function createHeightMapGeometry(numHeightFieldRows, numHeightFieldCols, seamless) {
    const numRowsWithSeam = seamless ? numHeightFieldRows + 1 : numHeightFieldRows;
    const numColsWithSeam = seamless ? numHeightFieldCols + 1 : numHeightFieldCols;

    const vertices = generateGridMeshVertices(numRowsWithSeam, numColsWithSeam);
    let uv = generateGridMeshUv(numHeightFieldRows, numHeightFieldCols);
    const indices = generateGridMeshIndices(numRowsWithSeam - 1, numColsWithSeam - 1);

    // loop height and uv values around for seamless
    if (seamless) {
        uv = uv.map(col => col.concat([col[0]]));
        uv = uv.concat([uv[0]]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices.flat(2)), 3));
    //geometry.computeVertexNormals(true);
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv.flat(2)), 2));
    geometry.setIndex(indices);

    return geometry;
}

function computeHeightmapNormals(heights, scale) {
    Utils.ensureRectangular(heights);
    const height = heights.length;
    const width = heights[0].length;
    const normals = [...new Array(height)].map(row => new Array(width));
    for (let rowIndex = 0; rowIndex < height; rowIndex++) {
        for (let colIndex = 0; colIndex < width; colIndex++) {

            const current = math.dotMultiply(scale, [colIndex, heights[rowIndex][colIndex], rowIndex]);
            const up = math.dotMultiply(scale, [colIndex, heights.at(rowIndex - 1).at(colIndex), rowIndex - 1]);
            const down = math.dotMultiply(scale, [colIndex, heights.at((rowIndex + 1) % height).at(colIndex), rowIndex + 1]);
            const left = math.dotMultiply(scale, [colIndex - 1, heights.at(rowIndex).at(colIndex - 1), rowIndex]);
            const right = math.dotMultiply(scale, [colIndex + 1, heights.at(rowIndex).at((colIndex + 1) % width), rowIndex]);
            const upRight = math.dotMultiply(scale, [colIndex + 1, heights.at(rowIndex - 1).at((colIndex + 1) % width), rowIndex - 1]);
            const downLeft = math.dotMultiply(scale, [colIndex - 1, heights.at((rowIndex + 1) % height).at(colIndex - 1), rowIndex + 1]);


            const normal = math.add(math.dotMultiply(1 / 6, getTriangleNormal(current, up, upRight)),
                math.dotMultiply(1 / 6, getTriangleNormal(current, upRight, right)),
                math.dotMultiply(1 / 6, getTriangleNormal(current, right, down)),
                math.dotMultiply(1 / 6, getTriangleNormal(current, down, downLeft)),
                math.dotMultiply(1 / 6, getTriangleNormal(current, downLeft, left)),
                math.dotMultiply(1 / 6, getTriangleNormal(current, left, up)));
            normals[rowIndex][colIndex] = math.dotMultiply(normal, 1.0 / math.norm(normal, 2));
        }
    }
    return normals;
}

function getTriangleNormal(v1, v2, v3) {
    const v1ToV2 = math.subtract(v2, v1);
    const v1ToV3 = math.subtract(v3, v1);
    const normal = math.cross(v1ToV3, v1ToV2);
    const length = math.norm(normal, 2);
    return math.dotMultiply(normal, 1 / length);
}

class Controller {
    static SHADING_MODES = {
        "color": 1,
        "normal": 2,
        "heightmap-uv": 3,
        "work-in-progress": 4,
    };

    shading = "color"; //TODO work on it later
    axesHelper = new THREE.AxesHelper(5);
    wireframe = true;

    hurstExponent = 2.0;
    numRows = 64;
    numCols = 64;
    scale = new THREE.Vector3(0.25, 1.15, 0.25);
    rowFrequencyFactor = 1.0;
    colFrequencyFactor = 1.0;
    tileRows = 1;
    tileCols = 1;
    seamless = true;
    animationEnabled = true;
    animationDirection = new THREE.Vector2(0.05, 0.0);

    #terrainGenerator = new TerrainGenerator();
    #scene = new HeightmapScene(document.getElementById("webGlCanvas"));

    currentMaterial = undefined;
    #currentMeshes = [];
    #currentInputSample = [];
    #currentOutputSample = [];
    #currentNormals = [];

    constructor() {
        this.axesHelper.visible = false;
        this.#scene.scene.add(this.axesHelper);

        this.#terrainGenerator.spectrumTransform = hurstExponentWithFrequencyScaling(this.hurstExponent,
            this.rowFrequencyFactor, this.colFrequencyFactor);
        this.generateNewHeightmap();

        this.#scene.updateCallback = this.updateCallback.bind(this);
        this.#scene.animate();
    }

    updateCallback(deltaTime) {
        if (this.currentMaterial !== undefined) {
            this.currentMaterial.uniforms.time.value += deltaTime;
        }
    }

    updateScene() {

        this.#currentMeshes.forEach(mesh => this.#scene.scene.remove(mesh));
        this.#currentMeshes.length = 0; // clear array

        let heightmapTexture = createHeightmapTexture(this.#currentOutputSample);
        let normalsTexture = generateNormalsTexture(this.#currentNormals);

        this.currentMaterial = createHeightMapShaderMaterial(heightmapTexture, normalsTexture);
        this.currentMaterial.uniforms.heightMap.value = heightmapTexture;
        this.currentMaterial.uniforms.normals.value = normalsTexture;

        //TODO somewhat ugly
        this.updateWireframe();
        this.updateShadingMode();
        this.updateAnimationEnabled();
        this.updateAnimationSpeeds();

        const geometry = createHeightMapGeometry(this.numRows, this.numCols, this.seamless);

        const xSize = this.numCols * this.scale.x;
        const zSize = this.numRows * this.scale.z;
        const xOffset = -this.tileCols * xSize / 2;
        const zOffset = -this.tileRows * zSize / 2;
        for (let rowIndex = 0; rowIndex < this.tileRows; rowIndex++) {
            for (let colIndex = 0; colIndex < this.tileCols; colIndex++) {
                const mesh = new THREE.Mesh(geometry, this.currentMaterial);
                this.#scene.scene.add(mesh);
                this.#currentMeshes.push(mesh);
                mesh.position.set(colIndex * xSize + xOffset, 0, rowIndex * zSize + zOffset);
                mesh.scale.set(this.scale.x, this.scale.y, this.scale.z);
            }
        }
    }

    regenerateInputSamples() {
        this.#currentInputSample = generateValueGrid(this.numRows, this.numCols, whiteNoise);
    }

    calculateOutputSamples() {
        this.#terrainGenerator.spectrumTransform = hurstExponentWithFrequencyScaling(this.hurstExponent,
            this.rowFrequencyFactor, this.colFrequencyFactor);
        this.#currentOutputSample = this.#terrainGenerator.calculateOutput(this.#currentInputSample);
        this.#currentNormals = computeHeightmapNormals(this.#currentOutputSample, this.scale.toArray());
    }

    regenerateHeightmap() {
        this.calculateOutputSamples();
        this.updateScene();
    }

    generateNewHeightmap() {
        this.regenerateInputSamples();
        this.calculateOutputSamples();
        this.updateScene();
    }

    updateWireframe() {
        this.currentMaterial.wireframe = this.wireframe;
        this.currentMaterial.needsUpdate = true;
    }

    updateShadingMode() {
        this.currentMaterial.uniforms.shadingMode.value = Controller.SHADING_MODES[this.shading];
    }

    updateAnimationEnabled() {
        this.currentMaterial.uniforms.time.value = 0.0;
        this.currentMaterial.uniforms.animationEnabled.value = this.animationEnabled;
    }

    updateAnimationSpeeds() {
        this.currentMaterial.uniforms.animationSpeed.value = this.animationDirection;
    updateScale() {
        this.#currentNormals = computeHeightmapNormals(this.#currentOutputSample, this.scale.toArray());
        this.updateScene();
    }

}


function main() {

    const controller = new Controller();

    const gui = new GUI();

    const displayOptionsFolder = gui.addFolder("Display");
    displayOptionsFolder.add(controller, "shading", Object.keys(Controller.SHADING_MODES))
        .onChange(_ => controller.updateShadingMode());
    displayOptionsFolder.add(controller, "wireframe")
        .name("Wireframe")
        .onChange(_ => controller.updateWireframe());
    displayOptionsFolder.add(controller.axesHelper, "visible")
        .name("Show world axes");
    displayOptionsFolder.close();

    const sampleSizeFolder = gui.addFolder("Sample size");
    sampleSizeFolder.add(controller, "numRows", 0, 128, 1)
        .name("Number of samples x")
        .onFinishChange(_ => controller.generateNewHeightmap());
    sampleSizeFolder.add(controller, "numCols", 0, 128, 1)
        .name("Number of samples z")
        .onFinishChange(_ => controller.generateNewHeightmap());
    sampleSizeFolder.close();

    const scalingFolder = gui.addFolder("Scaling")
    scalingFolder.add(controller.scale, "x", 0.05, 0.5, 0.05)
        .onChange(_ => controller.updateScale());
    scalingFolder.add(controller.scale, "y", 0.0, 10.0)
        .onChange(_ => controller.updateScale());
    scalingFolder.add(controller.scale, "z", 0.05, 0.5, 0.05)
        .onChange(_ => controller.updateScale());
    scalingFolder.close();

    const generationOptionsFolder = gui.addFolder("Generation");
    generationOptionsFolder.add(controller, "hurstExponent", 0.0, 5.0)
        .name("Roughness")
        .onFinishChange(_ => controller.regenerateHeightmap());
    generationOptionsFolder.add(controller, "colFrequencyFactor", 0.0, 3.0)
        .name("Freq drop-off factor +x")
        .onFinishChange(_ => controller.regenerateHeightmap());
    generationOptionsFolder.add(controller, "rowFrequencyFactor", 0.0, 3.0)
        .name("Freq drop-off factor +z")
        .onFinishChange(_ => controller.regenerateHeightmap());
    generationOptionsFolder.close();

    const tilingOptions = gui.addFolder("Tiling");
    tilingOptions.add(controller, "tileCols", 1, 100, 1)
        .name("Number of instances x")
        .onChange(_ => controller.updateScene());
    tilingOptions.add(controller, "tileRows", 1, 100, 1)
        .name("Number of instances z")
        .onChange(_ => controller.updateScene());
    tilingOptions.add(controller, "seamless")
        .name("Seamless")
        .onChange(_ => controller.updateScene());
    tilingOptions.close();

    const animationOptions = gui.addFolder("Animation");
    animationOptions.add(controller, "animationEnabled")
        .name("Enable animation")
        .onChange(_ => controller.updateAnimationEnabled());
    animationOptions.add(controller.animationDirection, "x", -0.25, 0.25)
        .name("Animation speed x+")
        .onChange(_ => controller.updateAnimationSpeeds());
    animationOptions.add(controller.animationDirection, "y", -0.25, 0.25)
        .name("Animation speed z+")
        .onChange(_ => controller.updateAnimationSpeeds());
    animationOptions.close();

    gui.add(controller, "generateNewHeightmap")
        .name("Generate new heightmap");
    gui.close();
}


function loadTextFile(path) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest;
        request.addEventListener("load", resolve);
        request.addEventListener("error", reject);
        request.open("GET", path);
        request.send();
    });
}

let heightmapVertexShaderText;
let heightmapFragmentShaderText;

Promise.all([loadTextFile("shader/heightmap-vertex.glsl"), loadTextFile("shader/heightmap-fragment.glsl")])
    .then(([singleVertexEvent, singleFragmentEvent]) => {
        heightmapVertexShaderText = singleVertexEvent.target.responseText;
        heightmapFragmentShaderText = singleFragmentEvent.target.responseText;
        main();
    })
    .catch((event) => console.log("load error", event));
