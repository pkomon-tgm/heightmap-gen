
uniform sampler2D heightMap;
uniform sampler2D normals;

uniform float time;
uniform vec2 animationSpeed;
uniform bool animationEnabled;
uniform float indicatorLength;

// provided by three.js
//uniform mat4 modelMatrix;
//uniform mat4 viewMatrix;
//uniform mat4 projectionMatrix;

// provided by three.js:
//attribute vec3 position;
//attribute vec2 uv;

void main() {

    vec3 heightmapPosition = position;
    vec2 newUv = uv;
    if (animationEnabled) {
        newUv = uv + time * animationSpeed;
    }
    heightmapPosition.y = texture(heightMap, newUv).r;
    vec4 worldPosition = modelMatrix * vec4(heightmapPosition, 1.0);

    // if end point, add vertex normal
    if (gl_VertexID % 2 == 1) {
        vec3 vertexNormal = 2.0 * texture(normals, newUv).xyz - 1.0;
        worldPosition = worldPosition + vec4(indicatorLength * vertexNormal, 0.0f);
    }

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}