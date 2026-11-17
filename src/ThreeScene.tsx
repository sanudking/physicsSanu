import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LabId, PhysicsValues } from './physics';

type Props = {
  lab: LabId;
  values: PhysicsValues;
  running: boolean;
  resetKey: number;
  onPause: () => void;
};

type SimState = {
  theta: number;
  omega: number;
  rampDistance: number;
  rampSpeed: number;
  rampAngle: number;
  beamAngle: number;
  x1: number;
  x2: number;
  v1: number;
  v2: number;
  collided: boolean;
};

type SceneObjects = {
  pendulumBob?: THREE.Mesh;
  pendulumRod?: THREE.Line;
  ramp?: THREE.Mesh;
  rampBall?: THREE.Mesh;
  beam?: THREE.Mesh;
  leftWeight?: THREE.Mesh;
  rightWeight?: THREE.Mesh;
  leftThread?: THREE.Line;
  rightThread?: THREE.Line;
  ball1?: THREE.Mesh;
  ball2?: THREE.Mesh;
};

const makeMaterial = (color: number, roughness = 0.72) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });

const addBox = (
  scene: THREE.Scene,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), makeMaterial(color));
  mesh.position.set(...position);
  scene.add(mesh);
  return mesh;
};

const addSphere = (scene: THREE.Scene, radius: number, color: number) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 36, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.04 }),
  );
  scene.add(mesh);
  return mesh;
};

const addLine = (scene: THREE.Scene, points: THREE.Vector3[], color: number, width = 1) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, linewidth: width }));
  scene.add(line);
  return line;
};

const updateLine = (line: THREE.Line | undefined, start: THREE.Vector3, end: THREE.Vector3) => {
  if (!line) return;
  const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
  attribute.setXYZ(0, start.x, start.y, start.z);
  attribute.setXYZ(1, end.x, end.y, end.z);
  attribute.needsUpdate = true;
  line.geometry.computeBoundingSphere();
};

const localPoint = (x: number, y: number, angle: number, centerY: number) =>
  new THREE.Vector3(
    x * Math.cos(angle) - y * Math.sin(angle),
    centerY + x * Math.sin(angle) + y * Math.cos(angle),
    0,
  );

const initialSim = (values: PhysicsValues): SimState => ({
  theta: (values.pendulumAngle * Math.PI) / 180,
  omega: 0,
  rampDistance: 0,
  rampSpeed: 0,
  rampAngle: values.rampAngle,
  beamAngle: 0,
  x1: -2.55,
  x2: 0.65,
  v1: 0,
  v2: 0,
  collided: false,
});

