import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class ThreeViewer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0xf1f5f9);

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

        const grid = new THREE.GridHelper(20, 20);
        this.scene.add(grid);

        this.elementsGroup = new THREE.Group();
        this.scene.add(this.elementsGroup);

        this.renderer.setAnimationLoop(() => {
            this.render();
        });
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    createColumnMesh(column) {
        const { position, width, depth, height } = column;

        const geometry = new THREE.BoxGeometry(
            width / 1000,
            height / 1000,
            depth / 1000
        );

        const material = new THREE.MeshNormalMaterial();

        const mesh = new THREE.Mesh(geometry, material);

        //Calculate the center X, Y, Z
        const x = (position.x + (width / 2)) / 1000;
        const y = (height / 2) / 1000;
        const z = (position.y + (depth / 2)) / 1000;

        //Set the mesh position
        mesh.position.set(x, y, z);

        return mesh;
    }
 
    createWallMesh(wall, corners = wall.getGeometry()) {
        // 1. Create a 2D shape representing the wall footprint.
        // The corners are already calculated by our CAD geometry system.
        const shape = new THREE.Shape();

        // Convert CAD millimeters to Three.js meters.
        // Negate CAD Y because we will rotate the shape into the XZ plane.
        shape.moveTo(
            corners[0].x / 1000,
            -corners[0].y / 1000
        );

        // Add the remaining corners to the shape.
        for (let i = 1; i < corners.length; i++) {
            shape.lineTo(
                corners[i].x / 1000,
                -corners[i].y / 1000
            );
        }

        shape.closePath();

        // 2. Extrude the footprint by the wall's height.
        // This creates a solid 3D wall.
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: wall.height / 1000,
            bevelEnabled: false
        });

        // 3. Material for visualization.
        const material = new THREE.MeshNormalMaterial();

        const mesh = new THREE.Mesh(geometry, material);

        // 4. Rotate the extrusion into the architectural coordinate system.
        //
        // After rotation:
        // CAD X becomes Three.js X.
        // CAD Y becomes Three.js Z.
        // Extrusion depth becomes Three.js Y (vertical).
        mesh.rotation.x = -Math.PI / 2;

        // No separate wall position or direction rotation is needed.
        // The footprint already contains the wall's world coordinates.
        return mesh;
    }

    clearElements() {
        for (const mesh of [...this.elementsGroup.children]) {
            this.elementsGroup.remove(mesh);

            mesh.geometry.dispose();
            mesh.material.dispose();
        }
    }

    updateElements(elements, wallGeometry = new Map()) {
        this.clearElements();

        for (const element of elements) {
            let mesh = null;

            if (element.type === 'wall') {
                const corners = wallGeometry.get(element.id)
                    ?? element.getGeometry();

                mesh = this.createWallMesh(element, corners);
            } else if (element.type === 'column') {
                mesh = this.createColumnMesh(element);
            }

            if (mesh) {
                this.elementsGroup.add(mesh);
            }
        }
    }
}