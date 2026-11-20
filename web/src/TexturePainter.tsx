import { useEffect, useRef, useState } from "react";
import { Eraser, Pipette, Pencil, RotateCcw, Save } from "lucide-react";

type Props = { initialImage?: string; onSave: (dataUrl: string) => void };

const SIZE = 16;
const DEFAULT_COLOR = "#9df36a";
const PALETTE = ["#ffffff", "#c9d4e3", "#65758b", "#202b3d", "#111827", "#9df36a", "#4ca8ff", "#e85d75", "#f4c95d", "#a879e8", "#9b6545", "#2b6d4f"];

export default function TexturePainter({ initialImage, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [tool, setTool] = useState<"brush" | "eraser" | "picker">("brush");
  const [brushSize, setBrushSize] = useState(1);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!initialImage) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, SIZE, SIZE);
      setHasDrawing(true);
    };
    image.src = initialImage;
  }, [initialImage]);

  function paint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(SIZE - 1, Math.floor((event.clientX - rect.left) / rect.width * SIZE)));
    const y = Math.max(0, Math.min(SIZE - 1, Math.floor((event.clientY - rect.top) / rect.height * SIZE)));
    if (tool === "picker") {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] > 0) setColor("#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join(""));
      setTool("brush");
      return;
    }
    ctx.fillStyle = tool === "eraser" ? "rgba(0,0,0,0)" : color;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    const offset = Math.floor(brushSize / 2);
    for (let dx = 0; dx < brushSize; dx++) for (let dy = 0; dy < brushSize; dy++) {
      const px = x + dx - offset, py = y + dy - offset;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalCompositeOperation = "source-over";
    setHasDrawing(true);
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, SIZE, SIZE);
    setHasDrawing(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return <section className="texture-painter">
    <div className="texture-painter-heading"><strong>Pixel-Textur-Editor</strong><span>16 × 16 Pixel · PNG</span></div>
    <div className="texture-painter-layout">
      <div className="pixel-canvas-wrap"><canvas ref={canvasRef} width={SIZE} height={SIZE} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); paint(event); }} onPointerMove={event => { if (event.buttons === 1 && tool !== "picker") paint(event); }} aria-label="16 mal 16 Pixel Textur bearbeiten"/></div>
      <div className="texture-painter-tools">
        <label>Werkzeug</label>
        <div className="paint-tools">
          <button type="button" className={tool === "brush" ? "active" : ""} onClick={() => setTool("brush")} title="Pinsel"><Pencil size={15}/></button>
          <button type="button" className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")} title="Radierer"><Eraser size={15}/></button>
          <button type="button" className={tool === "picker" ? "active" : ""} onClick={() => setTool("picker")} title="Pipette"><Pipette size={15}/></button>
          <button type="button" onClick={clear} title="Leeren"><RotateCcw size={15}/></button>
        </div>
        <label>Farbe</label>
        <div className="paint-color"><input type="color" value={color} onChange={event => setColor(event.target.value)}/><code>{color.toUpperCase()}</code></div>
        <div className="paint-palette">{PALETTE.map(value => <button type="button" key={value} style={{ background: value }} aria-label={"Farbe " + value} onClick={() => {setColor(value);setTool("brush");}}/>)}</div>
        <label>Pinselgröße</label>
        <select value={brushSize} onChange={event => setBrushSize(Number(event.target.value))}><option value={1}>1 × 1</option><option value={2}>2 × 2</option><option value={3}>3 × 3</option><option value={4}>4 × 4</option></select>
      </div>
    </div>
    <button type="button" className="save-texture" onClick={save}><Save size={16}/> Textur übernehmen</button>
    {!hasDrawing && <p className="hint">Male direkt auf das Raster oder lade oben eine PNG-Datei und bearbeite sie hier.</p>}
  </section>;
}