export default function ThreeScene({ lab, values, running, resetKey, onPause }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ values, running, resetKey, onPause });
  latest.current = { values, running, resetKey, onPause };

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f3f5);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 4.3, 11.8);
    camera.lookAt(0, 0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb6c0c8, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-4, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const floor = addBox(scene, [14, 0.14, 7], [0, -2.4, 0], 0xe0e5e9);
    floor.receiveShadow = true;
    const grid = new THREE.GridHelper(14, 28, 0xb6c0c8, 0xd2d9de);
    grid.position.set(0, -2.315, 0);
    scene.add(grid);

    const objects: SceneObjects = {};
    const sim = initialSim(latest.current.values);
    let lastResetKey = latest.current.resetKey;
    let lastPendulumAngle = latest.current.values.pendulumAngle;
    let lastRampAngle = latest.current.values.rampAngle;
    let dragging = false;
    let disposed = false;

    const anchorY = 2.45;
    const pendulumLength = () => 1.45 + ((latest.current.values.length - 0.5) / 2) * 1.25;
    const bobPosition = () => {
      const length = pendulumLength();
      return new THREE.Vector3(
        length * Math.sin(sim.theta),
        anchorY - length * Math.cos(sim.theta),
        0,
      );
    };

    if (lab === 'pendulum') {
      addBox(scene, [0.16, 4.2, 0.18], [0, 0.25, -0.35], 0x64748b);
      addBox(scene, [3.1, 0.16, 0.2], [0, anchorY, -0.35], 0x64748b);
      addSphere(scene, 0.13, 0x475569).position.set(0, anchorY, 0);
      objects.pendulumRod = addLine(
        scene,
        [new THREE.Vector3(0, anchorY, 0), bobPosition()],
        0x334155,
        2,
      );
      objects.pendulumBob = addSphere(scene, 0.28, 0x2674b8);
      objects.pendulumBob.castShadow = true;
      objects.pendulumBob.position.copy(bobPosition());
    }

    if (lab === 'ramp') {
      const initialRampAngle = (latest.current.values.rampAngle * Math.PI) / 180;
      const initialRampCenterY = -2.3 + 2.8 * Math.sin(initialRampAngle) + 0.12;
      objects.ramp = addBox(scene, [5.6, 0.2, 0.9], [0, initialRampCenterY, 0], 0x64748b);
      objects.rampBall = addSphere(scene, 0.27, 0xe28a32);
      objects.rampBall.castShadow = true;
      const angle = (latest.current.values.rampAngle * Math.PI) / 180;
      objects.ramp.rotation.z = angle;
      objects.rampBall.position.copy(localPoint(2.48, 0.32, angle, initialRampCenterY));
      addBox(scene, [0.16, 0.7, 0.9], [-2.65, -1.45, 0], 0x94a3b8);
    }

    if (lab === 'torque') {
      const pivot = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.72, 4), makeMaterial(0x64748b));
      pivot.position.set(0, -0.18, 0);
      pivot.rotation.y = Math.PI / 4;
      scene.add(pivot);
      addBox(scene, [1.7, 0.13, 0.55], [0, -0.83, 0], 0x94a3b8);
      objects.beam = addBox(scene, [5.8, 0.17, 0.42], [0, 0.18, 0], 0x2563a6);
      objects.leftWeight = addBox(scene, [0.62, 0.62, 0.62], [-1.5, -0.5, 0], 0xe28a32);
      objects.rightWeight = addBox(scene, [0.62, 0.62, 0.62], [1.5, -0.5, 0], 0x16a085);
      objects.leftThread = addLine(scene, [new THREE.Vector3(-1.5, 0.18, 0), new THREE.Vector3(-1.5, -0.2, 0)], 0x475569);
      objects.rightThread = addLine(scene, [new THREE.Vector3(1.5, 0.18, 0), new THREE.Vector3(1.5, -0.2, 0)], 0x475569);
    }

    if (lab === 'collision') {
      addBox(scene, [8.4, 0.18, 1.2], [0, -1.0, 0], 0x64748b);
      addBox(scene, [0.12, 0.5, 1.2], [-4.15, -0.67, 0], 0x94a3b8);
      addBox(scene, [0.12, 0.5, 1.2], [4.15, -0.67, 0], 0x94a3b8);
      objects.ball1 = addSphere(scene, 0.4, 0x2674b8);
      objects.ball2 = addSphere(scene, 0.4, 0xe28a32);
      objects.ball1.castShadow = true;
      objects.ball2.castShadow = true;
      objects.ball1.position.set(sim.x1, -0.38, 0);
      objects.ball2.position.set(sim.x2, -0.38, 0);
      addLine(scene, [new THREE.Vector3(-3.6, -0.88, 0.7), new THREE.Vector3(3.6, -0.88, 0.7)], 0x94a3b8);
    }

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hitPoint = new THREE.Vector3();

    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (lab !== 'pendulum' || !objects.pendulumBob) return;
      updatePointer(event);
      if (raycaster.intersectObject(objects.pendulumBob).length > 0) {
        dragging = true;
        renderer.domElement.setPointerCapture(event.pointerId);
        renderer.domElement.style.cursor = 'grabbing';
        latest.current.onPause();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        if (lab === 'pendulum' && objects.pendulumBob) {
          updatePointer(event);
          renderer.domElement.style.cursor = raycaster.intersectObject(objects.pendulumBob).length ? 'grab' : 'default';
        }
        return;
      }
      updatePointer(event);
      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
        sim.theta = Math.max(-1.2, Math.min(1.2, Math.atan2(hitPoint.x, anchorY - hitPoint.y)));
        sim.omega = 0;
      }
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = 'default';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.03);
      const current = latest.current;
      const v = current.values;

      if (current.resetKey !== lastResetKey) {
        Object.assign(sim, initialSim(v));
        lastResetKey = current.resetKey;
      }

      if (lab === 'pendulum') {
        if (v.pendulumAngle !== lastPendulumAngle && !current.running && !dragging) {
          sim.theta = (v.pendulumAngle * Math.PI) / 180;
          sim.omega = 0;
          lastPendulumAngle = v.pendulumAngle;
        }
        const length = pendulumLength();
        if (current.running && !dragging) {
          const substeps = 3;
          const step = dt / substeps;
          for (let i = 0; i < substeps; i += 1) {
            sim.omega += (-v.gravity / length) * Math.sin(sim.theta) * step;
            sim.omega *= 0.9995;
            sim.theta += sim.omega * step;
          }
        }
        const bob = bobPosition();
        objects.pendulumBob?.position.copy(bob);
        updateLine(objects.pendulumRod, new THREE.Vector3(0, anchorY, 0), bob);
      }

      if (lab === 'ramp') {
        if (v.rampAngle !== lastRampAngle) {
          sim.rampDistance = 0;
          sim.rampSpeed = 0;
          sim.rampAngle = v.rampAngle;
          lastRampAngle = v.rampAngle;
        }
        const angle = (v.rampAngle * Math.PI) / 180;
        const rampCenterY = -2.3 + 2.8 * Math.sin(angle) + 0.12;
        if (objects.ramp) {
          objects.ramp.rotation.z = angle;
          objects.ramp.position.y = rampCenterY;
        }
        if (current.running) {
          const a = Math.max(0, v.gravity * (Math.sin(angle) - v.friction * Math.cos(angle)));
          sim.rampDistance = Math.min(4.9, sim.rampDistance + sim.rampSpeed * dt + 0.5 * a * dt * dt);
          sim.rampSpeed += a * dt;
        }
        objects.rampBall?.position.copy(localPoint(2.48 - sim.rampDistance, 0.34, angle, rampCenterY));
      }

      if (lab === 'torque') {
        const torqueDifference = (v.rightMass - v.leftMass) * v.gravity * v.armLength;
        const targetAngle = Math.max(-0.28, Math.min(0.28, -torqueDifference * 0.018));
        sim.beamAngle += (targetAngle - sim.beamAngle) * Math.min(1, dt * 7);
        if (objects.beam) objects.beam.rotation.z = sim.beamAngle;
        const halfDistance = Math.max(0.6, Math.min(2.45, v.armLength));
        const leftTop = localPoint(-halfDistance, -0.1, sim.beamAngle, 0.18);
        const rightTop = localPoint(halfDistance, -0.1, sim.beamAngle, 0.18);
        const leftBottom = localPoint(-halfDistance, -0.7, sim.beamAngle, 0.18);
        const rightBottom = localPoint(halfDistance, -0.7, sim.beamAngle, 0.18);
        if (objects.leftWeight) {
          objects.leftWeight.position.copy(leftBottom);
          objects.leftWeight.scale.setScalar(v.leftMass === 0 ? 0.001 : 0.65 + v.leftMass * 0.08);
          objects.leftWeight.visible = v.leftMass > 0.01;
        }
        if (objects.rightWeight) {
          objects.rightWeight.position.copy(rightBottom);
          objects.rightWeight.scale.setScalar(v.rightMass === 0 ? 0.001 : 0.65 + v.rightMass * 0.08);
          objects.rightWeight.visible = v.rightMass > 0.01;
        }
        updateLine(objects.leftThread, leftTop, leftBottom);
        updateLine(objects.rightThread, rightTop, rightBottom);
      }

      if (lab === 'collision') {
        if (current.running) {
          const g = v.gravity;
          if (!sim.collided && sim.v1 === 0) sim.v1 = Math.sqrt(2 * g * v.dropHeight) * 0.62;
          sim.x1 += sim.v1 * dt;
          sim.x2 += sim.v2 * dt;
          if (!sim.collided && sim.x2 - sim.x1 <= 0.8) {
            const u1 = sim.v1;
            const u2 = sim.v2;
            sim.v1 = ((1 - v.restitution) * u1 + (1 + v.restitution) * u2) / 2;
            sim.v2 = ((1 + v.restitution) * u1 + (1 - v.restitution) * u2) / 2;
            sim.collided = true;
          }
          if (sim.x1 > 4.4 || sim.x2 > 4.4) current.onPause();
        }
        objects.ball1?.position.set(sim.x1, -0.38, 0);
        objects.ball2?.position.set(sim.x2, -0.38, 0);
      }

      renderer.render(scene, camera);
    };
    const animationId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, [lab]);

  return <div className="three-scene" ref={mountRef} aria-label={`${lab} 3D simulation`} />;
}
