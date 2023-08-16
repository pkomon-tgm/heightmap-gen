import * as THREE from "three";
import {GUI} from "three/addons/libs/lil-gui.module.min.js";

function clamp(min, value, max) {
    return Math.max(min, Math.min(value, max));
}

function normalize2dArray(values) {
    const minResult = Math.min(...values.map(row => Math.min(...row)));
    const maxResult = Math.max(...values.map(row => Math.max(...row)));
    return values.map(valueArray => valueArray.map(value => (value - minResult) / (maxResult - minResult)));
}

class HeightmapScene {
    constructor(domElement) {

        const viewportDimensions = domElement.getBoundingClientRect();

        this.scene = new THREE.Scene();
        this.perspCamera = new THREE.PerspectiveCamera(75,
            viewportDimensions.width / viewportDimensions.height, 0.1, 1000);
        this.perspCamera.up.set(0, 1, 0);
        // TODO fix later, unimportant
        this.orthoCamera = new THREE.OrthographicCamera(-3, 3,
            (viewportDimensions.width / viewportDimensions.height) * -3,
            (viewportDimensions.width / viewportDimensions.height) * 3,
            0.1, 1000);
        //this.orthoCamera.up.set(0, 1, 0);
        this.camera = this.perspCamera;

        // camera parameters
        this.radius = 2.5;
        this.phi = Math.PI / 2;
        this.theta = Math.PI / 4;
        this.cameraCenter = new THREE.Vector3(0, 0, 0);

        this.updateArcballCameras();

        this.renderer = new THREE.WebGLRenderer({canvas: domElement});
        this.renderer.setSize(viewportDimensions.width, viewportDimensions.height);

        this.isMouseDown = false;
        domElement.addEventListener("mousedown", () => {
            this.isMouseDown = true;
        });
        domElement.addEventListener("mouseup", () => {
            this.isMouseDown = false;
        });
        domElement.addEventListener("mousemove", (event) => {
            this.handleMouseMove(event);
        });
        domElement.addEventListener("wheel", (event) => {
            this.handleMouseScroll(event);
        });

    }

    updateArcballCameras() {
        HeightmapScene.updateCamera(this.perspCamera, this.radius, this.theta, this.phi, this.cameraCenter);
        HeightmapScene.updateCamera(this.orthoCamera, this.radius, this.theta, this.phi, this.cameraCenter);
    }

    handleMouseMove(event) {
        if (!this.isMouseDown) {
            return;
        }

        if (event.shiftKey) {
            const DRAG_SENSITIVITY = 0.005;
            const relativeMovement = new THREE.Vector3(-event.movementY * DRAG_SENSITIVITY, 0, event.movementX * DRAG_SENSITIVITY)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.phi);
            this.cameraCenter.add(relativeMovement);
            this.updateArcballCameras();
        } else {
            const ORBIT_SENSITIVITY = 0.005;
            this.theta = clamp(ORBIT_SENSITIVITY, this.theta - event.movementY * ORBIT_SENSITIVITY, Math.PI - ORBIT_SENSITIVITY);
            this.phi = this.phi + event.movementX * ORBIT_SENSITIVITY;
            this.updateArcballCameras();
        }
    }

    handleMouseScroll(event) {
        const SCROLL_SENSITIVITY = 0.5;
        const dir = Math.sign(event.deltaY);
        this.radius += dir * SCROLL_SENSITIVITY;
        this.updateArcballCameras();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.renderer.render(this.scene, this.camera);
    }

    static updateCamera(camera, radius, theta, phi, center) {
        camera.position.set(radius * Math.sin(theta) * Math.cos(phi),
            radius * Math.cos(theta),
            radius * Math.sin(theta) * Math.sin(phi))
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

        indices.push(i, i + numCols + 1, i + 1,
            i + 1, i + numCols + 1, i + numCols + 2);
    }
    return indices;
}

// old version used to generate vertices directly
/*function generateGridMeshVertices(cellSizeAlongX, cellSizeAlongZ, yScale, heightMap) {
    return heightMap
        .map((valueArray, rowIndex) => valueArray
            .map((value, colIndex) => [
                colIndex * cellSizeAlongX,
                value * yScale,
                rowIndex * cellSizeAlongZ,
            ])
            .reduce((acc, vec) => acc.concat(...vec), []))
        .reduce((acc, vec) => acc.concat(...vec), []);
}*/

