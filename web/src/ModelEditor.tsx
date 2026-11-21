import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Plus, Trash2, Rotate3D, Smartphone, UserRound, Shield, Package, Frame, PanelsTopLeft } from "lucide-react";

export type CuboidPart = {
  id: string;
  name: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
};

type DisplayTransform = { rotation: [number, number, number]; translation: [number, number, number]; scale: [number, number, number] };
type ViewKey = "first" | "third" | "helmet" | "chestplate" | "leggings" | "boots" | "inventory" | "itemframe" | "shelf" | "ground";
type Props = { onModelChange: (json: string) => void; textureDataUrl?: string };

const initialParts: CuboidPart[] = [
  { id: "body", name: "Hauptteil", from: [4, 3, 4], to: [12, 13, 12], color: "#9df36a" }
];
const defaults: Record<string, DisplayTransform> = {
  firstperson_righthand: { rotation: [0, -90, 25], translation: [1.13, 3.2, 1.13], scale: [.68, .68, .68] },
  thirdperson_righthand: { rotation: [0, -90, 55], translation: [0, 4, 0], scale: [.85, .85, .85] },
  head: { rotation: [0, 180, 0], translation: [0, 13, 7], scale: [1, 1, 1] },
  gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [.625, .625, .625] },
  fixed: { rotation: [0, 180, 0], translation: [0, 0, 0], scale: [.5, .5, .5] },
  ground: { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [.25, .25, .25] }
};
const viewConfig: Record<ViewKey, { label: string; context: keyof typeof defaults; camera: [number, number, number]; target: [number, number, number] }> = {
  first: { label: "First Person", context: "firstperson_righthand", camera: [15, 11, 19], target: [0, 0, 0] },
  third: { label: "Third Person", context: "thirdperson_righthand", camera: [19, 13, 23], target: [0, 0, 0] },
  helmet: { label: "Helm", context: "head", camera: [0, 5, 27], target: [0, 0, 0] },
  chestplate: { label: "Brustplatte", context: "head", camera: [0, 5, 27], target: [0, 0, 0] },
  leggings: { label: "Beinschutz", context: "head", camera: [0, 5, 27], target: [0, 0, 0] },
  boots: { label: "Stiefel", context: "head", camera: [0, 5, 27], target: [0, 0, 0] },
  inventory: { label: "Inventar", context: "gui", camera: [18, 16, 22], target: [0, 0, 0] },
  itemframe: { label: "Item Frame", context: "fixed", camera: [0, 0, 28], target: [0, 0, 0] },
  shelf: { label: "Regal", context: "gui", camera: [18, 14, 23], target: [0, 0, 0] },
  ground: { label: "Auf dem Boden", context: "ground", camera: [17, 5, 20], target: [0, -1, 0] }
};

function makeModel(parts: CuboidPart[], transforms: Record<string, DisplayTransform>) {
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
    elements: parts.map(part => ({ from: part.from, to: part.to, faces })),
    display: Object.fromEntries(Object.entries(transforms).map(([key, value]) => [key, {
      rotation: value.rotation, translation: value.translation, scale: value.scale
    }]))
  };
}

