import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Column from './models/Column';

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
}