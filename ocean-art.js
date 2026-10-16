import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const reefCenters = [
    [-24, 7, 8], [25, -12, 10], [-31, -27, 7], [32, 28, 9], [-6, -48, 11]
];

export function sampleReefPoint(index, spread = 12) {
    const center = reefCenters[index % reefCenters.length];
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
}

function paintGeometry(geometry, color, accent = color) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    source.deleteAttribute('uv');
    const colors = [];
    const base = new THREE.Color(color);
    const tip = new THREE.Color(accent);
    const bounds = new THREE.Box3().setFromBufferAttribute(source.attributes.position);
    for (let vertex = 0; vertex < source.attributes.position.count; vertex++) {
        const height = source.attributes.position.getY(vertex);
        const mix = THREE.MathUtils.clamp((height - bounds.min.y) / Math.max(0.01, bounds.max.y - bounds.min.y), 0, 1);
        const tint = base.clone().lerp(tip, mix * 0.7);
        colors.push(tint.r, tint.g, tint.b);
    }
    source.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return source;
}

function combine(parts) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return geometry;
}

function branchBetween(start, end, radius, color, accent, segments = 6) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const geometry = new THREE.CylinderGeometry(radius * 0.48, radius, direction.length(), segments);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
    geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
    return paintGeometry(geometry, color, accent);
}

export function createFishGeometry(detail) {
    const segments = detail === 'low' ? 10 : 18;
    const body = new THREE.SphereGeometry(1, segments, 12);
    const positions = body.attributes.position;
    const colors = [];
    for (let vertex = 0; vertex < positions.count; vertex++) {
        const forward = positions.getZ(vertex);
        const taper = 0.65 + (forward + 1) * 0.17;
        const height = positions.getY(vertex);
        positions.setXYZ(vertex, positions.getX(vertex) * 0.28 * taper, height * 0.49 * taper, forward * 0.95);
        const stripe = Math.sin((forward + 1) * 15) > 0.65 && forward < 0.7;
        const tint = new THREE.Color(stripe ? 0x20323b : height > 0.15 ? 0xc5d8df : 0xffffff);
        colors.push(tint.r, tint.g, tint.b);
    }
    body.computeVertexNormals();
    body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const bodyPart = body.toNonIndexed();
    bodyPart.deleteAttribute('uv');
    body.dispose();
    const parts = [bodyPart];
    const fin = (vertices, color) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        parts.push(paintGeometry(geometry, color));
    };
    fin([0, 0, -0.7, 0, 0.6, -1.55, 0, 0.03, -1.32, 0, 0, -0.7, 0, 0.03, -1.32, 0, -0.6, -1.55], 0xf9ce75);
    fin([0, 0.32, 0.4, 0, 0.85, -0.32, 0, 0.28, -0.7], 0xebcb80);
    fin([0, -0.25, 0.15, 0, -0.65, -0.5, 0, -0.24, -0.75], 0xf2daa0);
    fin([0.22, 0, 0.35, 0.66, -0.26, -0.2, 0.18, -0.08, -0.3], 0xffe7a8);
    fin([-0.22, 0, 0.35, -0.18, -0.08, -0.3, -0.66, -0.26, -0.2], 0xffe7a8);
    for (const side of [-1, 1]) {
        const eye = new THREE.SphereGeometry(0.07, 8, 6);
        eye.translate(side * 0.19, 0.14, 0.64);
        parts.push(paintGeometry(eye, 0x111f27));
        const glint = new THREE.SphereGeometry(0.023, 6, 4);
        glint.translate(side * 0.247, 0.16, 0.67);
        parts.push(paintGeometry(glint, 0xffffff));
    }
    return combine(parts);
}

