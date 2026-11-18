"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Award, BriefcaseBusiness, ContactRound, FolderKanban, GraduationCap, Sparkles, Wrench } from "lucide-react";
import type { Education, Experience, ResumeData, ResumeSection } from "@/lib/resume";
import { diallingRegions, emptyEducation, emptyExperience, getNationalPhoneNumber, getPhoneCountryCode, getResumeLocation, getResumePhone, initialResume, locationRegions } from "@/lib/resume";
import type { ImportedResume } from "@/lib/resume-import";
import { ReasoningTrace } from "@/components/ai/reasoning-trace";
import { ThemeToggle } from "@/components/theme-toggle";
import { DataExportButton } from "@/components/data-export-button";
import SparklesIcon from "@/components/ui/sparkles-icon";
import UploadIcon from "@/components/ui/upload-icon";
import DownloadIcon from "@/components/ui/download-icon";
import HistoryCircleIcon from "@/components/ui/history-circle-icon";
import LinkIcon from "@/components/ui/link-icon";
import FileDescriptionIcon from "@/components/ui/file-description-icon";
import CheckedIcon from "@/components/ui/checked-icon";

type Section = "contact" | ResumeSection | "tailor" | "import" | "versions";
type Suggestion = { text: string; reason: string; evidence: string[] };
const sectionNames: Record<Section, string> = { contact: "Contact", summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", projects: "Projects", extras: "Certifications & languages", tailor: "Job tailoring", import: "Import a resume", versions: "Versions" };
const sectionIcons: Record<Section, ReactNode> = {
  contact: <ContactRound size={16} strokeWidth={1.8} />,
  summary: <FileDescriptionIcon size={16} />,
  experience: <BriefcaseBusiness size={16} strokeWidth={1.8} />,
  education: <GraduationCap size={16} strokeWidth={1.8} />,
  skills: <Wrench size={16} strokeWidth={1.8} />,
  projects: <FolderKanban size={16} strokeWidth={1.8} />,
  extras: <Award size={16} strokeWidth={1.8} />,
  tailor: <Sparkles size={16} strokeWidth={1.8} />,
  import: <UploadIcon size={16} />,
  versions: <HistoryCircleIcon size={16} />,
};
const resumeSections: ResumeSection[] = ["summary", "experience", "education", "skills", "projects", "extras"];
const storageKey = "forme-resume-v1";

export default function Home() {
  const [resume, setResume] = useState<ResumeData>(initialResume);
  const [isExample, setIsExample] = useState(true);
  const [resumeList, setResumeList] = useState<ResumeData[]>([]);
  const [lastEdited, setLastEdited] = useState<Record<string, string>>({});
  const [showDashboard, setShowDashboard] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [active, setActive] = useState<Section>("contact");
  const [saved, setSaved] = useState(true);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "synced" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"ai" | "versions" | "tailor" | "account" | "share" | "plans" | null>(null);
  const [aiKind, setAiKind] = useState<"bullet" | "summary" | "tailor" | "cover-letter">("bullet");
  const [aiSource, setAiSource] = useState("");
  const [aiJobDescription, setAiJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [aiTarget, setAiTarget] = useState<{ experience: number; bullet: number } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDurationMs, setAiDurationMs] = useState(0);
  const [consent, setConsent] = useState(false);
  const [versions, setVersions] = useState<{ label: string; date: string; data: ResumeData }[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ filename: string; text: string; data: ImportedResume } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountSession, setAccountSession] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedSection = useRef<ResumeSection | null>(null);
  const draggedExperience = useRef<number | null>(null);
  const draggedEducation = useRef<number | null>(null);
  const draggedProject = useRef<number | null>(null);
  const orderedSections: Array<"contact" | ResumeSection> = ["contact", ...normalizeSectionOrder(resume.sectionOrder)];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const parsed = JSON.parse(raw); const restored=normalizeResume(parsed.resume); setResume(restored); setResumeList((parsed.resumes ?? []).map(normalizeResume).filter((item:ResumeData) => item.id !== restored.id)); setLastEdited(parsed.lastEdited ?? {}); setVersions(parsed.versions ?? []); setCoverLetter(parsed.coverLetter ?? ""); setIsExample(parsed.isExample ?? restored.id === "resume-1"); }
    } catch { /* retain the starter resume if browser storage is unavailable */ }
    void fetch("/api/auth/session").then((r) => r.json()).then(async (data) => { if (data?.user) { setAccountSession(true); const response = await fetch("/api/resumes"); if (response.ok) { const savedResumes = await response.json(); const mapped = savedResumes.map((item: { id:string; title:string; data:ResumeData; updatedAt?:string }) => normalizeResume({ ...item.data, id:item.id, title:item.title })); if (mapped.length) { setIsExample(Boolean(mapped[0].isExample)); setResume(mapped[0]); setResumeList(mapped.slice(1)); const history=await fetch(`/api/resumes/${mapped[0].id}/versions`); if(history.ok){const rows=await history.json();setVersions(rows.map((item:{id:string;label:string|null;createdAt:string;data:ResumeData})=>({label:item.label??"Saved version",date:item.createdAt,data:item.data})));} } } } }).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLastEdited((current) => ({ ...current, [resume.id]: new Date().toISOString() }));
  }, [resume]);

  useEffect(() => {
    if (modal !== "ai") return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=document.getElementById("ai-dialog");
    const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')??[]);
    focusable()[0]?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setModal(null);return}
      if(event.key!=="Tab")return;
      const items=focusable();
      if(!items.length){event.preventDefault();return}
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus()}
      else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}
    };
    dialog?.addEventListener("keydown",onKeyDown);
    return()=>{dialog?.removeEventListener("keydown",onKeyDown);previous?.focus()};
  }, [modal]);

  useEffect(() => {
    setSaved(false);
    const timeout = setTimeout(() => {
      const collection = [resume, ...resumeList.filter((item) => item.id !== resume.id)];
      try { localStorage.setItem(storageKey, JSON.stringify({ resume, resumes:collection, versions, coverLetter, isExample, lastEdited })); setSaved(true); } catch { setSaved(false); }
      if (accountSession) { setSyncState("saving"); void fetch("/api/resumes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: resume.id.startsWith("c") ? resume.id : undefined, title: resume.title, data: resume }) }).then((response) => response.ok ? response.json() : null).then((result) => { if (!result) { setSyncState("error"); return; } setSyncState("synced"); if (result?.id && result.id !== resume.id) { setResume((current) => current.id === resume.id ? { ...current, id: result.id } : current); setResumeList((current) => current.map((item) => item.id === resume.id ? { ...item, id:result.id } : item)); } }).catch(() => setSyncState("error")); }
    }, 650);
    return () => clearTimeout(timeout);
  }, [resume, resumeList, versions, coverLetter, isExample, accountSession, lastEdited]);

  const update = useCallback(<K extends keyof ResumeData>(key: K, value: ResumeData[K]) => setResume((current) => ({ ...current, [key]: value })), []);
  const showToast = (message: string) => { setNotice(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setNotice(""), 2700); };
  useEffect(() => { const params = new URLSearchParams(window.location.search); const status = params.get("billing"); if (status) { showToast(status === "success" ? "Payment confirmed. Your Forme features are active." : status === "pending" ? "Payment is still processing. Your access will update when confirmed." : status === "signin" ? "Sign in again to finish checking your payment." : "Payment was not confirmed. No paid features were added."); params.delete("billing"); const query = params.toString(); window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`); } }, []);
  const openAi = (kind: "bullet" | "summary" | "tailor" | "cover-letter", source: string, target: { experience: number; bullet: number } | null = null, job="") => { setAiKind(kind); setAiSource(source); setAiTarget(target); setAiJobDescription(job); setAiSuggestions([]); setAiDraft(""); setConsent(false); setModal("ai"); };
  const runAi = async () => {
    if (!consent) return;
    const startedAt = Date.now();
    setAiDurationMs(0);
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/rewrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: aiKind, text: aiSource, jobDescription:aiJobDescription, consent: true }) });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
        const result = await response.json().catch(() => null);
        showToast(result?.error ?? "AI could not respond.");
        if (response.status === 402 && window.confirm("Start the ₦3,000/month AI plan for more AI assistance?")) await startCheckout("ai");
        return;
      }
      if (!response.body) throw new Error("The AI response stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let generated = "";
      let receivedResult = false;
      let lastDraftUpdate = 0;
      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type: string; text?: string; message?: string; data?: { suggestions: Suggestion[] } };
        if (event.type === "token" && event.text) {
          generated += event.text;
          if (Date.now() - lastDraftUpdate >= 100) { setAiDraft(extractDraftSuggestions(generated)); lastDraftUpdate = Date.now(); }
        } else if (event.type === "result" && event.data) {
          receivedResult = true;
          setAiSuggestions(event.data.suggestions);
          setAiDraft("");
        } else if (event.type === "error") throw new Error(event.message ?? "AI could not respond just now.");
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        lines.forEach(handleEvent);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleEvent(buffer);
      if (!receivedResult) throw new Error("The AI response ended before the suggestions were ready.");
    } catch { setAiDraft(""); showToast("AI could not respond. Your draft is still saved."); }
    finally { setAiDurationMs(Date.now() - startedAt); setAiLoading(false); }
  };
  const startCheckout = async (product: "exports" | "ai") => {
    if (!accountSession) { window.location.href = "/signin?mode=signup"; return; }
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product }) });
      const result = await response.json();
      if (!response.ok) { showToast(result.error ?? "Checkout could not start."); return; }
      window.location.assign(result.authorizationUrl);
    } catch { showToast("Could not connect to Paystack. Please try again."); }
  };
  const authorizeExport = async () => {
    try {
      const response = await fetch("/api/billing/trial", { method: "POST" });
      const result = await response.json();
      if (response.ok) return true;
      showToast(result.error ?? "Export needs an active account or unlock.");
      if (response.status === 401 && window.confirm("Create an account or sign in to use the free export trial?")) { window.location.href = "/signin?mode=signup"; return false; }
      if (response.status === 402 && window.confirm("Unlock PDF and DOCX exports for ₦1,500?")) await startCheckout("exports");
      return false;
    } catch { showToast("Could not check export access. Your resume is unchanged."); return false; }
  };
  const exportPdf = async () => {
    if (!(await authorizeExport())) return;
    if (showDashboard) {
      setShowDashboard(false);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    window.print();
  };
  const applySuggestion = (text: string) => {
    if (aiKind === "cover-letter") setCoverLetter(text);
    else if (aiTarget) setResume((current) => ({ ...current, experience: current.experience.map((entry, i) => i === aiTarget.experience ? { ...entry, bullets: entry.bullets.map((bullet, b) => b === aiTarget.bullet ? text : bullet) } : entry) }));
    else update("summary", text);
    setModal(null); showToast("Suggestion added to your draft.");
  };
  const addVersion = () => { const item = { label: `Saved version ${versions.length + 1}`, date: new Date().toISOString(), data: structuredClone(resume) }; setVersions((current) => [item, ...current].slice(0, 20)); if (accountSession && resume.id.startsWith("c")) void fetch(`/api/resumes/${resume.id}/versions`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ data:resume, label:item.label }) }); showToast("Version saved."); };
  const startBlank = () => { addVersion(); setShowDashboard(false); setIsExample(false); setResumeList((current) => [resume, ...current.filter((item) => item.id !== resume.id)]); setResume({ ...initialResume, isExample:false, id:`resume-${crypto.randomUUID()}`, title:"Untitled resume", fullName:"", role:"", email:"", phone:"", phoneCountryCode:"+234", location:"", locationRegion:"Nigeria", website:"", summary:"", experience:[], education:[], skills:[], projects:[], certifications:[], languages:[], paperSize:"a4" }); setActive("contact"); showToast("Started a blank resume. Your previous draft is saved."); };
  const switchResume = (id:string) => { if (id === resume.id) { setShowDashboard(false); return; } const chosen = resumeList.find((item) => item.id === id); if (!chosen) return; setShowDashboard(false); setIsExample(Boolean(chosen.isExample)); setResumeList((current) => [resume, ...current.filter((item) => item.id !== resume.id && item.id !== id)]); setResume(chosen); setVersions([]); if(accountSession&&id.startsWith("c")) void fetch(`/api/resumes/${id}/versions`).then((r)=>r.ok?r.json():[]).then((rows)=>setVersions(rows.map((item:{label:string|null;createdAt:string;data:ResumeData})=>({label:item.label??"Saved version",date:item.createdAt,data:item.data})))); setActive("contact"); };
  const createShareLink = async () => { if (!accountSession || !resume.id.startsWith("c")) { showToast("Sign in and save this resume before sharing."); return; } const response = await fetch(`/api/resumes/${resume.id}/share`, { method:"POST" }); const result = await response.json(); if (response.ok) setShareUrl(result.url); else showToast(result.error ?? "Could not create a share link."); };
  const revokeShareLink = async () => { const response = await fetch(`/api/resumes/${resume.id}/share`, { method:"DELETE" }); if (response.ok) { setShareUrl(""); showToast("Public link turned off."); } else showToast("Could not turn off the public link."); };
  const restoreVersion = (data: ResumeData) => { setResume(normalizeResume(data)); setModal(null); showToast("Version restored."); };
  const updateExperience = (index: number, value: Experience) => setResume((current) => ({ ...current, experience: current.experience.map((item, i) => i === index ? value : item) }));
  const updateEducation = (index: number, value: Education) => setResume((current) => ({ ...current, education: current.education.map((item, i) => i === index ? value : item) }));
  const exportText = () => {
    const blocks = [resume.fullName, resume.role, [resume.email, getResumePhone(resume), getResumeLocation(resume), resume.website].filter(Boolean).join(" | ")];
    for (const section of normalizeSectionOrder(resume.sectionOrder)) {
      if (section === "summary" && resume.summary) blocks.push("PROFESSIONAL SUMMARY", resume.summary);
      if (section === "experience" && resume.experience.length) blocks.push("EXPERIENCE", ...resume.experience.flatMap((e) => [`${e.role} | ${e.company} | ${e.start}–${e.end}`, ...e.bullets.map((b) => `• ${b}`)]));
      if (section === "education" && resume.education.length) blocks.push("EDUCATION", ...resume.education.map((e) => `${e.degree} | ${e.school} | ${e.start}–${e.end}`));
      if (section === "skills" && resume.skills.length) blocks.push("SKILLS", resume.skills.join(" · "));
      if (section === "projects" && resume.projects.length) blocks.push("PROJECTS", ...resume.projects);
      if (section === "extras") { if (resume.certifications.length) blocks.push("CERTIFICATIONS", ...resume.certifications); if (resume.languages.length) blocks.push("LANGUAGES", ...resume.languages); }
    }
    const text = blocks.join("\n\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); link.download = `${resume.fullName || "resume"}.txt`; link.click(); URL.revokeObjectURL(link.href); showToast("Plain text resume downloaded.");
  };
  const exportDocx = async () => {
    if (!(await authorizeExport())) return;
    try {
      const { Document, HeadingLevel, Packer, Paragraph } = await import("docx");
      const children = [new Paragraph({text:resume.fullName,heading:HeadingLevel.TITLE}), new Paragraph({text:resume.role}), new Paragraph({text:[resume.email,getResumePhone(resume),getResumeLocation(resume),resume.website].filter(Boolean).join(" | ")})];
      for (const section of normalizeSectionOrder(resume.sectionOrder)) {
        if (section === "summary" && resume.summary) children.push(new Paragraph({text:"Professional Summary",heading:HeadingLevel.HEADING_1}),new Paragraph({text:resume.summary}));
        if (section === "experience" && resume.experience.length) { children.push(new Paragraph({text:"Experience",heading:HeadingLevel.HEADING_1})); for (const e of resume.experience) { children.push(new Paragraph({text:e.role,heading:HeadingLevel.HEADING_2}),new Paragraph({text:`${e.company}${e.location?` · ${e.location}`:""} | ${e.start}–${e.end}`})); for (const bullet of e.bullets.filter(Boolean)) children.push(new Paragraph({text:bullet,bullet:{level:0}})); } }
        if (section === "education" && resume.education.length) { children.push(new Paragraph({text:"Education",heading:HeadingLevel.HEADING_1})); for (const e of resume.education) children.push(new Paragraph({text:`${e.degree} | ${e.school} | ${e.start}–${e.end}`})); }
        if (section === "skills" && resume.skills.length) children.push(new Paragraph({text:"Skills",heading:HeadingLevel.HEADING_1}),new Paragraph({text:resume.skills.join(" · ")}));
        if (section === "projects" && resume.projects.length) children.push(new Paragraph({text:"Projects",heading:HeadingLevel.HEADING_1}),new Paragraph({text:resume.projects.filter(Boolean).join("\n")}));
        if (section === "extras") { if (resume.certifications.length) children.push(new Paragraph({text:"Certifications",heading:HeadingLevel.HEADING_1}),new Paragraph({text:resume.certifications.join(" · ")})); if (resume.languages.length) children.push(new Paragraph({text:"Languages",heading:HeadingLevel.HEADING_1}),new Paragraph({text:resume.languages.join(" · ")})); }
      }
      const paper = resume.paperSize === "letter" ? { width:12240, height:15840 } : { width:11906, height:16838 };
      const font = getFontOption(resume.font) === "source-sans" ? "Source Sans 3" : getFontOption(resume.font) === "ibm-plex" ? "IBM Plex Sans" : "Source Serif 4";
      const blob = await Packer.toBlob(new Document({sections:[{properties:{page:{size:paper}},children}],styles:{default:{document:{run:{font,size:20,color:"1B2430"}}}}})); const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${resume.fullName||"resume"}.docx`;link.click();URL.revokeObjectURL(link.href);showToast("DOCX resume downloaded.");
    } catch { showToast("DOCX export could not complete. Please try again."); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/import", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setImportPreview({ filename: result.filename ?? file.name, text: result.text, data: result.data }); }
    catch (error) { showToast(error instanceof Error ? error.message : "The file could not be imported."); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const moveSection = (from: ResumeSection, to: ResumeSection) => setResume((current) => { const order = normalizeSectionOrder(current.sectionOrder); return { ...current, sectionOrder: moveArrayItem(order, order.indexOf(from), order.indexOf(to)) }; });
  const moveExperience = (from: number, to: number) => setResume((current) => ({ ...current, experience: moveArrayItem(current.experience, from, to) }));
  const moveEducation = (from: number, to: number) => setResume((current) => ({ ...current, education: moveArrayItem(current.education, from, to) }));
  const moveProject = (from: number, to: number) => setResume((current) => ({ ...current, projects: moveArrayItem(current.projects, from, to) }));
  const applyImportedResume = () => {
    if (!importPreview) return;
    const current = resume;
    const data = importPreview.data;
    const title = importPreview.filename.replace(/\.(pdf|docx)$/i, "").trim() || "Imported resume";
    const next: ResumeData = {
      ...initialResume,
      id: `resume-${crypto.randomUUID()}`,
      title,
      isExample: false,
      fullName: data.fullName || "",
      role: data.role || "",
      email: data.email || "",
      phone: data.phone || "",
      phoneCountryCode: data.phoneCountryCode || "+234",
      location: data.location || "",
      locationRegion: "Other",
      website: data.website || "",
      summary: data.summary || "",
      experience: data.experience.length ? data.experience : [],
      education: data.education.length ? data.education : [],
      skills: data.skills,
      projects: data.projects,
      certifications: data.certifications,
      languages: data.languages,
    };
    setResumeList((items) => [current, ...items.filter((item) => item.id !== current.id)]);
    setResume(next);
    setIsExample(false);
    setActive("contact");
    setImportPreview(null);
    setShowDashboard(false);
    showToast("Imported resume added. Review each section before exporting.");
  };
  const match = useMemo(() => { const terms = [...new Set((jobDescription.toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) ?? []).filter((x) => !["the","and","for","with","from","this","that","will","are","you","your","our","have","has","experience","role","team","work","ability","strong","years"].includes(x)))]; const own = `${resume.summary} ${resume.experience.flatMap((e) => [e.role,e.company,...e.bullets]).join(" ")} ${resume.skills.join(" ")}`.toLowerCase(); const found = terms.filter((x) => own.includes(x)); return { found, missing: terms.filter((x) => !own.includes(x)).slice(0, 12), score: terms.length ? Math.round(found.length / terms.length * 100) : 0 }; }, [jobDescription, resume]);

  return <>
    <header className="topbar">
      <div style={{ display:"flex", alignItems:"center" }}><div className="brand"><span className="brand-mark" aria-hidden="true">f</span> forme</div><span className="crumbs">My resumes　/　{resume.title}</span></div>
      <div className="top-actions">
        <ThemeToggle/>
        <span className="save-state" role="status" aria-live="polite"><span className="save-indicator" aria-hidden="true">{!saved || syncState === "error" ? <i className="save-dot" style={{ background:syncState === "error" ? "var(--brick)" : undefined }} /> : <CheckedIcon size={14} color="var(--success)" aria-hidden="true"/>}</span>{!saved ? "Saving…" : accountSession ? syncState === "error" ? "Sync needs attention" : syncState === "saving" ? "Syncing…" : syncState === "synced" ? "Saved" : "Local draft saved" : "Saved on this device"}</span>
        <a className="button small" href="/privacy">Privacy</a>
        <button className="button small" onClick={() => setModal("plans")}>Plans</button>
        <button className="button small" onClick={() => setShowDashboard(true)}>My resumes</button>
        <button className="button small" onClick={startBlank}>New resume</button>
        <button className="button small" onClick={() => setModal("share")}><LinkIcon size={15}/>Share</button>
        <button className="button small" onClick={addVersion}><HistoryCircleIcon size={15}/>Save version</button>
        <button className="button small" onClick={() => void exportDocx()}><DownloadIcon size={15}/>Export DOCX</button>
        <button className="button small" onClick={() => void exportPdf()}><DownloadIcon size={15}/>Export PDF</button>
        <button className="button primary small" onClick={() => setModal("account")}>{accountSession ? "Account" : "Sign in"}</button>
      </div>
    </header>
    {showDashboard ? <main className="dashboard"><div className="dashboard-heading"><div><div className="eyebrow">Resume desk</div><h1>Your resumes</h1><p>Pick up where you left off or start a fresh draft.</p></div><button className="button primary" onClick={startBlank}>Start a new resume</button></div><div className="resume-grid">{[resume, ...resumeList.filter((item) => item.id !== resume.id)].map((item) => <button className="resume-tile" key={item.id} onClick={() => switchResume(item.id)}><span className="paper-thumb" style={{"--accent":item.accent} as React.CSSProperties}><span className="thumb-name">{item.fullName || "Your name"}</span><span className="thumb-rule"/><span className="thumb-line long"/><span className="thumb-line"/><span className="thumb-section">Experience</span><span className="thumb-line long"/><span className="thumb-line"/><span className="thumb-line mid"/></span><span className="resume-tile-title">{item.title || "Untitled resume"}</span><span className="resume-tile-meta">Edited {formatEdited(lastEdited[item.id])}{item.id === resume.id ? " · Current draft" : ""}</span></button>)}</div></main> : <><div className="mobile-tabs" role="group" aria-label="Workspace view"><button type="button" aria-pressed={mobileView === "edit"} className={mobileView === "edit" ? "active" : ""} onClick={() => setMobileView("edit")}>Edit</button><button type="button" aria-pressed={mobileView === "preview"} className={mobileView === "preview" ? "active" : ""} onClick={() => setMobileView("preview")}>Preview</button></div><main className={`workspace mobile-${mobileView}`}>
      <nav className="rail" aria-label="Resume sections" onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.currentTarget.scrollLeft += event.deltaY; event.preventDefault(); } }}>
        {resumeList.length > 0 && <div className="field" style={{ padding:"0 6px 8px" }}><label htmlFor="resume-switcher">My resumes</label><select id="resume-switcher" value="current" onChange={(e) => switchResume(e.target.value)}><option value="current">{resume.title || "Untitled resume"}</option>{resumeList.map((item) => <option key={item.id} value={item.id}>{item.title || "Untitled resume"}</option>)}</select></div>}
        <div className="rail-label">Your resume</div><p className="reorder-help">Drag sections to reorder, or focus one and press Alt + an arrow key.</p>
        {orderedSections.map((key, index) => <button key={key} draggable={key !== "contact"} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={(event) => { if (key === "contact" || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return; event.preventDefault(); const current = normalizeSectionOrder(resume.sectionOrder); const from = current.indexOf(key); const to = from + (event.key === "ArrowUp" ? -1 : 1); if (to >= 0 && to < current.length) moveSection(key, current[to]); }} onDragStart={(event) => { if (key === "contact") return; draggedSection.current = key; event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (key !== "contact") event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const from = draggedSection.current; if (from && key !== "contact") moveSection(from, key); draggedSection.current = null; }} onDragEnd={() => { draggedSection.current = null; }} className={`rail-item ${active === key ? "active" : ""}`} data-section={key} onClick={() => setActive(key)}><span className="rail-icon" aria-hidden="true">{sectionIcons[key]}</span><span className="rail-name">{sectionNames[key]}{key !== "contact" && <span className="drag-hint" aria-hidden="true">⠿</span>}</span><span className={`section-status ${isSectionComplete(key, resume) ? "complete" : "empty"}`} aria-label={isSectionComplete(key, resume) ? "Complete" : "Empty"}>{isSectionComplete(key, resume) ? <CheckedIcon size={14} color="var(--success)" aria-hidden="true"/> : "–"}</span></button>)}
        <div className="rail-label">More tools</div>
        {(["tailor", "import", "versions"] as Section[]).map((key) => <button key={key} className={`rail-item ${active === key ? "active" : ""}`} data-section={key} onClick={() => setActive(key)}><span className="rail-icon">{sectionIcons[key]}</span>{sectionNames[key]}</button>)}
        <div className="progress-card"><b>Your resume is taking shape</b><p>A few more details can help employers see the full picture.</p><div className="progress-line"><span /></div></div>
      </nav>
      <section className="editor" aria-label="Resume editor"><div className="editor-inner">
        <div className="eyebrow">Resume workspace</div><h1>{active === "tailor" ? "Tailor to a role" : active === "import" ? "Bring in your resume" : active === "versions" ? "Resume versions" : sectionNames[active]}</h1><p className="subhead">{active === "contact" ? "Start with the details you want hiring teams to use to reach you." : active === "summary" ? "A concise introduction to the work you do and the value you bring." : active === "experience" ? "Lead with outcomes and details that are true to your work." : "Keep your details clear, specific and easy to scan."}</p>
        <div className="section-tabs" role="group" aria-label="Resume sections">{orderedSections.map((s) => <button type="button" aria-pressed={active === s} key={s} className={`section-tab ${active === s ? "active" : ""}`} onClick={() => setActive(s)}>{sectionNames[s]}</button>)}</div>
        {active === "contact" && <><div className="panel-heading"><div><h2>Contact information</h2><p>Use a professional email and a location where you are open to work.</p></div></div><div className="field-grid"><Field label="Full name" value={resume.fullName} onChange={(v) => update("fullName", v)} placeholder="e.g. Ada Okafor"/><Field label="Professional title" value={resume.role} onChange={(v) => update("role", v)} placeholder="e.g. Product designer"/><Field label="Email address" value={resume.email} onChange={(v) => update("email", v)} type="email" placeholder="e.g. ada@example.com"/><div className="field"><label htmlFor="phone-region">Phone number</label><div className="phone-field"><select id="phone-region" aria-label="Phone country code" value={getPhoneCountryCode(resume)} onChange={(e) => { const code=e.target.value; update("phoneCountryCode",code); update("phone", getNationalPhoneNumber(resume) ? `${code} ${getNationalPhoneNumber(resume)}` : ""); }}>{diallingRegions.map((item)=><option key={item.region} value={item.code}>{item.region} ({item.code})</option>)}</select><input aria-label="Phone number" type="tel" value={getNationalPhoneNumber(resume)} onChange={(e) => { update("phoneCountryCode",getPhoneCountryCode(resume)); update("phone",e.target.value.trim() ? `${getPhoneCountryCode(resume)} ${e.target.value}` : ""); }} placeholder="e.g. 803 123 4567" autoComplete="tel-national"/></div></div><div className="field"><label htmlFor="city-region">City or town</label><input id="city-region" value={resume.location} onChange={(e)=>update("location",e.target.value)} placeholder="e.g. Lagos" autoComplete="address-level2"/></div><div className="field"><label htmlFor="location-region">Country or region</label><select id="location-region" value={resume.locationRegion ?? "Nigeria"} onChange={(e)=>update("locationRegion",e.target.value)}>{locationRegions.map((region)=><option key={region} value={region}>{region}</option>)}</select></div><Field label="Portfolio or LinkedIn" value={resume.website} onChange={(v) => update("website", v)} placeholder="e.g. linkedin.com/in/adaokafor"/><Field className="full" label="Resume title" value={resume.title} onChange={(v) => update("title", v)} placeholder="e.g. Product designer resume" /></div><div className="bottom-note">Your contact details appear at the top of your resume. Only include information you are comfortable sharing.</div></>}
        {active === "summary" && <><div className="panel-heading"><div><h2>Professional summary</h2><p>Share your experience and what you are known for. Keep it in your own voice.</p></div><button className="button small ai-inline" disabled={!resume.summary.trim() && !buildSummarySource(resume)} onClick={() => openAi("summary", resume.summary.trim() || buildSummarySource(resume))}><SparklesIcon size={16}/>{resume.summary.trim() ? "Improve with AI" : "Generate from experience"}</button></div><div className="field full"><label htmlFor="summary">Your summary</label><textarea id="summary" value={resume.summary} onChange={(e) => update("summary", e.target.value)} rows={7} placeholder="A few sentences about your experience and strengths…"/><span className="field-note">Tip: mention your years of experience, focus area and the kind of work you do best.</span></div></>}
        {active === "experience" && <><div className="panel-heading"><div><h2>Work experience</h2><p>Put your most recent role first. Add specific results only when you know them.</p></div><button className="button small" onClick={() => update("experience", [...resume.experience, emptyExperience()])}>＋ Add role</button></div>{resume.experience.map((entry, i) => <div className="entry-card" key={i} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedExperience.current !== null) moveExperience(draggedExperience.current, i); draggedExperience.current = null; }}><div className="entry-head" draggable onDragStart={(event) => { draggedExperience.current = i; event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggedExperience.current = null; }} tabIndex={0} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={(event) => { if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return; event.preventDefault(); const to = i + (event.key === "ArrowUp" ? -1 : 1); if (to >= 0 && to < resume.experience.length) moveExperience(i, to); }}><span>Position {i + 1}</span><div className="entry-actions"><button className="icon-button" aria-label="Move role up" onClick={() => { if (!i) return; const a = [...resume.experience]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; update("experience", a); }}>↑</button><button className="icon-button" aria-label="Move role down" onClick={() => { if (i === resume.experience.length - 1) return; const a = [...resume.experience]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; update("experience", a); }}>↓</button><button className="icon-button" aria-label="Remove role" onClick={() => update("experience", resume.experience.filter((_, x) => x !== i))}>×</button></div></div><div className="field-grid"><Field label="Job title" value={entry.role} onChange={(v) => updateExperience(i, { ...entry, role:v })} placeholder="e.g. Operations manager"/><Field label="Company" value={entry.company} onChange={(v) => updateExperience(i, { ...entry, company:v })} placeholder="e.g. Acme Ltd"/><Field label="Location" value={entry.location} onChange={(v) => updateExperience(i, { ...entry, location:v })} placeholder="e.g. Lagos, Nigeria"/><div className="field"><label>Dates</label><div style={{ display:"flex", gap:7 }}><input aria-label="Start year" value={entry.start} onChange={(e) => updateExperience(i, { ...entry, start:e.target.value })} placeholder="Start"/><input aria-label="End year" value={entry.end} onChange={(e) => updateExperience(i, { ...entry, end:e.target.value })} placeholder="End"/></div></div></div><hr className="divider"/><label style={{ fontSize:10, color:"#717971", fontWeight:600 }}>Highlights and accomplishments</label>{entry.bullets.map((bullet, b) => <div className="bullet-line" key={b}><textarea aria-label={`Accomplishment ${b+1}`} value={bullet} onChange={(e) => updateExperience(i, { ...entry, bullets:entry.bullets.map((x, n) => n === b ? e.target.value : x) })} placeholder="Describe a contribution or result…"/><button className="button ai-inline" onClick={() => openAi("bullet", bullet, { experience:i, bullet:b })}><SparklesIcon size={15}/>Rewrite</button><button className="icon-button" aria-label="Remove highlight" onClick={() => updateExperience(i, { ...entry, bullets:entry.bullets.filter((_, n) => n !== b) })}>×</button></div>)}<button className="add-link" onClick={() => updateExperience(i, { ...entry, bullets:[...entry.bullets, ""] })}>＋ Add a highlight</button></div>)}<button className="add-link" onClick={() => update("experience", [...resume.experience, emptyExperience()])}>＋ Add another position</button><p className="bottom-note">AI suggestions are optional and always need your review. Forme will not add facts, dates or metrics you have not provided.</p></>}
        {active === "education" && <><div className="panel-heading"><div><h2>Education</h2><p>Add your relevant degrees, programs and training.</p></div><button className="button small" onClick={() => update("education", [...resume.education, emptyEducation()])}>＋ Add education</button></div>{resume.education.map((e, i) => <div className="entry-card" key={i} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedEducation.current !== null) moveEducation(draggedEducation.current, i); draggedEducation.current = null; }}><div className="entry-head" draggable onDragStart={(event) => { draggedEducation.current = i; event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggedEducation.current = null; }} tabIndex={0} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={(event) => { if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return; event.preventDefault(); const to = i + (event.key === "ArrowUp" ? -1 : 1); if (to >= 0 && to < resume.education.length) moveEducation(i, to); }}><span>Education {i+1}</span><div className="entry-actions"><button className="icon-button" aria-label="Move education up" disabled={i===0} onClick={()=>moveEducation(i,i-1)}>↑</button><button className="icon-button" aria-label="Move education down" disabled={i===resume.education.length-1} onClick={()=>moveEducation(i,i+1)}>↓</button><button className="icon-button" aria-label="Remove education" onClick={() => update("education", resume.education.filter((_, n) => n !== i))}>×</button></div></div><div className="field-grid"><Field label="School" value={e.school} onChange={(v) => updateEducation(i, { ...e, school:v })} placeholder="e.g. University of Lagos"/><Field label="Degree or program" value={e.degree} onChange={(v) => updateEducation(i, { ...e, degree:v })} placeholder="e.g. BSc Computer Science"/><Field label="Location" value={e.location} onChange={(v) => updateEducation(i, { ...e, location:v })} placeholder="e.g. Lagos, Nigeria"/><div className="field"><label>Dates</label><div style={{ display:"flex", gap:7 }}><input aria-label="Start year" value={e.start} onChange={(x) => updateEducation(i, { ...e, start:x.target.value })}/><input aria-label="End year" value={e.end} onChange={(x) => updateEducation(i, { ...e, end:x.target.value })}/></div></div></div></div>)}</>}
        {active === "skills" && <><div className="panel-heading"><div><h2>Skills and style</h2><p>Keep the resume single-column and easy for applicant systems to read.</p></div></div><TagEditor label="Skills" items={resume.skills} onChange={(v) => update("skills", v)} placeholder="Type a skill and press Enter"/><hr className="divider"/><div className="field-grid"><div className="field"><label htmlFor="template">Resume template</label><select id="template" value={resume.template} onChange={(e) => update("template", e.target.value as ResumeData["template"])}><option value="classic">Classic</option><option value="modern">Modern</option><option value="compact">Compact</option></select></div><div className="field"><label htmlFor="accent">Resume accent</label><select id="accent" value={["#1F2937","#1E3A5F","#0F766E","#7F1D1D","#334E8C"].includes(resume.accent) ? resume.accent : "#1F2937"} onChange={(e) => update("accent", e.target.value)}><option value="#1F2937">Charcoal</option><option value="#1E3A5F">Navy</option><option value="#0F766E">Deep teal</option><option value="#7F1D1D">Burgundy</option><option value="#334E8C">Slate blue</option></select><span className="field-note">Used for your name, section headings and thin rules only.</span></div><div className="field"><label htmlFor="spacing">Spacing</label><select id="spacing" value={resume.spacing} onChange={(e) => update("spacing", e.target.value as ResumeData["spacing"])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div><div className="field"><label htmlFor="font">Resume font</label><select id="font" value={getFontOption(resume.font)} onChange={(e) => update("font", e.target.value)}><option value="source-serif">Georgia · Traditional</option><option value="source-sans">Arial · Modern</option><option value="ibm-plex">Courier New · Technical</option></select></div><div className="field"><label htmlFor="paper-size">Paper size</label><select id="paper-size" value={resume.paperSize ?? "a4"} onChange={(e) => update("paperSize", e.target.value as "a4" | "letter")}><option value="a4">A4 · 210 × 297 mm</option><option value="letter">Letter · 8.5 × 11 in</option></select></div></div></>}
        {active === "projects" && <><div className="panel-heading"><div><h2>Projects</h2><p>Showcase independent or selected work.</p></div><button className="button small" onClick={() => update("projects", [...resume.projects, ""])}>＋ Add project</button></div>{resume.projects.map((p, i) => <div className="bullet-line" key={i} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedProject.current !== null) moveProject(draggedProject.current, i); draggedProject.current = null; }}><button type="button" className="icon-button drag-handle" draggable aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" aria-label={`Drag project ${i+1}; or press Alt and an arrow key to move`} onDragStart={(event) => { draggedProject.current = i; event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { draggedProject.current = null; }} onKeyDown={(event) => { if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return; event.preventDefault(); const to = i + (event.key === "ArrowUp" ? -1 : 1); if (to >= 0 && to < resume.projects.length) moveProject(i, to); }}>⠿</button><button type="button" className="icon-button" aria-label={`Move project ${i+1} up`} disabled={i===0} onClick={()=>moveProject(i,i-1)}>↑</button><button type="button" className="icon-button" aria-label={`Move project ${i+1} down`} disabled={i===resume.projects.length-1} onClick={()=>moveProject(i,i+1)}>↓</button><textarea aria-label={`Project ${i+1}`} value={p} onChange={(e) => update("projects", resume.projects.map((x, n) => n === i ? e.target.value : x))} placeholder="Project name — what you did and tools used"/><button className="icon-button" aria-label="Remove project" onClick={() => update("projects", resume.projects.filter((_, n) => n !== i))}>×</button></div>)}</>}
        {active === "extras" && <><div className="panel-heading"><div><h2>Certifications and languages</h2><p>Add credentials and languages relevant to your application.</p></div></div><TagEditor label="Certifications" items={resume.certifications} onChange={(v) => update("certifications", v)} placeholder="Add a certification"/><hr className="divider"/><TagEditor label="Languages" items={resume.languages} onChange={(v) => update("languages", v)} placeholder="Add a language"/></>}
        {active === "tailor" && <Tailor resume={resume} jobDescription={jobDescription} setJobDescription={setJobDescription} match={match} coverLetter={coverLetter} setCoverLetter={setCoverLetter} onAi={(target) => { if (target) openAi("tailor", resume.experience[target.experience].bullets[target.bullet], target, jobDescription); }} onCoverLetter={() => openAi("cover-letter", `${resume.summary}\n${resume.experience.flatMap((e) => [e.role,e.company,...e.bullets]).join("\n")}`.slice(0,5000), null, jobDescription)} exportText={exportText}/ >}
        {active === "import" && <><div className="import-drop"><strong>Start with a resume you already have</strong><p>Upload a text based PDF or DOCX up to 5 MB. We’ll detect common sections and let you review them before adding a new draft.</p><button className="button" onClick={() => fileRef.current?.click()} disabled={importing}><UploadIcon size={16}/>{importing ? "Reading file…" : "Choose a file"}</button><input ref={fileRef} hidden type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => void importFile(e.target.files?.[0])}/></div><div className="notice">Import detection is approximate. You can review and edit every field before exporting. Your current resume stays in your resume list.</div></>}
        {active === "versions" && <><div className="panel-heading"><div><h2>Version history</h2><p>Save a checkpoint before you make a bigger change.</p></div><button className="button small" onClick={addVersion}><HistoryCircleIcon size={16}/>Save this version</button></div>{versions.length ? versions.map((v, i) => <div className="entry-card" key={`${v.date}-${i}`} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><div><b style={{ fontSize:12 }}>{v.label}</b><div className="field-note" style={{ marginTop:5 }}>{new Date(v.date).toLocaleString()}</div></div><button className="button small" onClick={() => restoreVersion(v.data)}>Restore</button></div>) : <div className="notice">Your saved versions will appear here. Your current draft saves automatically in this browser.</div>}</>}
      </div></section>
      <aside className="preview-pane" aria-label="Live resume preview"><div className="preview-toolbar"><span className="preview-title">Live preview</span><div className="preview-controls"><button className="button quiet small" onClick={() => void exportPdf()}>Export PDF</button></div></div><div className="preview-scroll"><ResumePreview resume={resume}/></div></aside>
    </main></>}
    {modal === "ai" && <div className="modal-backdrop" role="presentation"><div id="ai-dialog" className="modal" role="dialog" aria-modal="true" aria-labelledby="ai-title" tabIndex={-1}><div className="modal-top"><div><h2 id="ai-title">{aiKind === "summary" ? "Build a professional summary" : "A second pair of eyes"}</h2><p>AI will only rephrase facts in the text you provide. Review every suggestion before adding it.</p></div><button className="icon-button" aria-label="Close" onClick={() => setModal(null)}>×</button></div>{!aiSuggestions.length ? <><div className="field"><label htmlFor="ai-source">{aiKind === "summary" && !resume.summary.trim() ? "Experience facts for your summary" : "Text to improve"}</label><textarea id="ai-source" value={aiSource} onChange={(e) => setAiSource(e.target.value)} rows={6}/></div><label style={{ display:"flex", alignItems:"flex-start", gap:9, marginTop:14, color:"#727c73", fontSize:10, lineHeight:1.5 }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/><span>I consent to sending this text to Google Gemini to generate suggestions. The Gemini API free tier may use prompts and responses to improve Google products. My resume will not change unless I choose a suggestion.</span></label><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={!consent || !aiSource.trim() || aiLoading} onClick={() => void runAi()}>{aiLoading ? "Working…" : "Generate suggestions"}</button></div>{aiLoading && <><ReasoningTrace running durationMs={0}/><div className="stream-preview" role="status" aria-live="polite"><b>Live AI draft · not yet checked</b><p>{aiDraft || "Gemini is starting the response…"}</p></div></>}</> : <><div className="notice">Nothing is added until you choose a suggestion. The original text stays saved.</div><ReasoningTrace running={false} durationMs={aiDurationMs}/>{aiSuggestions.map((s, i) => <div className="suggestion" key={i}><p>{s.text}</p><small>{s.reason}</small><small className="ai-evidence"><b>Grounded in your text:</b> {s.evidence.join(" · ")}</small><div className="suggestion-actions"><button className="button primary" onClick={() => applySuggestion(s.text)}>Accept rewrite</button><button className="button" onClick={() => setAiSuggestions((current) => current.filter((_, index) => index !== i))}>Reject</button></div></div>)}<div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Keep original</button></div></>}</div></div>}
    {importPreview && <Modal title="Review imported resume" onClose={() => setImportPreview(null)}><div className="notice">Check these automatically detected details. Formatting varies between resumes, so some fields may need correction. Your current draft will remain saved as a separate resume.</div><div className="field-grid"><div className="field"><label>Contact</label><p>{[importPreview.data.fullName, importPreview.data.role, importPreview.data.email, importPreview.data.phone, importPreview.data.location].filter(Boolean).join(" · ") || "No contact details detected"}</p></div><div className="field"><label>Summary</label><p>{importPreview.data.summary || "No summary detected"}</p></div><div className="field"><label>Experience</label><p>{importPreview.data.experience.length ? `${importPreview.data.experience.length} role${importPreview.data.experience.length === 1 ? "" : "s"} detected` : "No experience detected"}</p></div><div className="field"><label>Education</label><p>{importPreview.data.education.length ? `${importPreview.data.education.length} entr${importPreview.data.education.length === 1 ? "y" : "ies"} detected` : "No education detected"}</p></div><div className="field"><label>Skills and extras</label><p>{[importPreview.data.skills.length && `${importPreview.data.skills.length} skills`, importPreview.data.projects.length && `${importPreview.data.projects.length} projects`, importPreview.data.certifications.length && `${importPreview.data.certifications.length} certifications`, importPreview.data.languages.length && `${importPreview.data.languages.length} languages`].filter(Boolean).join(" · ") || "No lists detected"}</p></div></div><details style={{marginTop:14}}><summary>View extracted text from {importPreview.filename}</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto",padding:12,background:"var(--paper)",border:"1px solid var(--line)",borderRadius:8,fontSize:11}}>{importPreview.text}</pre></details><div className="modal-actions"><button className="button" onClick={() => setImportPreview(null)}>Cancel</button><button className="button primary" onClick={applyImportedResume}>Add as a new resume</button></div></Modal>}
    {modal === "tailor" && <Modal title="Tailor for a job" onClose={() => setModal(null)}><Tailor resume={resume} jobDescription={jobDescription} setJobDescription={setJobDescription} match={match} coverLetter={coverLetter} setCoverLetter={setCoverLetter} onAi={(target) => { if (target) openAi("tailor", resume.experience[target.experience].bullets[target.bullet], target, jobDescription); }} onCoverLetter={() => openAi("cover-letter", `${resume.summary}\n${resume.experience.flatMap((e) => [e.role,e.company,...e.bullets]).join("\n")}`.slice(0,5000), null, jobDescription)} exportText={exportText}/></Modal>}
    {modal === "versions" && <Modal title="Saved versions" onClose={() => setModal(null)}><p>Restore a saved checkpoint to continue from that draft.</p>{versions.length ? versions.map((v,i) => <div className="entry-card" key={`${v.date}-${i}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><b style={{fontSize:12}}>{v.label}</b><div className="field-note">{new Date(v.date).toLocaleString()}</div></div><button className="button small" onClick={() => restoreVersion(v.data)}>Restore</button></div>) : <div className="notice">No versions saved yet.</div>}<button className="button small" onClick={addVersion}><HistoryCircleIcon size={15}/>Save current version</button></Modal>}
    {modal === "account" && <Modal title={accountSession ? "Your account" : "Keep your resume with you"} onClose={() => setModal(null)}><p>{accountSession ? "Your signed-in resume is synced to your account. Local autosave is also enabled in this browser." : "Create an account or sign in to sync resumes across devices. You can also keep working with local autosave in this browser."}</p><div className="modal-actions">{accountSession ? <><DataExportButton/><button className="button danger" disabled={deletingAccount} onClick={async () => { if (!window.confirm("Delete your account and all saved resumes? This cannot be undone.")) return; setDeletingAccount(true); try { const response = await fetch("/api/account", { method:"DELETE" }); if (!response.ok) throw new Error("Could not delete the account. Please sign in again."); localStorage.removeItem(storageKey); const { signOut } = await import("next-auth/react"); await signOut({ callbackUrl:"/" }); } catch (error) { showToast(error instanceof Error ? error.message : "Could not delete the account."); setDeletingAccount(false); } }}>{deletingAccount ? "Deleting account…" : "Delete account and data"}</button><button className="button primary" onClick={async () => { const { signOut } = await import("next-auth/react"); await signOut({ callbackUrl:"/" }); }}>Sign out</button></> : <><a className="button" href="/signin?mode=signup">Create account</a><a className="button primary" href="/signin">Sign in</a></>}</div></Modal>}
    {modal === "plans" && <Modal title="Forme plans" onClose={() => setModal(null)}><div className="notice">One free export trial and one free AI assistance trial per account. The export trial covers one PDF or DOCX download.</div><div className="entry-card"><b>Export unlock · ₦1,500 once</b><p>Unlimited PDF and DOCX exports.</p><button className="button primary" onClick={() => void startCheckout("exports")}>Unlock exports</button></div><div className="entry-card"><b>AI Premium · ₦3,000/month</b><p>More resume assistance with a 20-request-per-minute limit while subscribed. Cancel any time; access continues through the paid period.</p><button className="button primary" onClick={() => void startCheckout("ai")}>Start monthly AI plan</button><button className="button" onClick={async () => { const response=await fetch("/api/billing/cancel",{method:"POST"}); const result=await response.json(); if(response.ok) showToast("AI subscription cancelled. Access remains active until the end of the paid period."); else showToast(result.error??"Could not cancel the AI subscription."); }}>Cancel AI subscription</button></div></Modal>}
    {modal === "share" && <Modal title="Share a public resume" onClose={() => setModal(null)}><div className="notice">Anyone with this link can view the contact details and resume content above. Share it only with people you trust. You can turn the link off here at any time.</div>{!accountSession ? <p>Sign in and save this resume to create a public link.</p> : shareUrl ? <><div className="field"><label htmlFor="share-url">Public link</label><input id="share-url" readOnly value={shareUrl}/></div><div className="modal-actions"><button className="button" onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => showToast("Link copied."))}><LinkIcon size={15}/>Copy link</button><button className="button" onClick={() => void revokeShareLink()}>Turn off public link</button></div></> : <div className="modal-actions"><button className="button primary" disabled={!resume.id.startsWith("c")} onClick={() => void createShareLink()}><LinkIcon size={15}/>Create public link</button></div>}</Modal>}
    {notice && <div role="status" className="toast">{notice}</div>}
  </>;
}

function Field({ label, value, onChange, placeholder, type="text", className="" }: { label:string; value:string; onChange:(value:string)=>void; placeholder?:string; type?:string; className?:string }) { const id = useMemo(() => `f-${label.toLowerCase().replace(/[^a-z]+/g,"-")}`, [label]); return <div className={`field ${className}`}><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}/></div>; }
function TagEditor({ label, items, onChange, placeholder }: { label:string; items:string[]; onChange:(items:string[])=>void; placeholder:string }) {
  const [value,setValue]=useState("");
  const [dragged,setDragged]=useState<number|null>(null);
  const inputId=useMemo(()=>`tags-${label.toLowerCase().replace(/[^a-z]+/g,"-")}`,[label]);
  const add=()=>{const v=value.trim();if(v&&!items.includes(v)){onChange([...items,v]);setValue("")}};
  const reorder=(from:number,to:number)=>{if(to>=0&&to<items.length)onChange(moveArrayItem(items,from,to))};
  return <div className="field"><label htmlFor={inputId}>{label}</label><div className="tag-row" role="list" aria-label={label}>{items.map((item,i)=><span className="tag" role="listitem" key={`${item}-${i}`} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();if(dragged!==null)reorder(dragged,i);setDragged(null)}}><button type="button" className="drag-handle tag-drag-handle" draggable aria-label={`Drag ${item}; or press Alt and an arrow key to move`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onDragStart={(event)=>{setDragged(i);event.dataTransfer.effectAllowed="move"}} onDragEnd={()=>setDragged(null)} onKeyDown={(event)=>{if(!event.altKey||(event.key!=="ArrowUp"&&event.key!=="ArrowDown"))return;event.preventDefault();reorder(i,i+(event.key==="ArrowUp"?-1:1))}}>⠿</button><span>{item}</span><button type="button" className="icon-button tag-order-button" aria-label={`Move ${item} up`} disabled={i===0} onClick={()=>reorder(i,i-1)}>↑</button><button type="button" className="icon-button tag-order-button" aria-label={`Move ${item} down`} disabled={i===items.length-1} onClick={()=>reorder(i,i+1)}>↓</button><button aria-label={`Remove ${item}`} onClick={()=>onChange(items.filter((_,n)=>n!==i))}>×</button></span>)}</div><div style={{display:"flex",gap:8,marginTop:5}}><input id={inputId} className="tag-input" value={value} placeholder={placeholder} onChange={(e)=>setValue(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();add()}}}/><button className="button small" onClick={add}>Add</button></div></div>;
}
function ResumePreview({ resume }: { resume:ResumeData }) {
  const renderSection=(section:ResumeSection)=>{
    if(section==="summary")return resume.summary?<section className="resume-section"><h3>Professional Summary</h3><p>{resume.summary}</p></section>:null;
    if(section==="experience")return resume.experience.some((e)=>e.role||e.company)?<section className="resume-section"><h3>Experience</h3>{resume.experience.filter((e)=>e.role||e.company).map((e,i)=><div className="resume-job" key={i}><div className="resume-job-title"><span>{e.role}</span><span>{[e.start,e.end].filter(Boolean).join(" – ")}</span></div><div className="resume-job-meta">{[e.company,e.location].filter(Boolean).join(" · ")}</div>{e.bullets.some(Boolean)&&<ul className="resume-bullets">{e.bullets.filter(Boolean).map((b,n)=><li key={n}>{b}</li>)}</ul>}</div>)}</section>:null;
    if(section==="education")return resume.education.some((e)=>e.school||e.degree)?<section className="resume-section"><h3>Education</h3>{resume.education.filter((e)=>e.school||e.degree).map((e,i)=><div className="resume-job" key={i}><div className="resume-job-title"><span>{e.degree}</span><span>{[e.start,e.end].filter(Boolean).join(" – ")}</span></div><div className="resume-job-meta">{[e.school,e.location].filter(Boolean).join(" · ")}</div></div>)}</section>:null;
    if(section==="skills")return resume.skills.length?<section className="resume-section"><h3>Skills</h3><div className="skills-list">{resume.skills.map((x,i)=><span key={i}>{x}</span>)}</div></section>:null;
    if(section==="projects")return resume.projects.some(Boolean)?<section className="resume-section"><h3>Projects</h3><ul className="resume-bullets">{resume.projects.filter(Boolean).map((x,i)=><li key={i}>{x}</li>)}</ul></section>:null;
    return <>{resume.certifications.length>0&&<section className="resume-section"><h3>Certifications</h3><div className="skills-list">{resume.certifications.map((x,i)=><span key={i}>{x}</span>)}</div></section>}{resume.languages.length>0&&<section className="resume-section"><h3>Languages</h3><div className="skills-list">{resume.languages.map((x,i)=><span key={i}>{x}</span>)}</div></section>}</>;
  };
  return <article className={`resume-page ${resume.template} ${resume.spacing} ${resume.paperSize ?? "a4"}`} style={{ "--accent":resume.accent, fontFamily:getResumeFontFamily(resume.font) } as React.CSSProperties}><h2 className="resume-name">{resume.fullName || "Your name"}</h2><div className="resume-role">{resume.role || "Professional title"}</div><div className="resume-contact">{[resume.email,getResumePhone(resume),getResumeLocation(resume),resume.website].filter(Boolean).map((x,i)=><span key={i}>{x}</span>)}</div>{normalizeSectionOrder(resume.sectionOrder).map((section)=><Fragment key={section}>{renderSection(section)}</Fragment>)}</article>;
}
function normalizeSectionOrder(order?: ResumeSection[]) {
  const valid = Array.isArray(order) ? order.filter((section): section is ResumeSection => typeof section === "string" && (resumeSections as string[]).includes(section)) : [];
  return [...new Set([...valid, ...resumeSections.filter((section) => !valid.includes(section))])];
}
function moveArrayItem<T>(items:T[],from:number,to:number) { if(from<0||to<0||from>=items.length||to>=items.length||from===to)return items;const result=[...items];const [item]=result.splice(from,1);result.splice(to,0,item);return result; }
function buildSummarySource(resume:ResumeData) {
  const facts=[resume.role&&`Professional title: ${resume.role}`, ...resume.experience.map((entry)=>[entry.role&&`Role: ${entry.role}`,entry.company&&`Employer: ${entry.company}`,entry.location&&`Location: ${entry.location}`,entry.start||entry.end?`Dates: ${entry.start}–${entry.end}`:"",...entry.bullets.filter(Boolean).map((bullet)=>`Work fact: ${bullet}`)].filter(Boolean).join("\n")),...resume.education.map((entry)=>[entry.degree&&`Education: ${entry.degree}`,entry.school&&`School: ${entry.school}`].filter(Boolean).join("\n")),resume.skills.length?`Skills: ${resume.skills.join(", ")}`:""].filter(Boolean);
  return facts.join("\n\n").slice(0,5000);
}
function extractDraftSuggestions(raw:string) {
  return [...raw.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\])*)/g)].map((match)=>{try{return JSON.parse(`"${match[1]}"`) as string}catch{return match[1].replace(/\\n/g,"\n").replace(/\\"/g,'"')}}).join("\n\n");
}
function getFontOption(font:string) { return font === "Source Sans 3" || font === "source-sans" ? "source-sans" : font === "IBM Plex Sans" || font === "ibm-plex" ? "ibm-plex" : "source-serif"; }
function getResumeFontFamily(font:string) { const option=getFontOption(font); return option === "source-sans" ? "Arial, Helvetica, sans-serif" : option === "ibm-plex" ? "'Courier New', monospace" : "Georgia, 'Times New Roman', serif"; }
function normalizeResume(data:Partial<ResumeData>):ResumeData { const result={...initialResume,...data}; result.sectionOrder=normalizeSectionOrder(result.sectionOrder); if(!["#1F2937","#1E3A5F","#0F766E","#7F1D1D","#334E8C"].includes(result.accent)) result.accent="#1F2937"; if(!["source-serif","source-sans","ibm-plex","Source Sans 3","IBM Plex Sans"].includes(result.font)) result.font="source-serif"; result.paperSize=result.paperSize ?? "a4"; return result; }
function isSectionComplete(section:Section, resume:ResumeData) { switch(section) { case "contact": return Boolean(resume.fullName.trim() && resume.email.trim()); case "summary": return Boolean(resume.summary.trim()); case "experience": return resume.experience.some((item)=>item.role.trim() || item.company.trim()); case "education": return resume.education.some((item)=>item.school.trim() || item.degree.trim()); case "skills": return resume.skills.length > 0; case "projects": return resume.projects.some(Boolean); case "extras": return resume.certifications.length > 0 || resume.languages.length > 0; default: return false; } }
function formatEdited(value?:string) { if (!value) return "just now"; const date=new Date(value); if (Number.isNaN(date.valueOf())) return "recently"; return date.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  const titleId=useId();
  const root=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const container=root.current;
    const focusable=()=>Array.from(container?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')??[]);
    focusable()[0]?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeRef.current();return}
      if(event.key!=="Tab")return;
      const items=focusable();
      if(!items.length){event.preventDefault();container?.focus();return}
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus()}
      else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}
    };
    container?.addEventListener("keydown",onKeyDown);
    return()=>{container?.removeEventListener("keydown",onKeyDown);previous?.focus()};
  },[]);
  return <div className="modal-backdrop"><div ref={root} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="modal-top"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>{children}</div></div>;
}function Tailor({ resume, jobDescription, setJobDescription, match, coverLetter, setCoverLetter, onAi, onCoverLetter, exportText }: { resume:ResumeData; jobDescription:string; setJobDescription:(v:string)=>void; match:{score:number;found:string[];missing:string[]}; coverLetter:string; setCoverLetter:(v:string)=>void; onAi:(target?:{experience:number;bullet:number})=>void; onCoverLetter:()=>void; exportText:()=>void }) {
  const exportLetter=()=>{const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([coverLetter],{type:"text/plain"}));link.download="cover-letter.txt";link.click();URL.revokeObjectURL(link.href)};
  return <><div className="field"><label htmlFor="job-description">Paste the job description</label><textarea id="job-description" rows={11} value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} placeholder="Paste a job posting to see matching language from your resume…"/><span className="field-note">The match is based on terms already in your resume and this job description. It is a guide, not a hiring prediction.</span></div>{jobDescription.trim().length>30&&<><div className="entry-card" style={{display:"flex",alignItems:"center",gap:16}}><div style={{font:"400 32px Georgia",color:"var(--primary-text)"}}>{match.score}%</div><div><b style={{fontSize:12}}>Keyword overlap</b><p className="field-note">{match.found.length} matched terms in the text you provided</p></div></div><div className="field-grid"><div className="field"><label>Already in your resume</label><div className="tag-row">{match.found.slice(0,12).map((x,i)=><span className="tag" key={i}>{x}</span>)}</div></div><div className="field"><label>Not found in your resume</label><div className="tag-row">{match.missing.map((x,i)=><span className="tag warning" key={i}>{x}</span>)}</div><span className="field-note">Only add a missing term if it truthfully describes your experience.</span></div></div><div className="panel-heading" style={{marginTop:22}}><div><h2>Suggested edits</h2><p>Choose an existing bullet for a fact-preserving rewrite.</p></div></div>{resume.experience.flatMap((entry,i)=>entry.bullets.map((bullet,b)=>({entry,i,bullet,b}))).filter((item)=>item.bullet.trim()).map(({entry,i,bullet,b})=><div className="entry-card" key={`${i}-${b}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><p style={{fontSize:11,lineHeight:1.5,margin:0,flex:1}}><b>{entry.role}</b><br/>{bullet}</p><button className="button small ai-inline" onClick={()=>onAi({experience:i,bullet:b})}><SparklesIcon size={15}/>Suggest edit</button></div>)}<div className="modal-actions" style={{justifyContent:"flex-start"}}><button className="button ai-inline" onClick={onCoverLetter}><SparklesIcon size={15}/>Draft a cover letter</button><button className="button" onClick={exportText}><DownloadIcon size={15}/>Export plain text</button></div>{coverLetter&&<div className="field" style={{marginTop:20}}><label htmlFor="cover-letter">Cover letter draft</label><textarea id="cover-letter" rows={10} value={coverLetter} onChange={(e)=>setCoverLetter(e.target.value)}/><span className="field-note">Review names, claims and details before sending.</span><button className="button small" style={{alignSelf:"flex-start"}} onClick={exportLetter}><DownloadIcon size={15}/>Download cover letter</button></div>}</>}</>;
}