function generateGridMeshVertices(numRows, numCols, cellSizeAlongX, cellSizeAlongZ) {
    return [...new Array(numRows)]
        .map((_, rowIndex) => [...new Array(numCols)]
            .map((_, colIndex) => [
                colIndex * cellSizeAlongX,
                0,
                rowIndex * cellSizeAlongZ,
            ])
        );
}

function generateGridMeshUv(numRows, numCols) {
    return [...new Array(numRows)]
        .map((_, rowIndex) => [...new Array(numCols)]
            .map((_, colIndex) => [colIndex / (numCols - 1), rowIndex / (numRows - 1)]));
}

// used for transforming spectrum
function hurstExponentScaling(hurstExponent) {
    return function (coefficient, rowIndex, colIndex, coefficientArray) {
        return math.multiply(coefficient,
            1 / Math.pow((rowIndex + colIndex + 1) / coefficientArray.length, hurstExponent));
    };
}

// used for transforming spectrum
function hurstExponentWithFrequencyScaling(hurstExponent, rowFrequencyFactor, colFrequencyFactor) {
    return function (coefficient, rowIndex, colIndex, coefficientArray) {
        return math.multiply(coefficient,
            1 / Math.pow((rowFrequencyFactor * rowIndex + colFrequencyFactor * colIndex + 1), hurstExponent));
    };
}

// TODO tried to mimic d3's generator structure, idk, kind of dont like how it turned out
class GridGenerator {
    #numRows = 5;
    #numCols = 5;
    #initFunc = function (rowIndex, colIndex) {
        return 0;
    };

    numRows(value) {
        if (arguments.length === 0) {
            return this.#numRows;
        } else {
            this.#numRows = value;
            return this;
        }
    }

    numCols(value) {
        if (arguments.length === 0) {
            return this.#numCols;
        } else {
            this.#numCols = value;
            return this;
        }
    }

    initFunc(value) {
        if (arguments.length === 0) {
            return this.#initFunc;
        } else {
            this.#initFunc = value;
            return this;
        }
    }

    generate() {
        return generateValueGrid(this.#numRows, this.#numCols, this.#initFunc);
    }

    static whiteNoise() {
        return new GridGenerator()
            .initFunc(Math.random());
    }

}

function generateValueGrid(numRows, numCols, func) {
    return [...Array(numRows)]
        .map((_, rowIndex) => [...Array(numCols)]
            .map((_, colIndex) => func(rowIndex, colIndex)));
}


const whiteNoise = Math.random;
const identityFunction = i => i;

class TerrainGenerator {
    numRows = 64;
    numCols = 64;

    initialSampleFunction = whiteNoise;
    spectrumTransform = identityFunction;

    samples = undefined;
    spectrum = undefined;
    modifiedSpectrum = undefined;
    modifiedSamples = undefined;

    constructor({numRows, numCols}) {
        this.numRows = numRows;
        this.numCols = numCols;
    }

    initSamplesAndCalcSpectrum() {
        this.samples = generateValueGrid(this.numRows, this.numCols, this.initialSampleFunction)
        this.spectrum = TerrainGenerator.fourierTransform(this.samples);
    }

    calcModifiedSpectrumAndModifiedSamples() {
        this.modifiedSpectrum = TerrainGenerator.#transformSpectrum(this.spectrum, this.spectrumTransform);
        this.modifiedSamples = normalize2dArray(TerrainGenerator.inverseFourierTransform(this.modifiedSpectrum));
    }

