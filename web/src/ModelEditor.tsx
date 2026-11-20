import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Plus, Trash2 } from "lucide-react";

export type CuboidPart = {
  id: string;
  name: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
};

type Props = { onModelChange: (json: string) => void };

const initialParts: CuboidPart[] = [
  { id: "body", name: "Hauptteil", from: [4, 3, 4], to: [12, 13, 12], color: "#9df36a" }
];

function makeModel(parts: CuboidPart[]) {
  const faces = {
    north: { uv: [0, 0, 16, 16], texture: "#0" },
    south: { uv: [0, 0, 16, 16], texture: "#0" },
    east: { uv: [0, 0, 16, 16], texture: "#0" },
    west: { uv: [0, 0, 16, 16], texture: "#0" },
    up: { uv: [0, 0, 16, 16], texture: "#0" },
    down: { uv: [0, 0, 16, 16], texture: "#0" }
  };
  return {
    parent: "minecraft:block/block",
    ambientocclusion: true,
    textures: { "0": "rpmod:item/__texture__", particle: "rpmod:item/__texture__" },
    elements: parts.map(part => ({
      name: part.name,
      from: part.from,
      to: part.to,
      faces
    })),
    display: {
      thirdperson_righthand: { rotation: [0, -90, 55], translation: [0, 4, 0], scale: [0.85, 0.85, 0.85] },
      firstperson_righthand: { rotation: [0, -90, 25], translation: [1.13, 3.2, 1.13], scale: [0.68, 0.68, 0.68] },
      gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] },
      ground: { translation: [0, 2, 0], scale: [0.25, 0.25, 0.25] },
      fixed: { rotation: [0, 180, 0], scale: [0.5, 0.5, 0.5] }
    }
  };
}

export default function ModelEditor({ onModelChange }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<CuboidPart[]>(initialParts);
  const [selectedId, setSelectedId] = useState("body");
  const selected = useMemo(() => parts.find(part => part.id === selectedId) ?? null, [parts, selectedId]);

  useEffect(() => {
    onModelChange(JSON.stringify(makeModel(parts)));
  }, [parts, onModelChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a111e");
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(25, 21, 28);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xddeaff, 0x263247, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(16, 24, 12);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9dbdff, 0.8);
    fillLight.position.set(-16, 4, -12);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(32, 16, 0x53647d, 0x263449);
    grid.position.y = -8.05;
    scene.add(grid);
    const axes = new THREE.AxesHelper(10);
    scene.add(axes);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const meshes: THREE.Mesh[] = [];
    for (const part of parts) {
      const width = Math.max(0.1, part.to[0] - part.from[0]);
      const height = Math.max(0.1, part.to[1] - part.from[1]);
      const depth = Math.max(0.1, part.to[2] - part.from[2]);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.72, metalness: 0.04 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (part.from[0] + part.to[0]) / 2 - 8,
        (part.from[1] + part.to[1]) / 2 - 8,
        (part.from[2] + part.to[2]) / 2 - 8
      );
      mesh.userData.partId = part.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: part.id === selectedId ? 0xffffff : 0x15202d })
      );
      mesh.add(edges);
      modelGroup.add(mesh);
      meshes.push(mesh);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (hit?.object instanceof THREE.Mesh) {
        const id = hit.object.userData.partId;
        if (typeof id === "string") setSelectedId(id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(220, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      controls.dispose();
      modelGroup.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [parts, selectedId]);

  function updateNumber(field: "from" | "to", axis: 0 | 1 | 2, value: number) {
    if (!selected) return;
    setParts(current => current.map(part => {
      if (part.id !== selected.id) return part;
      const next = { ...part, [field]: [...part[field]] as [number, number, number] };
      next[field][axis] = Math.max(-16, Math.min(32, value));
      if (field === "from" && next.from[axis] >= next.to[axis]) next.to[axis] = next.from[axis] + 1;
      if (field === "to" && next.to[axis] <= next.from[axis]) next.from[axis] = next.to[axis] - 1;
      return next;
    }));
  }

  function addPart() {
    const id = "cube-" + (parts.length + 1);
    setParts(current => [...current, { id, name: "Würfel " + (current.length + 1), from: [5, 5, 5], to: [11, 11, 11], color: "#9df36a" }]);
    setSelectedId(id);
  }

  function deletePart() {
    if (!selected) return;
    const remaining = parts.filter(part => part.id !== selected.id);
    setParts(remaining);
    setSelectedId(remaining[0]?.id ?? "");
  }

  return <section className="model-editor">
    <div className="model-editor-heading"><div className="panel-title"><Box/><h2>3D-Modell-Editor</h2></div><span className="model-hint">Minecraft-Modell · 16 × 16 × 16</span></div>
    <div className="model-editor-layout">
      <div className="model-viewport" ref={mountRef}><div className="viewport-help">Ziehen: drehen · Scrollen: zoomen</div></div>
      <div className="model-tools">
        <div className="model-tool-actions"><button type="button" onClick={addPart}><Plus size={15}/> Würfel</button><button type="button" className="secondary" onClick={deletePart} disabled={!selected}><Trash2 size={15}/> Löschen</button></div>
        <label>Bauteil</label>
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {parts.map(part => <option value={part.id} key={part.id}>{part.name}</option>)}
        </select>
        {selected ? <>
          <div className="model-coord-grid">
            {(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis}><label>{axis} von</label><input type="number" min={-16} max={32} value={selected.from[index]} onChange={event => updateNumber("from", index as 0 | 1 | 2, Number(event.target.value))}/></div>)}
            {(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis}><label>{axis} bis</label><input type="number" min={-16} max={32} value={selected.to[index]} onChange={event => updateNumber("to", index as 0 | 1 | 2, Number(event.target.value))}/></div>)}
          </div>
          <label>Farbe für die Editor-Vorschau</label>
          <input type="color" value={selected.color} onChange={event => setParts(current => current.map(part => part.id === selected.id ? { ...part, color: event.target.value } : part))}/>
        </> : <p className="hint">Füge einen Würfel hinzu, um das Modell zu formen.</p>}
        <p className="model-hint">Die Vorschaufarbe dient nur zur Bearbeitung. Im Spiel verwendet das Modell deine PNG-Textur.</p>
      </div>
    </div>
  </section>;
}
