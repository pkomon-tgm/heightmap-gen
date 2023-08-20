
// provided by THREE.js
//uniform vec3 cameraPosition;

uniform int shadingMode;

varying vec2 vUv;
varying vec3 vertexPosition;
varying vec3 vertexNormal;

void main() {
    vec3 diffuseIntensity = vec3(0.1, 0.3, 0.75);

    if (shadingMode == 1) {
        gl_FragColor = vec4(diffuseIntensity, 1.0);
    } else if (shadingMode == 2) {
        gl_FragColor = vec4(vertexNormal, 1.0);
    } else if (shadingMode == 3) {
        gl_FragColor = vec4(vUv.x, 0.0, vUv.y, 1.0);
    } else if (shadingMode == 4) {
        vec3 ambientIntensity = vec3(0.0, 0.0, 0.0);
        vec3 specularIntensity = vec3(1.0, 1.0, 1.0);
        float kAmbient = 0.0;
        float kDiffuse = 1.0;
        float kSpecular = 0.0;
        float shininess = 75.0;

        vec3 vertexToViewer = normalize(cameraPosition - vertexPosition);
        vec3 vertexToLightSource = normalize(vec3(1.0, 1.0, 0.0)); //directional light
        vec3 halfwayVector = normalize(vertexToViewer + vertexToLightSource);
        vec3 reflectionVector = normalize(2.0 * dot(vertexToLightSource, vertexNormal) * vertexNormal - vertexToLightSource);

        float diffuseFactor = max(dot(vertexToLightSource, vertexNormal), 0.0);
        float specularFactor = pow(max(dot(reflectionVector, vertexToViewer), 0.0), shininess);

        vec3 intensity = kAmbient * ambientIntensity
        + kDiffuse * diffuseFactor * diffuseIntensity
        + kSpecular * specularFactor * specularIntensity;

        //TODO make it look good
        gl_FragColor = vec4(intensity, 1.0);
    }

}