    calcAll() {
        this.initSamplesAndCalcSpectrum();
        this.calcModifiedSpectrumAndModifiedSamples();
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


function ensureRectangular(array) {
    array.forEach((row, _) => console.assert(row.length === array[0].length));
}

function generateTexture(data) {
    ensureRectangular(data);

    const height = data.length; //rows
    const width = data[0].length; //cols

    const typedArray = new Uint8Array(data.flat());

    const texture = new THREE.DataTexture(typedArray, width, height,
        THREE.RedFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

function createHeightMapShaderMaterial(heightmapTexture = undefined, wireframe = true) {
    return new THREE.ShaderMaterial({
        uniforms: {
            heightMap: {value: heightmapTexture},
        },
        vertexShader: vertexShaderText,
        fragmentShader: fragmentShaderText,

        wireframe: wireframe,
        side: THREE.FrontSide,
    });
}

function createHeightmapTexture(heightmapData) {
    const textureData = heightmapData.map(row => row.map(value => Math.round(value * 255))); //TODO
    return generateTexture(textureData);
}

function createHeightMapGeometry(numHeightFieldRows, numHeightFieldCols, seamless, cellWidth, cellHeight) {
    const numRowsWithSeam = seamless ? numHeightFieldRows + 1 : numHeightFieldRows;
    const numColsWithSeam = seamless ? numHeightFieldCols + 1 : numHeightFieldCols;

    const vertices = generateGridMeshVertices(numRowsWithSeam, numColsWithSeam, cellWidth, cellHeight);
    let uv = generateGridMeshUv(numHeightFieldRows, numHeightFieldCols);
    const indices = generateGridMeshIndices(numRowsWithSeam - 1, numColsWithSeam - 1);

    // loop height and uv values around for seamless
    if (seamless) {
        uv = uv.map(col => col.concat([col[0]]));
        uv = uv.concat([uv[0]]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices.flat(2)), 3));
    geometry.computeVertexNormals(true);
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv.flat(2)), 2));
    geometry.setIndex(indices);

    return geometry;
}

class Controller {
    static SHADING = {FLAT: "flat", WIREFRAME: "wireframe"};

    shading = Controller.SHADING.WIREFRAME; //TODO work on it later
    hurstExponent = 2.0;
    numRows = 64;
    numCols = 64;
    cellWidth = 0.05;
    cellHeight = 0.05;
    yScale = 1.0;
    rowFrequencyFactor = 1.0;
    colFrequencyFactor = 1.0;

    tileRows = 1;
    tileCols = 1;
    seamless = false;

    #terrainGenerator = new TerrainGenerator({numRows: this.numRows, numCols: this.numCols});
    #scene = new HeightmapScene(document.getElementById("webGlCanvas"));

    #currentMaterial = undefined;
    #currentMeshes = [];


    constructor() {
        //const axesHelper = new THREE.AxesHelper(5);
        //this.#scene.scene.add(axesHelper);

        this.#terrainGenerator.spectrumTransform = hurstExponentWithFrequencyScaling(
            this.hurstExponent, this.rowFrequencyFactor, this.colFrequencyFactor);
        this.#terrainGenerator.calcAll();
        this.updateScene();

        //scene.scene.add(new THREE.AmbientLight(0xFFFFFF, 0.5));
        const light = new THREE.DirectionalLight(0xFFFFFF, 5);
        light.position.set(0, 1, 0);
        light.target.position.set(0, 0, 0);
        this.#scene.scene.add(light);
        //scene.scene.add(light.target);