export default function ModelEditor({ onModelChange, textureDataUrl }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<CuboidPart[]>(initialParts);
  const [selectedId, setSelectedId] = useState("body");
  const [view, setView] = useState<ViewKey>("first");
  const [transforms, setTransforms] = useState<Record<string, DisplayTransform>>(() => structuredClone(defaults));
  const selected = useMemo(() => parts.find(part => part.id === selectedId) ?? null, [parts, selectedId]);
  const active = viewConfig[view];
  const transform = transforms[active.context] ?? defaults[active.context];

  useEffect(() => {
    onModelChange(JSON.stringify(makeModel(parts, transforms)));
  }, [parts, transforms, onModelChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a111e");
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
    camera.position.set(...active.camera);
    camera.lookAt(...active.target);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.target.set(...active.target);
    scene.add(new THREE.HemisphereLight(0xddeaff, 0x263247, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(16, 24, 12);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9dbdff, .8);
    fillLight.position.set(-16, 4, -12);
    scene.add(fillLight);
    const grid = new THREE.GridHelper(32, 16, 0x53647d, 0x263449);
    grid.position.y = view === "ground" ? -2.05 : -8.05;
    scene.add(grid);
    if (view === "itemframe") {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(19, 19, 1), new THREE.MeshStandardMaterial({ color: 0x80552f, roughness: .9 }));
      frame.position.z = -3.2;
      scene.add(frame);
    }
    if (view === "shelf") {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(25, 1.1, 9), new THREE.MeshStandardMaterial({ color: 0x80552f, roughness: .85 }));
      shelf.position.set(0, -7, -1.5);
      scene.add(shelf);
    }
    if (view === "helmet" || view === "chestplate" || view === "leggings" || view === "boots") {
      const ghost = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x73839a, transparent: true, opacity: .22 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 4), mat); torso.position.y = -9;
      const head = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), mat); head.position.y = 1;
      ghost.add(torso, head); ghost.position.z = -7; scene.add(ghost);
    }
    const modelGroup = new THREE.Group();
    const t = transform;
    modelGroup.rotation.set(THREE.MathUtils.degToRad(t.rotation[0]), THREE.MathUtils.degToRad(t.rotation[1]), THREE.MathUtils.degToRad(t.rotation[2]));
    modelGroup.position.set(t.translation[0], t.translation[1], t.translation[2]);
    modelGroup.scale.set(...t.scale);
    scene.add(modelGroup);
    const meshes: THREE.Mesh[] = [];
    const itemTexture = textureDataUrl ? new THREE.TextureLoader().load(textureDataUrl) : null;
    if (itemTexture) { itemTexture.magFilter = THREE.NearestFilter; itemTexture.minFilter = THREE.NearestFilter; itemTexture.colorSpace = THREE.SRGBColorSpace; }
    for (const part of parts) {
      const width = Math.max(.1, part.to[0] - part.from[0]);
      const height = Math.max(.1, part.to[1] - part.from[1]);
      const depth = Math.max(.1, part.to[2] - part.from[2]);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshStandardMaterial({ color: itemTexture ? 0xffffff : part.color, map: itemTexture, roughness: .72, metalness: .04 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((part.from[0] + part.to[0]) / 2 - 8, (part.from[1] + part.to[1]) / 2 - 8, (part.from[2] + part.to[2]) / 2 - 8);
      mesh.userData.partId = part.id;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: part.id === selectedId ? 0xffffff : 0x15202d })));
      modelGroup.add(mesh); meshes.push(mesh);
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (hit?.object instanceof THREE.Mesh && typeof hit.object.userData.partId === "string") setSelectedId(hit.object.userData.partId);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    const resize = () => {
      const width = Math.max(1, mount.clientWidth), height = Math.max(220, mount.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => {
      itemTexture?.dispose();
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointerDown); controls.dispose();
      modelGroup.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [parts, selectedId, view, transform, textureDataUrl]);

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
  function updateTransform(field: keyof DisplayTransform, axis: 0 | 1 | 2, value: number) {
    setTransforms(current => {
      const key = active.context;
      const base = current[key] ?? structuredClone(defaults[key]);
      const next = { ...base, [field]: [...base[field]] as [number, number, number] };
      next[field][axis] = field === "scale" ? Math.max(.01, Math.min(4, value)) : Math.max(-180, Math.min(180, value));
      return { ...current, [key]: next };
    });
  }
  function addPart() {
    const id = "cube-" + crypto.randomUUID().slice(0, 8);
    setParts(current => [...current, { id, name: "Würfel " + (current.length + 1), from: [5, 5, 5], to: [11, 11, 11], color: "#9df36a" }]);
    setSelectedId(id);
  }
  function deletePart() {
    if (!selected) return;
    const remaining = parts.filter(part => part.id !== selected.id);
    setParts(remaining); setSelectedId(remaining[0]?.id ?? "");
  }
  const viewButtons: { key: ViewKey; icon: typeof Smartphone }[] = [
    { key: "first", icon: Smartphone }, { key: "third", icon: UserRound },
    { key: "helmet", icon: Shield }, { key: "chestplate", icon: Shield }, { key: "leggings", icon: Shield }, { key: "boots", icon: Shield },
    { key: "inventory", icon: Package }, { key: "itemframe", icon: Frame }, { key: "shelf", icon: PanelsTopLeft }, { key: "ground", icon: Box }
  ];

  return <section className="model-editor">
    <div className="model-editor-heading"><div className="panel-title"><Box/><h2>Item-Studio · Textur &amp; Modell</h2></div><span className="model-hint">Gemeinsame Vorschau · 16 × 16 × 16</span></div>
    <div className="model-view-tabs">{viewButtons.map(({ key, icon: Icon }) => <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}><Icon size={14}/>{viewConfig[key].label}</button>)}</div>
    <div className="model-editor-layout">
      <div className="model-viewport" ref={mountRef}><div className="viewport-help">Ziehen: drehen · Scrollen: zoomen · Ansicht: {active.label}</div></div>
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
        <div className="display-transform-editor">
          <div className="transform-title"><Rotate3D size={14}/> Anzeige-Transformation · {active.label}</div>
          {(["rotation", "translation", "scale"] as const).map(field => <div className="transform-row" key={field}>
            <span>{field === "rotation" ? "Drehung °" : field === "translation" ? "Position" : "Skalierung"}</span>
            {(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis}>{axis}<input type="number" step={field === "scale" ? .05 : .1} value={transform[field][index]} onChange={event => updateTransform(field, index as 0 | 1 | 2, Number(event.target.value))}/></label>)}
          </div>)}
        </div>
        <p className="model-hint">First/Third Person, die vier Rüstungsteil-Vorschauen, Inventar-GUI und Item-Frame verwenden die passenden Editor-Ansichten. Die Rüstungsteil-Vorschauen markieren Helm, Brustplatte, Beinschutz und Stiefel am Mannequin; Minecraft-Rüstungsmodelle benötigen zusätzlich eigene Armor-Modelle und Texturen. Die Regalvorschau nutzt die GUI-Darstellung; die tatsächliche Regal-Inszenierung hängt vom Minecraft-Renderer ab.</p>
      </div>
    </div>
  </section>;
}