export function createCoral(type, colorSet, scale) {
    const parts = [];
    const color = colorSet.main;
    const accent = new THREE.Color(color).lerp(new THREE.Color(0xffefcd), 0.6);
    if (type === 'branch' || type === 'fan') {
        const count = type === 'fan' ? 19 : 10;
        const trunk = new THREE.Vector3(0, 0.1, 0);
        const root = new THREE.Vector3(0, 0.8, 0);
        parts.push(branchBetween(trunk, root, 0.17, color, accent));
        for (let branch = 0; branch < count; branch++) {
            const angle = type === 'fan' ? (branch / (count - 1) - 0.5) * 2.6 : branch * 2.4;
            const tip = type === 'fan'
                ? new THREE.Vector3(Math.sin(angle) * 2.3, 0.8 + Math.cos(angle) * 2.7, Math.sin(branch) * 0.13)
                : new THREE.Vector3(Math.cos(angle) * 1.3, 1.8 + Math.random() * 1.7, Math.sin(angle) * 1.3);
            const middle = root.clone().lerp(tip, 0.55);
            parts.push(branchBetween(root, middle, 0.095, color, accent));
            parts.push(branchBetween(middle, tip, 0.063, color, accent));
            for (let twig = 0; twig < 3; twig++) {
                const origin = middle.clone().lerp(tip, twig / 4);
                const destination = origin.clone().add(new THREE.Vector3((twig % 2 ? -1 : 1) * 0.42, 0.47, type === 'fan' ? 0.04 : Math.sin(angle + twig) * 0.45));
                parts.push(branchBetween(origin, destination, 0.034, color, 0xffefd3, 5));
            }
        }
    } else if (type === 'table') {
        for (let layer = 0; layer < 3; layer++) {
            const radius = 2.1 - layer * 0.4;
            const plate = new THREE.CylinderGeometry(radius, radius * 0.82, 0.16, 40, 1);
            const positions = plate.attributes.position;
            for (let vertex = 0; vertex < positions.count; vertex++) {
                const angle = Math.atan2(positions.getZ(vertex), positions.getX(vertex));
                positions.setY(vertex, positions.getY(vertex) + Math.sin(angle * 9) * 0.11 + layer * 0.7 + 0.8);
            }
            plate.computeVertexNormals();
            parts.push(paintGeometry(plate, color, accent));
            const rim = new THREE.TorusGeometry(radius * 0.95, 0.048, 4, 48);
            rim.rotateX(Math.PI / 2);
            rim.translate(0, layer * 0.7 + 0.9, 0);
            parts.push(paintGeometry(rim, accent));
        }
        parts.push(branchBetween(new THREE.Vector3(), new THREE.Vector3(0, 2.2, 0), 0.2, color, accent));
    } else if (type === 'tube') {
        for (let tube = 0; tube < 8; tube++) {
            const angle = tube * 2.4;
            const radius = 0.22 + Math.random() * 0.18;
            const height = 1.2 + Math.random() * 2.2;
            const offset = new THREE.Vector3(Math.cos(angle) * 0.85, 0, Math.sin(angle) * 0.85);
            const geometry = new THREE.CylinderGeometry(radius, radius * 1.3, height, 12, 3, true);
            geometry.translate(offset.x, height / 2, offset.z);
            parts.push(paintGeometry(geometry, color, accent));
            const rim = new THREE.TorusGeometry(radius, 0.055, 6, 12);
            rim.rotateX(Math.PI / 2);
            rim.translate(offset.x, height, offset.z);
            parts.push(paintGeometry(rim, accent));
            const mouth = new THREE.CircleGeometry(radius * 0.9, 12);
            mouth.rotateX(-Math.PI / 2);
            mouth.translate(offset.x, height - 0.15, offset.z);
            parts.push(paintGeometry(mouth, 0x293950));
        }
    } else {
        const geometry = new THREE.SphereGeometry(1.5, 32, 20);
        const positions = geometry.attributes.position;
        for (let vertex = 0; vertex < positions.count; vertex++) {
            const height = positions.getY(vertex);
            const angle = Math.atan2(positions.getZ(vertex), positions.getX(vertex));
            const wrinkle = 1 + Math.sin(angle * 18 + Math.sin(height * 7) * 2) * 0.055;
            positions.setXYZ(vertex, positions.getX(vertex) * wrinkle, height * 0.75 + 1, positions.getZ(vertex) * wrinkle);
        }
        geometry.computeVertexNormals();
        parts.push(paintGeometry(geometry, color, accent));
    }
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.78, metalness: 0,
        emissive: colorSet.emissive, emissiveIntensity: 0.055, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(combine(parts), material);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'coral', coralType: type };
    return mesh;
}