        this.#scene.animate();
    }

    updateScene() {
        /*if (this.#lastMeshes.length !== 0) {
            this.#lastMeshes[0].material.uniforms.heightMap.value.dispose();
        }*/
        this.#currentMeshes.forEach(mesh => this.#scene.scene.remove(mesh));
        this.#currentMeshes.length = 0; // clear array

        const samples = this.#terrainGenerator.modifiedSamples;

        const texture = createHeightmapTexture(samples);
        this.#currentMaterial = createHeightMapShaderMaterial(texture);
        this.updateMaterial(); //TODO somewhat ugly

        const geometry = createHeightMapGeometry(this.numRows, this.numCols,
            this.seamless, this.cellWidth, this.cellHeight);

        const xSize = this.numCols * this.cellWidth;
        const zSize = this.numRows * this.cellHeight;
        const xOffset = -this.tileCols * xSize / 2;
        const zOffset = -this.tileRows * zSize / 2;
        for (let rowIndex = 0; rowIndex < this.tileRows; rowIndex++) {
            for (let colIndex = 0; colIndex < this.tileCols; colIndex++) {
                const mesh = new THREE.Mesh(geometry, this.#currentMaterial);
                this.#scene.scene.add(mesh);
                this.#currentMeshes.push(mesh);
                mesh.position.set(colIndex * xSize + xOffset, 0, rowIndex * zSize + zOffset);
                mesh.scale.y = this.yScale;
            }
        }
    }

    newRandomTerrain() {
        this.#terrainGenerator.calcAll();
        this.updateScene();
    }

    updateMaterial() {
        if (this.shading === Controller.SHADING.FLAT) {
            this.#currentMaterial.wireframe = false;
            this.#currentMaterial.flatShading = true;
        } else if (this.shading === Controller.SHADING.WIREFRAME) {
            this.#currentMaterial.wireframe = true;
            this.#currentMaterial.flatShading = false;
        }
        this.#currentMaterial.needsUpdate = true;
    }

    updateAll() {
        this.#terrainGenerator.numRows = this.numRows;
        this.#terrainGenerator.numCols = this.numCols;
        this.#terrainGenerator.spectrumTransform = hurstExponentWithFrequencyScaling(this.hurstExponent,
            this.rowFrequencyFactor, this.colFrequencyFactor);
        this.#terrainGenerator.calcAll();
        this.updateScene();
    }

    updateModifiedSpectrumAndSamples() {
        this.#terrainGenerator.spectrumTransform = hurstExponentWithFrequencyScaling(this.hurstExponent,
            this.rowFrequencyFactor, this.colFrequencyFactor);
        this.#terrainGenerator.calcModifiedSpectrumAndModifiedSamples();
        this.updateScene();
    }

}


function main() {

    const controller = new Controller();

    const gui = new GUI();

    const displayOptionsFolder = gui.addFolder("Display");
    displayOptionsFolder.add(controller, "shading", Controller.SHADING)
        .onChange(_ => controller.updateMaterial());

    const gridOptionsFolder = gui.addFolder("Grid dimensions and scaling");
    gridOptionsFolder.add(controller, "numRows", 0, 128, 1)
        .onFinishChange(_ => controller.updateAll());
    gridOptionsFolder.add(controller, "numCols", 0, 128, 1)
        .onFinishChange(_ => controller.updateAll());
    gridOptionsFolder.add(controller, "cellWidth", 0.05, 0.5, 0.05)
        .onChange(_ => controller.updateScene());
    gridOptionsFolder.add(controller, "cellHeight", 0.05, 0.5, 0.05)
        .onChange(_ => controller.updateScene());
    gridOptionsFolder.add(controller, "yScale", 0.0, 10.0)
        .onChange(_ => controller.updateScene());

    const generationOptionsFolder = gui.addFolder("Generation");
    generationOptionsFolder.add(controller, "hurstExponent", 0.0, 5.0)
        .onFinishChange(_ => controller.updateModifiedSpectrumAndSamples());
    generationOptionsFolder.add(controller, "rowFrequencyFactor", 0.0, 3.0)
        .onFinishChange(_ => controller.updateModifiedSpectrumAndSamples());
    generationOptionsFolder.add(controller, "colFrequencyFactor", 0.0, 3.0)
        .onFinishChange(_ => controller.updateModifiedSpectrumAndSamples());

    const tilingOptions = gui.addFolder("Tiling");
    tilingOptions.add(controller, "tileRows", 1, 100, 1)
        .onChange(_ => controller.updateScene());
    tilingOptions.add(controller, "tileCols", 1, 100, 1)
        .onChange(_ => controller.updateScene());
    tilingOptions.add(controller, "seamless")
        .onChange(_ => controller.updateScene());

    gui.add(controller, "newRandomTerrain");

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

let vertexShaderText;
let fragmentShaderText;

Promise.all([loadTextFile("shader/single-heightmap-vertex.glsl"), loadTextFile("shader/single-heightmap-fragment.glsl")])
    .then(([vertexEvent, fragmentEvent]) => {
        vertexShaderText = vertexEvent.target.responseText;
        fragmentShaderText = fragmentEvent.target.responseText;
        main();
    })
    .catch((event) => console.log("load error", event));
