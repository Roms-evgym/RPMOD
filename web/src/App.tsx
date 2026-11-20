import { useState } from "react";
import ModelEditor from "./ModelEditor";
import { Box, FolderPlus, Link2, Package, Plus, RefreshCw, Trash2, Copy } from "lucide-react";

type CustomItem = { id: string; baseItem: string; baseItemName: string; renameTrigger: string; category: string; iconBase64?: string; modelJson?: string };
type Project = { shareCode: string; name: string; editToken: string; customItems: CustomItem[] };
const API = import.meta.env.VITE_RPMOD_API ?? "http://localhost:8787";

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("Mein Resource Pack");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Erstelle ein Projekt oder trete einem bestehenden Projekt bei.");
  const [itemId, setItemId] = useState("meine-krone");
  const [baseItem, setBaseItem] = useState("minecraft:carved_pumpkin");
  const [baseItemName, setBaseItemName] = useState("Geschnitzter Kürbis");
  const [renameTrigger, setRenameTrigger] = useState("Krone");
  const [category, setCategory] = useState("decoration");
  const [iconBase64, setIconBase64] = useState("");
  const [textureName, setTextureName] = useState("");
  const [modelJson, setModelJson] = useState("");

  async function create() {
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Projekt konnte nicht erstellt werden");
      setProject({ ...data.manifest, editToken: data.editToken });
      setMessage("Projekt erstellt. Kopiere den Edit-Token jetzt und bewahre ihn sicher auf.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "API nicht erreichbar"); }
    finally { setBusy(false); }
  }

  async function join() {
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects/" + encodeURIComponent(code.trim().toUpperCase()) + "/manifest");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Projekt nicht gefunden");
      setProject({ ...data, editToken: "" });
      setMessage("Projekt geladen. Zum Bearbeiten brauchst du den Edit-Token des Projekts.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Projekt konnte nicht geladen werden"); }
    finally { setBusy(false); }
  }

  async function addItem() {
    if (!project?.editToken) return;
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects/" + project.shareCode + "/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-rpmod-edit-token": project.editToken },
        body: JSON.stringify({ id: itemId, baseItem, baseItemName, renameTrigger, category, ...(iconBase64 ? { iconBase64 } : {}), ...(modelJson ? { modelJson } : {}) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Item konnte nicht gespeichert werden");
      setProject({ ...data, editToken: project.editToken });
      setMessage("Item wurde im Projekt gespeichert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen"); }
    finally { setBusy(false); }
  }

  async function deleteItem(id: string) {
    if (!project?.editToken) return;
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects/" + project.shareCode + "/items/" + encodeURIComponent(id), {
        method: "DELETE", headers: { "x-rpmod-edit-token": project.editToken }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Item konnte nicht gelöscht werden");
      setProject({ ...data, editToken: project.editToken });
      setMessage("Item gelöscht.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen"); }
    finally { setBusy(false); }
  }

  return <main className="shell"><header><div className="brand"><div className="logo"><Box /></div><div><strong>RPMOD</strong><span>RESOURCE PACK STUDIO</span></div></div><div className="status"><i /> API-Workspace</div></header>
    <section className="hero"><div className="eyebrow">MINECRAFT RESOURCE PACK WORKSPACE</div><h1>Deine Items.<br/><em>Dein Pack.</em></h1><p>Erstelle eigene Minecraft-Items, bearbeite Modelle im 3D-Editor und teile dein Resource Pack mit anderen.</p></section>
    <section className="workspace"><div className="panel"><div className="panel-title"><FolderPlus/><h2>Neues Projekt</h2></div><label>Projektname</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><button onClick={create} disabled={busy || !name.trim()}><Plus size={18}/> Projekt erstellen</button></div>
    <div className="panel"><div className="panel-title"><Link2/><h2>Projekt beitreten</h2></div><label>Share-Code</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="RPM-A1B2C3"/><button className="secondary" onClick={join} disabled={busy || !code.trim()}><RefreshCw size={18}/> Beitreten</button></div></section>
    {message && <p className="message">{message}</p>}
    {project && <><section className="project"><div><span className="eyebrow">AKTIVES PROJEKT</span><h2>{project.name}</h2><code>{project.shareCode}</code></div><div className="project-actions"><button onClick={()=>navigator.clipboard.writeText(project.shareCode)}><Link2 size={16}/> Code kopieren</button><a href={API + "/api/projects/" + project.shareCode + "/pack.zip"}><Package size={16}/> Pack ZIP</a></div></section>
      {project.editToken && <section className="panel token-panel"><div><span className="eyebrow">PRIVATER EDIT-TOKEN</span><p>Nur für Projekt-Admins. Nicht öffentlich teilen.</p><code>{project.editToken}</code></div><button className="secondary" onClick={()=>navigator.clipboard.writeText(project.editToken)}><Copy size={16}/> Token kopieren</button></section>}
      <section className="editor-grid"><div className="panel"><div className="panel-title"><Plus/><h2>Eigenes Item hinzufügen</h2></div><label>Interne ID</label><input value={itemId} onChange={e=>setItemId(e.target.value)} placeholder="meine-krone"/><label>Basis-Item (Minecraft-ID)</label><input value={baseItem} onChange={e=>setBaseItem(e.target.value)} placeholder="minecraft:carved_pumpkin"/><label>Name des Basis-Items</label><input value={baseItemName} onChange={e=>setBaseItemName(e.target.value)}/><label>Umbenennen auf (Amboss)</label><input value={renameTrigger} onChange={e=>setRenameTrigger(e.target.value)}/><label>PNG-Textur (optional, max. 5 MB)</label><input type="file" accept="image/png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setMessage("PNG ist zu groß (maximal 5 MB).");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>{setIconBase64(String(reader.result));setTextureName(file.name);};reader.readAsDataURL(file);}}/>{textureName && <div className="texture-preview"><img src={iconBase64} alt="Texturvorschau"/><span>{textureName}</span><button type="button" className="text-button" onClick={()=>{setIconBase64("");setTextureName("");}}>Entfernen</button></div>}<ModelEditor onModelChange={setModelJson}/><label>Kategorie</label><select value={category} onChange={e=>setCategory(e.target.value)}><option value="decoration">Dekoration</option><option value="weapon">Waffe</option><option value="tool">Werkzeug</option><option value="food">Essen</option><option value="other">Sonstiges</option></select><button onClick={addItem} disabled={busy || !project.editToken || !itemId.trim() || !renameTrigger.trim()}><Plus size={18}/> Item speichern</button>{!project.editToken && <p className="hint">Du bist dem Projekt nur als Gast beigetreten. Ein Edit-Token ist zum Speichern nötig.</p>}</div>
      <div className="panel item-list"><div className="panel-title"><Package/><h2>Projekt-Items ({project.customItems?.length ?? 0})</h2></div>{project.customItems?.length ? project.customItems.map(item=><article className="item-row" key={item.id}><div><strong>{item.renameTrigger}</strong><small>{item.baseItemName} · {item.id}</small></div>{project.editToken && <button className="icon-button" title="Item löschen" onClick={()=>deleteItem(item.id)} disabled={busy}><Trash2 size={16}/></button>}</article>) : <p className="hint">Noch keine Items gespeichert. Lege links dein erstes Item an.</p>}</div></section>
    </>}
    <footer>RPMOD <span>•</span> Frühe Entwicklungsfassung · 3D-Cuboid-Editor und ZIP-Export · Anvil-Assistent folgt</footer></main>;
}