export function createTerrainMaterial(uniforms) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    material.onBeforeCompile = shader => {
        shader.uniforms.reefTime = uniforms.time;
        shader.uniforms.reefCaustics = uniforms.caustics;
        shader.vertexShader = 'varying vec3 vReefPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvReefPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = 'uniform float reefTime;\nuniform float reefCaustics;\nvarying vec3 vReefPosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            vec2 sandUv = vReefPosition.xz;
            float grain = fract(sin(dot(floor(sandUv * 23.0), vec2(12.9898, 78.233))) * 43758.5453);
            float ripple = sin(sandUv.x * 2.5 + sin(sandUv.y * 0.45) * 2.8);
            diffuseColor.rgb *= 0.94 + grain * 0.09 + ripple * 0.045;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            vec2 flow = vReefPosition.xz * 0.5 + vec2(reefTime * 0.11, reefTime * -0.07);
            float weave = sin(flow.x + sin(flow.y * 1.4)) * sin(flow.y + cos(flow.x * 1.1));
            float caustic = pow(1.0 - abs(weave), 18.0);
            totalEmissiveRadiance += vec3(0.075, 0.15, 0.12) * caustic * reefCaustics;
        `);
    };
    return material;
}

export function createSeaweedMaterial(uniforms) {
    const material = new THREE.MeshStandardMaterial({
        color: 0x7ca779, roughness: 0.85, side: THREE.DoubleSide
    });
    material.onBeforeCompile = shader => {
        shader.uniforms.reefTime = uniforms.time;
        shader.vertexShader = 'uniform float reefTime;\nvarying float vBladeHeight;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            vBladeHeight = position.y / 4.0;
            float phase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.25;
            float bend = vBladeHeight * vBladeHeight;
            transformed.x += (sin(reefTime * 1.1 + phase + vBladeHeight) * 0.55 + 0.35) * bend;
            transformed.z += cos(reefTime * 0.8 + phase) * bend * 0.3;
        `);
        shader.fragmentShader = 'varying float vBladeHeight;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            diffuseColor.rgb *= mix(vec3(0.52, 0.69, 0.62), vec3(1.25, 1.22, 0.73), vBladeHeight);
        `);
    };
    return material;
}

function createManta() {
    const parts = [];
    const body = new THREE.SphereGeometry(1, 20, 12);
    body.scale(0.9, 0.23, 1.5);
    parts.push(paintGeometry(body, 0xb8e0d5, 0x214f68));
    const wings = [];
    for (const side of [-1, 1]) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let section = 0; section < 12; section++) {
            const inner = section / 12;
            const outer = (section + 1) / 12;
            const point = amount => [side * (0.45 + amount * 3.4), Math.sin(amount * Math.PI) * 0.18, 0.85 - amount * 1.65];
            const lower = amount => [side * (0.45 + amount * 3.4), Math.sin(amount * Math.PI) * 0.18, -1.25 - amount * 0.5 + amount * amount * 1.5];
            vertices.push(...point(inner), ...lower(inner), ...point(outer), ...point(outer), ...lower(inner), ...lower(outer));
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        const wing = new THREE.Mesh(paintGeometry(geometry, 0x234e64, 0x4b8792), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }));
        wing.userData.side = side;
        wings.push(wing);
    }
    const tail = new THREE.ConeGeometry(0.09, 3.4, 8);
    tail.rotateX(-Math.PI / 2);
    tail.translate(0, 0, -2.6);
    parts.push(paintGeometry(tail, 0x28576b));
    for (const side of [-1, 1]) {
        const horn = new THREE.TorusGeometry(0.24, 0.1, 6, 12, Math.PI);
        horn.rotateX(Math.PI / 2);
        horn.translate(side * 0.43, 0, 1.3);
        parts.push(paintGeometry(horn, 0x709d9f));
        const eye = new THREE.SphereGeometry(0.08, 8, 6);
        eye.translate(side * 0.67, 0.13, 0.8);
        parts.push(paintGeometry(eye, 0x10252e));
    }
    const group = new THREE.Group();
    group.add(new THREE.Mesh(combine(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })), ...wings);
    group.scale.setScalar(1.45);
    group.userData.wings = wings;
    return group;
}

function createTurtle() {
    const parts = [];
    const shell = new THREE.SphereGeometry(1, 24, 16);
    shell.scale(1.15, 0.52, 1.4);
    const positions = shell.attributes.position;
    const colors = [];
    for (let vertex = 0; vertex < positions.count; vertex++) {
        const angle = Math.atan2(positions.getX(vertex), positions.getZ(vertex));
        const height = positions.getY(vertex);
        const seam = Math.abs(Math.sin(angle * 5)) < 0.15 || Math.abs(Math.sin(height * 13)) < 0.2;
        const color = new THREE.Color(height < -0.1 ? 0xd0cd9c : seam ? 0xc6b77d : 0x526e52);
        colors.push(color.r, color.g, color.b);
    }
    shell.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const shellPart = shell.toNonIndexed();
    shellPart.deleteAttribute('uv');
    shell.dispose();
    parts.push(shellPart);
    const head = new THREE.SphereGeometry(0.35, 16, 10);
    head.scale(0.9, 0.8, 1.25);
    head.translate(0, 0, 1.5);
    parts.push(paintGeometry(head, 0x88a17a, 0xc4c79b));
    for (const side of [-1, 1]) {
        const eye = new THREE.SphereGeometry(0.055, 8, 6);
        eye.translate(side * 0.28, 0.12, 1.68);
        parts.push(paintGeometry(eye, 0x122a29));
    }
    const group = new THREE.Group();
    group.add(new THREE.Mesh(combine(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
    const flippers = [];
    for (const side of [-1, 1]) {
        for (const front of [true, false]) {
            const geometry = new THREE.SphereGeometry(1, 12, 8);
            geometry.scale(front ? 1.05 : 0.6, 0.09, 0.3);
            geometry.translate(side * (front ? 1.28 : 0.95), -0.12, front ? 0.55 : -1);
            const flipper = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8eaa80, roughness: 0.7 }));
            flipper.userData.side = side;
            flippers.push(flipper);
            group.add(flipper);
        }
    }
    group.scale.setScalar(1.3);
    group.userData.flippers = flippers;
    return group;
}

export function decorateReef(scene, terrain, config, uniforms) {
    const group = new THREE.Group();
    group.name = 'Reef art direction';
    const rockParts = [];
    for (let rock = 0; rock < 74; rock++) {
        const [horizontal, depth] = sampleReefPoint(rock, rock < 25 ? 8 : 18);
        const size = rock < 25 ? 2.2 + Math.random() * 3.2 : 0.4 + Math.random() * 1.8;
        const geometry = new THREE.IcosahedronGeometry(1, 2);
        const rockPositions = geometry.attributes.position;
        for (let vertex = 0; vertex < rockPositions.count; vertex++) {
            const horizontal = rockPositions.getX(vertex);
            const height = rockPositions.getY(vertex);
            const depth = rockPositions.getZ(vertex);
            const displacement = 1 + Math.sin(horizontal * 5 + depth * 3) * Math.sin(height * 4 - depth * 2) * 0.13;
            rockPositions.setXYZ(vertex, horizontal * displacement, height * displacement, depth * displacement);
        }
        geometry.computeVertexNormals();
        geometry.scale(size * 1.5, size * 0.8, size);
        geometry.rotateY(Math.random() * Math.PI);
        geometry.translate(horizontal, terrain.getTerrainHeight(horizontal, depth) + size * 0.27, depth);
        rockParts.push(paintGeometry(geometry, 0x466961, rock % 3 === 0 ? 0x7f9567 : 0x91a58c));
    }
    const archPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-17, -26, -32), new THREE.Vector3(-16, -16, -34),
        new THREE.Vector3(-8, -10, -35), new THREE.Vector3(2, -12, -35),
        new THREE.Vector3(9, -23, -33)
    ]);
    const arch = new THREE.TubeGeometry(archPath, 36, 2.3, 10, false);
    const archPositions = arch.attributes.position;
    for (let vertex = 0; vertex < archPositions.count; vertex++) {
        const ripple = Math.sin(archPositions.getX(vertex) * 2.2 + archPositions.getY(vertex) * 1.3) * 0.35;
        archPositions.setY(vertex, archPositions.getY(vertex) + ripple);
    }
    arch.computeVertexNormals();
    rockParts.push(paintGeometry(arch, 0x537169, 0x94a589));
    const rocks = new THREE.Mesh(combine(rockParts), createTerrainMaterial(uniforms));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
    const starParts = [];
    for (let star = 0; star < 26; star++) {
        const [horizontal, depth] = sampleReefPoint(star, 18);
        const shape = new THREE.Shape();
        for (let tip = 0; tip < 10; tip++) {
            const angle = tip * Math.PI / 5;
            const radius = tip % 2 ? 0.23 : 0.8;
            if (tip === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.06, bevelThickness: 0.07 });
        geometry.rotateX(-Math.PI / 2);
        geometry.rotateY(star * 1.4);
        geometry.translate(horizontal, terrain.getTerrainHeight(horizontal, depth) + 0.15, depth);
        starParts.push(paintGeometry(geometry, star % 2 ? 0xd58958 : 0xb87589, 0xf2c896));
    }
    group.add(new THREE.Mesh(combine(starParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
    const sky = new THREE.Mesh(new THREE.SphereGeometry(235, 32, 20), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { upper: { value: new THREE.Color(0x5cbfbb) }, lower: { value: new THREE.Color(0x063c57) } },
        vertexShader: `varying vec3 vDirection;
            void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 upper; uniform vec3 lower; varying vec3 vDirection;
            void main() {
                float gradient = smoothstep(-0.35, 0.7, vDirection.y);
                vec3 color = mix(lower, upper, gradient);
                float sun = pow(max(0.0, dot(normalize(vDirection), normalize(vec3(-0.4, 0.8, -0.2)))), 18.0);
                gl_FragColor = vec4(color + vec3(0.32, 0.37, 0.28) * sun, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
    }));
    sky.renderOrder = -10;
    group.add(sky);
    const rayMaterial = new THREE.ShaderMaterial({
        uniforms: { time: uniforms.time, rayStrength: uniforms.ray },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float time; uniform float rayStrength; varying vec2 vUv;
            void main() {
                float width = pow(max(0.0, sin(vUv.x * 3.14159)), 3.0);
                float fade = sin(vUv.y * 3.14159) * (0.4 + vUv.y * 0.6);
                float shimmer = 0.85 + sin(time * 0.3 + vUv.y * 8.0) * 0.15;
                gl_FragColor = vec4(0.63, 0.89, 0.79, width * fade * shimmer * 0.075 * rayStrength);
            }`
    });
    for (let ray = 0; ray < 9; ray++) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + ray % 3 * 2, 65), rayMaterial);
        mesh.position.set(-40 + ray * 9, -2, -45 + ray % 3 * 13);
        mesh.rotation.z = -0.29;
        mesh.rotation.y = -0.3;
        group.add(mesh);
    }
    const animals = [createManta(), createTurtle(), createManta()];
    animals[2].scale.multiplyScalar(0.65);
    animals.forEach(animal => group.add(animal));
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({
        color: 0xdce3ac, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
    }));
    pulse.visible = false;
    group.add(pulse);
    let pulseStarted = -10;
    scene.add(group);
    return {
        pulse(position, camera, time) {
            pulse.position.copy(position);
            pulse.quaternion.copy(camera.quaternion);
            pulseStarted = time;
            pulse.visible = true;
        },
        update(time) {
            const age = time - pulseStarted;
            pulse.visible = age < 1.2;
            if (pulse.visible) {
                pulse.scale.setScalar(0.4 + age * 4);
                pulse.material.opacity = (1 - age / 1.2) * 0.65;
            }
            animals.forEach((animal, index) => {
                const angle = time * (index === 1 ? 0.026 : 0.043) + index * 2.4 + 2.5;
                const radius = index === 1 ? 15 : 23;
                const position = new THREE.Vector3(Math.cos(angle) * radius, -9 - index * 2 + Math.sin(angle * 2) * 1.2, Math.sin(angle) * radius - 6);
                const next = new THREE.Vector3(-Math.sin(angle), 0.04 * Math.cos(angle * 2), Math.cos(angle));
                animal.position.copy(position);
                animal.lookAt(position.clone().add(next));
                if (animal.userData.wings) {
                    animal.userData.wings.forEach(wing => { wing.rotation.z = Math.sin(time * 1.6 + index) * 0.16 * wing.userData.side; });
                }
                if (animal.userData.flippers) {
                    animal.userData.flippers.forEach(flipper => { flipper.rotation.z = Math.sin(time * 2.1) * 0.18 * flipper.userData.side; });
                }
            });
        },
        dispose() {
            scene.remove(group);
            const geometries = new Set();
            const materials = new Set();
            group.traverse(object => {
                if (object.geometry) geometries.add(object.geometry);
                if (object.material) materials.add(object.material);
            });
            geometries.forEach(geometry => geometry.dispose());
            materials.forEach(material => material.dispose());
        }
    };
}
