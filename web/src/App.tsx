import { useState } from "react";
import { Box, FolderPlus, Link2, Package, Plus, RefreshCw } from "lucide-react";

type Project = { shareCode: string; name: string; editToken: string };
const API = import.meta.env.VITE_RPMOD_API ?? "http://localhost:8787";

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("Mein Resource Pack");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Erstelle ein Projekt oder trete einem bestehenden Projekt bei.");

  async function create() {
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Projekt konnte nicht erstellt werden");
      setProject(data); setMessage("Projekt erstellt. Bewahre den Edit-Token sicher auf.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "API nicht erreichbar"); }
    finally { setBusy(false); }
  }

  async function join() {
    setBusy(true);
    try {
      const response = await fetch(API + "/api/projects/" + encodeURIComponent(code.trim().toUpperCase()) + "/manifest");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Projekt nicht gefunden");
      setProject({ shareCode: data.shareCode, name: data.name, editToken: "" }); setMessage("Projekt geladen. Bearbeitungsrechte werden später über einen Edit-Token freigeschaltet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Projekt konnte nicht geladen werden"); }
    finally { setBusy(false); }
  }

  return <main className="shell"><header><div className="brand"><div className="logo"><Box /></div><div><strong>RPMOD</strong><span>RESOURCE PACK STUDIO</span></div></div><div className="status"><i /> API-Workspace</div></header>
    <section className="hero"><div className="eyebrow">MINECRAFT RESOURCE PACK WORKSPACE</div><h1>Deine Items.<br/><em>Dein Pack.</em></h1><p>Erstelle eigene Minecraft-Items, bearbeite Modelle im 3D-Editor und teile dein Resource Pack mit anderen.</p></section>
    <section className="workspace"><div className="panel"><div className="panel-title"><FolderPlus/><h2>Neues Projekt</h2></div><label>Projektname</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><button onClick={create} disabled={busy || !name.trim()}><Plus size={18}/> Projekt erstellen</button></div>
    <div className="panel"><div className="panel-title"><Link2/><h2>Projekt beitreten</h2></div><label>Share-Code</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="RPM-A1B2C3"/><button className="secondary" onClick={join} disabled={busy || !code.trim()}><RefreshCw size={18}/> Beitreten</button></div></section>
    {message && <p className="message">{message}</p>}
    {project && <section className="project"><div><span className="eyebrow">AKTIVES PROJEKT</span><h2>{project.name}</h2><code>{project.shareCode}</code></div><div className="project-actions"><button className="secondary" onClick={()=>navigator.clipboard.writeText(project.shareCode)}><Link2 size={16}/> Code kopieren</button><a href={API + "/api/projects/" + project.shareCode + "/pack.zip"}><Package size={16}/> Pack ZIP</a></div></section>}
    <footer>RPMOD <span>•</span> Frühe Entwicklungsfassung · Modell-Editor und Anvil-Assistent folgen im nächsten Ausbau</footer></main>;
}
