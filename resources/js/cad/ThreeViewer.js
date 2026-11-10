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

    createWallMesh(wall) {
        // 1. Get the wall's actual length in millimeters
        const length = wall.getLength();

        const { start, end, thickness, height } = wall;

        // 2. Convert dimensions from millimeters to meters
        // Three.js will use 1 unit = 1 meter
        const lengthM = length / 1000;
        const heightM = height / 1000;
        const thicknessM = thickness / 1000;

        // 3. Create a rectangular 3D box
        // BoxGeometry(width, height, depth)
        // X = wall length
        // Y = wall height
        // Z = wall thickness
        const geometry = new THREE.BoxGeometry(
            lengthM,
            heightM,
            thicknessM
        );

        // 4. Create a material to make the wall visible
        // MeshNormalMaterial colors faces according to direction
        // and doesn't require lighting
        const material = new THREE.MeshNormalMaterial();

        // 5. Combine the geometry and material into a mesh
        const mesh = new THREE.Mesh(geometry, material);

        // 6. Get the four corners of the wall's 2D footprint
        // These account for the wall's actual thickness
        // and its inner-face reference line
        const corners = wall.getGeometry();

        // 7. Calculate the center of the wall's footprint
        // The center is the average of all four corners
        let sumX = 0;
        let sumY = 0;

        for (const corner of corners) {
            sumX += corner.x;
            sumY += corner.y;
        }

        const centerX = sumX / corners.length;
        const centerY = sumY / corners.length;

        // 8. Position the 3D wall
        // CAD X becomes Three.js X
        // CAD Y becomes Three.js Z
        // Height becomes Three.js Y
        //
        // We use half the height because BoxGeometry is
        // centered at its origin. This places its base at Y = 0.
        mesh.position.set(
            centerX / 1000,
            heightM / 2,
            centerY / 1000
        );

        // 9. Calculate the direction of the wall
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // atan2() returns the angle in radians
        // relative to the positive X-axis
        const angle = Math.atan2(dy, dx);

        // 10. Rotate the wall around the vertical Y-axis
        // Negative because CAD Y maps to Three.js Z
        mesh.rotation.y = -angle;

        // 11. Return the mesh so it can be added to the scene
        return mesh;   
    }

    clearElements() {
        for (const mesh of [...this.elementsGroup.children]) {
            this.elementsGroup.remove(mesh);

            mesh.geometry.dispose();
            mesh.material.dispose();
        }
    }

    updateElements(elements) {
        this.clearElements();

        for (const element of elements) {
            let mesh = null;

            if (element.type === 'wall') {
                mesh = this.createWallMesh(element);
            } else if (element.type === 'column') {
                mesh = this.createColumnMesh(element);
            }

            if (mesh) {
                this.elementsGroup.add(mesh);
            }
        }
    }
}