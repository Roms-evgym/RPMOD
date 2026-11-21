import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Box, Plus, Trash2, Rotate3D, Smartphone, UserRound, Shield, Package, Frame, PanelsTopLeft, Pencil, Eraser, Pipette, RotateCcw } from "lucide-react";

export type CuboidPart = {
  id: string;
  name: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
};

type FaceKey = "north" | "south" | "east" | "west" | "up" | "down";
type FaceTextures = Record<string, Partial<Record<FaceKey, string>>>;
const faceNames: { key: FaceKey; label: string }[] = [{key:"north",label:"Hinten"},{key:"south",label:"Vorne"},{key:"east",label:"Rechts"},{key:"west",label:"Links"},{key:"up",label:"Oben"},{key:"down",label:"Unten"}];
type DisplayTransform = { rotation: [number, number, number]; translation: [number, number, number]; scale: [number, number, number] };
type ViewKey = "first_right" | "first_left" | "third" | "helmet" | "chestplate" | "leggings" | "boots" | "inventory" | "itemframe" | "shelf" | "ground";
type Props = { onModelChange: (json: string) => void; textureDataUrl?: string; onTextureChange: (dataUrl: string) => void };

const initialParts: CuboidPart[] = [
  { id: "body", name: "Hauptteil", from: [4, 3, 4], to: [12, 13, 12], color: "#9df36a" }
];
const defaults: Record<string, DisplayTransform> = {
  firstperson_righthand: { rotation: [0, -90, 25], translation: [1.13, 3.2, 1.13], scale: [.68, .68, .68] },
  firstperson_lefthand: { rotation: [0, 90, -25], translation: [-1.13, 3.2, 1.13], scale: [.68, .68, .68] },
  thirdperson_righthand: { rotation: [0, -90, 55], translation: [0, 4, 0], scale: [.85, .85, .85] },
  head: { rotation: [0, 180, 0], translation: [0, 13, 7], scale: [1, 1, 1] },
  gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [.625, .625, .625] },
  fixed: { rotation: [0, 180, 0], translation: [0, 0, 0], scale: [.5, .5, .5] },
  ground: { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [.25, .25, .25] }
};
const viewConfig: Record<ViewKey, { label: string; context: keyof typeof defaults; camera: [number, number, number]; target: [number, number, number] }> = {
  first_right: { label: "First Person · Rechts", context: "firstperson_righthand", camera: [15, 11, 19], target: [0, 0, 0] },
  first_left: { label: "First Person · Links", context: "firstperson_lefthand", camera: [-15, 11, 19], target: [0, 0, 0] },
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

function makeModel(parts: CuboidPart[], transforms: Record<string, DisplayTransform>, faceTextures: FaceTextures) {
  const textureMap: Record<string, string> = { "0": "rpmod:item/__texture__", particle: "rpmod:item/__texture__" };
  const elements = parts.map(part => {
    const faces = Object.fromEntries(faceNames.map(({key}) => {
      const textureKey = "part_" + part.id + "_" + key;
      textureMap[textureKey] = "rpmod:item/__face_" + part.id + "_" + key + "__";
      return [key, { uv: [0, 0, 16, 16], texture: "#" + textureKey }];
    }));
    return { from: part.from, to: part.to, faces };
  });
  return {
    parent: "minecraft:block/block",
    ambientocclusion: true,
    textures: textureMap,
    rpmodFaceTextures: faceTextures,
    elements,
    display: Object.fromEntries(Object.entries(transforms).map(([key, value]) => [key, {
      rotation: value.rotation, translation: value.translation, scale: value.scale
    }]))
  };
}

export default function ModelEditor({ onModelChange, textureDataUrl, onTextureChange }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const textureCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastEmittedTexture = useRef("");
  const liveTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const canvasPaintingRef = useRef(false);
  const canvasPaintTargetRef = useRef<{ face: FaceKey; partId?: string }>({ face: "south" });
  const [paintColor, setPaintColor] = useState("#9df36a");
  const [paintTool, setPaintTool] = useState<"brush" | "eraser" | "picker">("brush");
  const [editorMode, setEditorMode] = useState<"paint" | "model">("paint");
  const [selectedFace, setSelectedFace] = useState<FaceKey>("south");
  const [faceTextures, setFaceTextures] = useState<FaceTextures>({});
  const [parts, setParts] = useState<CuboidPart[]>(initialParts);
  const [selectedId, setSelectedId] = useState("body");
  const [view, setView] = useState<ViewKey>("first_right");
  const [transformTool, setTransformTool] = useState<"translate" | "rotate" | "scale">("translate");
  const [transforms, setTransforms] = useState<Record<string, DisplayTransform>>(() => structuredClone(defaults));
  const paintColorRef = useRef(paintColor);
  const paintToolRef = useRef(paintTool);
  const editorModeRef = useRef(editorMode);
  const transformToolRef = useRef(transformTool);
  const selected = useMemo(() => parts.find(part => part.id === selectedId) ?? null, [parts, selectedId]);
  const active = viewConfig[view];
  const transform = transforms[active.context] ?? defaults[active.context];
  paintColorRef.current = paintColor;
  paintToolRef.current = paintTool;
  editorModeRef.current = editorMode;
  transformToolRef.current = transformTool;

  useEffect(() => {
    const controls = transformControlsRef.current;
    if (!controls) return;
    controls.setMode(transformTool);
    controls.enabled = editorMode === "model";
  }, [transformTool, editorMode]);

  useEffect(() => {
    onModelChange(JSON.stringify(makeModel(parts, transforms, faceTextures)));
  }, [parts, transforms, faceTextures, onModelChange]);

  useEffect(() => {
    const canvas = textureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const source = (selected && faceTextures[selected.id]?.[selectedFace]) || textureDataUrl;
    ctx.clearRect(0, 0, 16, 16);
    if (!source) return;
    const image = new Image();
    image.onload = () => { ctx.clearRect(0, 0, 16, 16); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, 16, 16); if (liveTextureRef.current) liveTextureRef.current.needsUpdate = true; };
    image.src = source;
  }, [textureDataUrl, selectedId, selectedFace, faceTextures]);

  function paintTexture(event: React.PointerEvent<HTMLCanvasElement>, publish = false) {
    if (editorModeRef.current !== "paint") return;
    const canvas = textureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(15, Math.floor((event.clientX - rect.left) / rect.width * 16)));
    const y = Math.max(0, Math.min(15, Math.floor((event.clientY - rect.top) / rect.height * 16)));
    paintPixel(x, y, publish);
  }

  function paintPixel(x: number, y: number, publish: boolean, face: FaceKey = selectedFace, partId = selected?.id) {
    const canvas = textureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const px = Math.max(0, Math.min(15, Math.floor(x)));
    const py = Math.max(0, Math.min(15, Math.floor(y)));
    if (paintToolRef.current === "picker") {
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      if (pixel[3]) setPaintColor("#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join(""));
      setPaintTool("brush");
      return;
    }
    ctx.globalCompositeOperation = paintToolRef.current === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = paintColorRef.current;
    ctx.fillRect(px, py, 1, 1);
    ctx.globalCompositeOperation = "source-over";
    if (liveTextureRef.current) liveTextureRef.current.needsUpdate = true;
    if (publish) publishTexture(face, partId);
  }

  function publishTexture(face: FaceKey = selectedFace, partId = selected?.id) {
    const canvas = textureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    lastEmittedTexture.current = dataUrl;
    if (!partId) onTextureChange(dataUrl);
    else setFaceTextures(current => ({ ...current, [partId]: { ...(current[partId] ?? {}), [face]: dataUrl } }));
  }
  function clearTexture() {
    if (editorMode !== "paint") return;
    const canvas = textureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, 16, 16);
    const dataUrl = canvas.toDataURL("image/png");
    lastEmittedTexture.current = dataUrl;
    if (!selected) onTextureChange(dataUrl);
    else setFaceTextures(current => ({ ...current, [selected.id]: { ...(current[selected.id] ?? {}), [selectedFace]: dataUrl } }));
  }

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
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(transformToolRef.current);
    transformControls.enabled = editorModeRef.current === "model";
    transformControlsRef.current = transformControls;
    transformControls.setSpace("local");
    transformControls.attach(modelGroup);
    scene.add(transformControls.getHelper());
    const saveGizmoTransform = () => {
      if (transformControls.dragging) return;
      const r = modelGroup.rotation;
      setTransforms(current => ({ ...current, [active.context]: {
        rotation: [THREE.MathUtils.radToDeg(r.x), THREE.MathUtils.radToDeg(r.y), THREE.MathUtils.radToDeg(r.z)],
        translation: [modelGroup.position.x, modelGroup.position.y, modelGroup.position.z],
        scale: [modelGroup.scale.x, modelGroup.scale.y, modelGroup.scale.z]
      }}));
    };
    transformControls.addEventListener("mouseUp", saveGizmoTransform);
    transformControls.addEventListener("dragging-changed", event => { controls.enabled = !(event.value as boolean); });
    const meshes: THREE.Mesh[] = [];
    if (view === "third") {
      const human = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: 0xc58f68, roughness: .9 });
      const shirt = new THREE.MeshStandardMaterial({ color: 0x3976bd, roughness: .95 });
      const pants = new THREE.MeshStandardMaterial({ color: 0x34445e, roughness: .95 });
      const limb = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rotationZ = 0) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rotationZ;
        human.add(mesh);
      };
      limb(8, 8, 8, skin, 0, 5, 0);
      limb(8, 12, 4, shirt, 0, -5, 0);
      // Beide Arme waagrecht nach außen: sichtbare ausgestreckte Hände links und rechts.
      limb(4, 12, 4, shirt, -10, 0, 0, Math.PI / 2);
      limb(4, 12, 4, shirt, 10, 0, 0, -Math.PI / 2);
      limb(4, 4, 4, skin, -17, 0, 0);
      limb(4, 4, 4, skin, 17, 0, 0);
      limb(4, 12, 4, pants, -2, -17, 0);
      limb(4, 12, 4, pants, 2, -17, 0);
      human.position.set(0, 0, -9);
      scene.add(human);
    }
    if (view === "first_left" || view === "first_right") {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 9, 3.2), new THREE.MeshStandardMaterial({ color: 0xc58f68 }));
      arm.position.set(view === "first_right" ? 8 : -8, -7, 1);
      arm.rotation.z = view === "first_right" ? -.22 : .22;
      scene.add(arm);
    }
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    const makeFaceTexture = (source?: string) => {
      if (!source) return null;
      const texture = textureLoader.load(source);
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
      loadedTextures.push(texture);
      return texture;
    };
    for (const part of parts) {
      const width = Math.max(.1, part.to[0] - part.from[0]);
      const height = Math.max(.1, part.to[1] - part.from[1]);
      const depth = Math.max(.1, part.to[2] - part.from[2]);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const order: FaceKey[] = ["east", "west", "up", "down", "south", "north"];
      const materials = order.map(face => {
        const source = faceTextures[part.id]?.[face] || textureDataUrl;
        const map = makeFaceTexture(source);
        return new THREE.MeshStandardMaterial({ color: map ? 0xffffff : part.color, map, roughness: .72, metalness: .04 });
      });
      if (editorMode === "paint" && part.id === selectedId) {
        const canvas = textureCanvasRef.current;
        const material = materials[order.indexOf(selectedFace)];
        if (canvas && material) {
          const liveMap = new THREE.CanvasTexture(canvas);
          liveMap.magFilter = THREE.NearestFilter;
          liveMap.minFilter = THREE.NearestFilter;
          liveMap.colorSpace = THREE.SRGBColorSpace;
          material.map = liveMap;
          material.color.set(0xffffff);
          material.transparent = true;
          material.needsUpdate = true;
          liveTextureRef.current = liveMap;
          loadedTextures.push(liveMap);
        }
      }
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.set((part.from[0] + part.to[0]) / 2 - 8, (part.from[1] + part.to[1]) / 2 - 8, (part.from[2] + part.to[2]) / 2 - 8);
      mesh.userData.partId = part.id;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: part.id === selectedId ? 0xffffff : 0x15202d })));
      modelGroup.add(mesh); meshes.push(mesh);
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let painting3d = false;
    let paintingReady = false;
    let pointerReleased = false;
    let paintingFace: FaceKey = selectedFace;
    let paintingPartId = selectedId;
    const hitModel = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(meshes, false)[0];
    };
    const onPointerDown = (event: PointerEvent) => {
      if (editorModeRef.current !== "paint") return;
      const hit = hitModel(event);
      if (!hit || !(hit.object instanceof THREE.Mesh)) return;
      setSelectedId(String(hit.object.userData.partId ?? ""));
      if (event.button === 0 && hit.uv) {
        const faceOrder: FaceKey[] = ["east", "west", "up", "down", "south", "north"];
        const face = faceOrder[hit.face?.materialIndex ?? 4] ?? "south";
        const partId = String(hit.object.userData.partId ?? "");
        setSelectedFace(face);
        paintingFace = face;
        paintingPartId = partId;
        painting3d = true;
        paintingReady = false;
        pointerReleased = false;
        controls.enabled = false;
        const canvas = textureCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        const hitMesh = hit.object as THREE.Mesh;
        const source = faceTextures[partId]?.[face] || textureDataUrl;
        if (canvas && ctx) {
          ctx.clearRect(0, 0, 16, 16);
          const paintStart = () => {
            if (!painting3d || editorModeRef.current !== "paint") return;
            const materialIndex = hit.face?.materialIndex ?? 4;
            const targetMaterial = Array.isArray(hitMesh.material) ? hitMesh.material[materialIndex] : hitMesh.material;
            if (targetMaterial instanceof THREE.MeshStandardMaterial) {
              const liveMap = new THREE.CanvasTexture(canvas);
              liveMap.magFilter = THREE.NearestFilter;
              liveMap.minFilter = THREE.NearestFilter;
              liveMap.colorSpace = THREE.SRGBColorSpace;
              targetMaterial.map = liveMap;
              targetMaterial.color.set(0xffffff);
              targetMaterial.transparent = true;
              targetMaterial.needsUpdate = true;
              liveTextureRef.current = liveMap;
              loadedTextures.push(liveMap);
            }
            paintingReady = true;
            paintPixel(hit.uv!.x * 16, (1 - hit.uv!.y) * 16, false, face, partId);
            if (pointerReleased) { publishTexture(face, partId); painting3d = false; paintingReady = false; pointerReleased = false; }
          };
          if (source) {
            const image = new Image();
            image.onload = () => { ctx.clearRect(0, 0, 16, 16); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, 16, 16); paintStart(); };
            image.src = source;
          } else paintStart();
        }
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (editorModeRef.current !== "paint" || !painting3d || !paintingReady || paintToolRef.current === "picker") return;
      const hit = hitModel(event);
      if (hit?.uv && hit.object instanceof THREE.Mesh) { const faceOrder: FaceKey[] = ["east", "west", "up", "down", "south", "north"]; const face = faceOrder[hit.face?.materialIndex ?? 4] ?? "south"; const partId = String(hit.object.userData.partId ?? ""); if (face === paintingFace && partId === paintingPartId) paintPixel(hit.uv.x * 16, (1 - hit.uv.y) * 16, false, face, partId); }
    };
    const onPointerUp = () => {
      if (painting3d && !paintingReady) { pointerReleased = true; controls.enabled = true; return; }
      if (painting3d && paintingReady) publishTexture(paintingFace, paintingPartId);
      painting3d = false;
      paintingReady = false;
      pointerReleased = false;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    const resize = () => {
      const width = Math.max(1, mount.clientWidth), height = Math.max(220, mount.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => {
      transformControls.removeEventListener("mouseUp", saveGizmoTransform);
      transformControls.dispose();
      transformControlsRef.current = null;
      liveTextureRef.current = null;
      loadedTextures.forEach(texture => texture.dispose());
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointerDown); renderer.domElement.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerup", onPointerUp); controls.dispose();
      modelGroup.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [parts, selectedId, selectedFace, view, transform, textureDataUrl, faceTextures]);

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
    setParts(current => { const offsetX = ((current.length - 1) % 4) * 3 - 4; const offsetZ = Math.floor((current.length - 1) / 4) * 3 - 4; return [...current, { id, name: "Würfel " + (current.length + 1), from: [5 + offsetX, 5, 5 + offsetZ], to: [11 + offsetX, 11, 11 + offsetZ], color: "#9df36a" }]; });
    setSelectedId(id);
  }
  function deletePart() {
    if (!selected) return;
    const remaining = parts.filter(part => part.id !== selected.id);
    setParts(remaining); setSelectedId(remaining[0]?.id ?? "");
  }
  const viewButtons: { key: ViewKey; icon: typeof Smartphone }[] = [
    { key: "first_right", icon: Smartphone }, { key: "first_left", icon: Smartphone }, { key: "third", icon: UserRound },
    { key: "helmet", icon: Shield }, { key: "chestplate", icon: Shield }, { key: "leggings", icon: Shield }, { key: "boots", icon: Shield },
    { key: "inventory", icon: Package }, { key: "itemframe", icon: Frame }, { key: "shelf", icon: PanelsTopLeft }, { key: "ground", icon: Box }
  ];

  return <section className="model-editor">
    <div className="model-editor-heading"><div className="panel-title"><Box/><h2>Item-Studio · Textur &amp; Modell</h2></div><span className="model-hint">Gemeinsame Vorschau · 16 × 16 × 16</span></div>
    <div className="model-view-tabs">{viewButtons.map(({ key, icon: Icon }) => <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}><Icon size={14}/>{viewConfig[key].label}</button>)}</div>
    <div className="model-editor-layout">
      <aside className="model-texture-panel">
        <strong>Würfel-Textur</strong><span>{selected?.name ?? "Kein Würfel"} · 16 × 16 Pixel</span>
        <div className="model-mode-switch"><button type="button" className={editorMode === "paint" ? "active" : ""} onClick={() => setEditorMode("paint")}>Textur malen</button><button type="button" className={editorMode === "model" ? "active" : ""} onClick={() => setEditorMode("model")}>Modell bearbeiten</button></div>
        <label>Seite auswählen</label><select className="face-select" value={selectedFace} onChange={event => setSelectedFace(event.target.value as FaceKey)}>{faceNames.map(face => <option key={face.key} value={face.key}>{face.label}</option>)}</select>
        <div className="model-texture-tools">
          <button type="button" className={paintTool === "brush" ? "active" : ""} title="Stift" onClick={() => { setEditorMode("paint"); setPaintTool("brush"); }}><Pencil size={16}/></button>
          <button type="button" className={paintTool === "eraser" ? "active" : ""} title="Radierer" onClick={() => { setEditorMode("paint"); setPaintTool("eraser"); }}><Eraser size={16}/></button>
          <button type="button" className={paintTool === "picker" ? "active" : ""} title="Pipette" onClick={() => { setEditorMode("paint"); setPaintTool("picker"); }}><Pipette size={16}/></button>
          <button type="button" title="Textur leeren" onClick={() => { setEditorMode("paint"); clearTexture(); }}><RotateCcw size={16}/></button>
        </div>
        <div className="model-texture-canvas-wrap">
          <canvas ref={textureCanvasRef} width={16} height={16}
            onPointerDown={event => { if (editorMode !== "paint") return; event.currentTarget.setPointerCapture(event.pointerId); if (paintTool === "picker") { paintTexture(event); return; } canvasPaintingRef.current = true; canvasPaintTargetRef.current = { face: selectedFace, partId: selected?.id }; paintTexture(event); }}
            onPointerMove={event => { if (editorMode === "paint" && canvasPaintingRef.current && event.buttons === 1 && paintTool !== "picker") paintTexture(event); }}
            onPointerUp={() => { if (!canvasPaintingRef.current) return; canvasPaintingRef.current = false; publishTexture(canvasPaintTargetRef.current.face, canvasPaintTargetRef.current.partId); }}
            onPointerCancel={() => { if (!canvasPaintingRef.current) return; canvasPaintingRef.current = false; publishTexture(canvasPaintTargetRef.current.face, canvasPaintTargetRef.current.partId); }}
            aria-label="Item-Textur bearbeiten"/>
        </div>
        <label>Stiftfarbe</label>
        <input className="model-paint-color" type="color" value={paintColor} onChange={event => setPaintColor(event.target.value)}/>
      </aside>
      <div className="model-viewport" ref={mountRef}><div className="viewport-help">Würfel auswählen · Stift wählen und auf gewünschter Seite malen · Ziehen: drehen · Scrollen: zoomen · {active.label}</div></div>
      <div className="model-tools">
        <div className="model-tool-actions"><button type="button" onClick={addPart}><Plus size={15}/> 3D-Würfel erstellen</button><button type="button" className="secondary" onClick={deletePart} disabled={!selected}><Trash2 size={15}/> Löschen</button></div>
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
          <div className="transform-title"><Rotate3D size={14}/> 3D-Werkzeuge · {active.label}</div>
          <div className="model-tool-actions transform-gizmo-tools">
            <button type="button" className={editorMode === "model" && transformTool === "translate" ? "" : "secondary"} onClick={() => { setEditorMode("model"); setTransformTool("translate"); }}>Verschieben</button>
            <button type="button" className={editorMode === "model" && transformTool === "rotate" ? "" : "secondary"} onClick={() => { setEditorMode("model"); setTransformTool("rotate"); }}>Drehen</button>
            <button type="button" className={editorMode === "model" && transformTool === "scale" ? "" : "secondary"} onClick={() => { setEditorMode("model"); setTransformTool("scale"); }}>Skalieren</button>
          </div>
          <p className="model-hint">{editorMode === "model" ? "Modellmodus aktiv: Texturzeichnen ist gesperrt. Ziehe die farbigen Achsen am 3D-Modell." : "Texturmodus aktiv: Modell-Werkzeuge sind gesperrt. Wähle Stift, Radierer oder Pipette."} Die Werte werden direkt übernommen.</p>
          <div className="transform-title"><Rotate3D size={14}/> Feineinstellung</div>
          {(["rotation", "translation", "scale"] as const).map(field => <div className="transform-row" key={field}>
            <span>{field === "rotation" ? "Drehung °" : field === "translation" ? "Position" : "Skalierung"}</span>
            {(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis}>{axis}<input type="number" step={field === "scale" ? .05 : .1} value={transform[field][index]} onChange={event => updateTransform(field, index as 0 | 1 | 2, Number(event.target.value))}/></label>)}
          </div>)}
        </div>
        <p className="model-hint">First Person links/rechts und Third Person mit Spieler-Mannequin, die vier Rüstungsteil-Vorschauen, Inventar-GUI und Item-Frame verwenden die passenden Editor-Ansichten. Die Rüstungsteil-Vorschauen markieren Helm, Brustplatte, Beinschutz und Stiefel am Mannequin; Minecraft-Rüstungsmodelle benötigen zusätzlich eigene Armor-Modelle und Texturen. Die Regalvorschau nutzt die GUI-Darstellung; die tatsächliche Regal-Inszenierung hängt vom Minecraft-Renderer ab.</p>
      </div>
    </div>
  </section>;
}
