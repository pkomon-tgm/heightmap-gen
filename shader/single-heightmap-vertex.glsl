uniform sampler2D heightMap;

varying vec2 vUv;

void main() {
    vUv = uv;

    vec3 newPosition = position;
    newPosition.y = texture(heightMap, uv).r;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}