
uniform sampler2D heightMap;
uniform sampler2D normals;

uniform float time;
uniform vec2 animationSpeed;
uniform bool animationEnabled;

// provided by three.js
//uniform mat4 modelViewMatrix;
//uniform mat4 projectionMatrix;

// provided by three.js:
//attribute vec3 position;
//attribute vec3 normal;
//attribute vec2 uv;

varying vec2 vUv;
varying vec3 vertexPosition;
varying vec3 vertexNormal;

void main() {
    vec3 newPosition = position;
    vec2 newUv = uv;
    if (animationEnabled) {
        newUv = uv + time * animationSpeed;
    }
    newPosition.y = texture(heightMap, newUv).r;
    vertexNormal = 2.0 * texture(normals, newUv).xyz - 1.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

    vUv = newUv;
    vertexPosition = gl_Position.xyz;
}