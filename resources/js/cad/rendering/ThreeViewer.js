import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WallTopology from '../geometry/WallTopology';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipWallSection, wallSections } from '../geometry/wallSections';

export default class ThreeViewer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0xf1f5f9);

        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(6, 12, 8);
        this.scene.add(light);

        this.camera = new THREE.PerspectiveCamera(
            60,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );

        this.camera.position.set(6, 8, 10);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });

        this.renderer.setSize(
            container.clientWidth,
            container.clientHeight
        );

        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );

        this.controls.enableDamping = true;

        this.elementsGroup = new THREE.Group();
        this.floorsGroup = new THREE.Group();
        this.scene.add(this.floorsGroup);
        this.scene.add(this.elementsGroup);
        this.elementMeshes = new Map();

        this.visible = true;
        this.pendingFrame = null;
        this.controls.addEventListener('change', () => this.requestRender());
        this.requestRender();
    }

    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) return;

        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.requestRender();
    }

    requestRender() {
        if (!this.visible || this.pendingFrame !== null) return;

        this.pendingFrame = requestAnimationFrame(() => {
            this.pendingFrame = null;
            if (this.visible) this.render();
        });
    }

    setVisible(visible) {
        this.visible = visible;
        if (!visible && this.pendingFrame !== null) {
            cancelAnimationFrame(this.pendingFrame);
            this.pendingFrame = null;
        }
        if (visible) this.requestRender();
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Creates a box using millimeters converted to scene meters.
     *
     * BoxGeometry is centered at its origin, so half-dimension offsets
     * place its base at ground level and align it with the CAD footprint.
     */
    createColumnMesh(column) {
        const { position, width, depth, height } = column;

        const geometry = new THREE.BoxGeometry(
            width / 1000,
            height / 1000,
            depth / 1000
        );

        const material = new THREE.MeshStandardMaterial({
            color: 0x9baaba,
            roughness: 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);

        const x = (position.x + (width / 2)) / 1000;
        const y = (height / 2) / 1000;
        const z = (position.y + (depth / 2)) / 1000;

        mesh.position.set(x, y, z);

        return mesh;
    }
 
    /**
     * Extrudes the resolved wall footprint to its stored height.
     *
     * CAD X and Y map to scene X and Z; scene Y represents height.
     * The mesh is derived from drawing data and does not replace it.
     */
    createWallMesh(wall, corners = wall.getGeometry()) {
        const geometries = [];
        const openingBottom = opening => opening.type === 'window'
            ? opening.sillHeight
            : 0;

        const openingTop = opening => opening.type === 'window'
            ? opening.sillHeight + opening.height
            : opening.height;


        const setGeometryColor = (geometry, colorValue) => {
            const color = new THREE.Color(colorValue);
            const count = geometry.getAttribute('position').count;
            const colors = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }

            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        };

        const addSection = (section, bottom, height) => {
            if (height <= 0 || section.length < 3) return;

            const shape = new THREE.Shape();

            shape.moveTo(section[0].x / 1000, -section[0].y / 1000);

            for (const point of section.slice(1)) {
                shape.lineTo(point.x / 1000, -point.y / 1000);
            }

            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height / 1000,
                bevelEnabled: false,
            });

            // Before rotation, extrusion depth becomes vertical height.
            geometry.translate(0, 0, bottom / 1000);
            geometries.push(geometry);
        };

        // Full-height wall sections between openings.
        for (const section of wallSections(wall, corners)) {
            addSection(section, 0, wall.height);
        }

        // Wall above and below each door.
        for (const opening of wall.openings) {
            const section = clipWallSection(
                wall, corners, opening.offset, opening.offset + opening.width
            );
            const bottom = openingBottom(opening);
            const top = openingTop(opening);

            addSection(section, 0, bottom);
            addSection(section, top, wall.height - top);
        }

        for (const geometry of geometries) {
            setGeometryColor(geometry, 0xc3ced8);
        }

        // Add a closed door leaf inside each opening.
        for (const opening of wall.openings) {
            const length = wall.getLength();
            const dx = (wall.end.x - wall.start.x) / length;
            const dy = (wall.end.y - wall.start.y) / length;

            // Place the panel halfway through the wall's thickness.
            const middle = wall.thickness * wall.thicknessSide / 2;

            const hingeX = wall.start.x + dx * opening.offset - dy * middle;
            const hingeY = wall.start.y + dy * opening.offset + dx * middle;

            const closedAngle = Math.atan2(dy, dx);
            const doorThickness = 40; // mm
            const bottom = openingBottom(opening);
            const panelHeight = openingTop(opening) - bottom;

            const door = new THREE.BoxGeometry(
                opening.width / 1000,
                doorThickness / 1000,
                panelHeight / 1000
            ).toNonIndexed();

            door.translate(
                opening.width / 2000,
                0,
                (bottom + panelHeight / 2) / 1000
            );

            door.rotateZ(-closedAngle);
            door.translate(hingeX / 1000, -hingeY / 1000, 0);

            setGeometryColor(
                door,
                opening.type === 'window' ? 0x8ab6cc : 0x8b5a2b
            );
            geometries.push(door);
        }

        const geometry = geometries.length
            ? mergeGeometries(geometries)
            : new THREE.BufferGeometry();

        for (const part of geometries) {
            part.dispose();
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            roughness: 0.9,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;

        return mesh;
    }

    /**
     * Rebuilds the 3D representation from the shared CAD elements.
     *
     * Resolved wall corners keep supported joins consistent with 2D.
     */
    updateElements(elements, wallGeometry = new Map()) {
        for (const floor of [...this.floorsGroup.children]) {
            this.floorsGroup.remove(floor);
            floor.geometry.dispose();
            floor.material.dispose();
        }
        for (const room of WallTopology.rooms(elements)) {
            this.floorsGroup.add(this.createFloorMesh(room.polygon));
        }
        this.requestRender();

        const currentIds = new Set();
        let sceneChanged = false;

        for (const element of elements) {
            currentIds.add(element.id);

            let corners = null;
            let signature;

            if (element.type === 'wall') {
                corners = wallGeometry.get(element.id)
                    ?? element.getGeometry();

                // The resolved corners include changes caused by joined walls.
                signature = JSON.stringify([
                    'wall',
                    element.height,
                    element.openings,
                    corners.map(point => [point.x, point.y])
                ]);
            } else if (element.type === 'column') {
                signature = JSON.stringify([
                    'column',
                    element.position.x,
                    element.position.y,
                    element.width,
                    element.depth,
                    element.height
                ]);
            } else {
                continue;
            }

            const existing = this.elementMeshes.get(element.id);

            if (existing?.signature === signature) {
                continue;
            }

            // Build the replacement before removing the old mesh.
            const mesh = element.type === 'wall'
                ? this.createWallMesh(element, corners)
                : this.createColumnMesh(element);

            if (existing) {
                this.elementsGroup.remove(existing.mesh);
                existing.mesh.geometry.dispose();
                existing.mesh.material.dispose();
            }

            this.elementsGroup.add(mesh);
            this.elementMeshes.set(element.id, { mesh, signature });
            sceneChanged = true;
        }

        for (const [id, existing] of this.elementMeshes) {
            if (currentIds.has(id)) {
                continue;
            }

            this.elementsGroup.remove(existing.mesh);
            existing.mesh.geometry.dispose();
            existing.mesh.material.dispose();
            this.elementMeshes.delete(id);
            sceneChanged = true;
        }

        if (sceneChanged) {
            this.requestRender();
        }
    }

    createFloorMesh(polygon) {
        const shape = new THREE.Shape();

        shape.moveTo(polygon[0].x / 1000, -polygon[0].y / 1000);
        for (const point of polygon.slice(1)) {
            shape.lineTo(point.x / 1000, -point.y / 1000);
        }
        shape.closePath();

        const mesh = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            new THREE.MeshStandardMaterial({
                color: 0xc3ced8,
                roughness: 0.9,
                side: THREE.DoubleSide
            })
        );

        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    }
}
