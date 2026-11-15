"use client";
import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignInPage() {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSignup(new URLSearchParams(window.location.search).get("mode") === "signup"); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (signup) {
        const response = await fetch("/api/signup", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ name,email,password }) });
        const data = await response.json();
        if (!response.ok) { setError(data.error); setBusy(false); return; }
      }
      const result = await signIn("credentials", { email, password, redirect:false });
      if (result?.error) { setError("We could not sign you in with those details."); setBusy(false); return; }
      window.location.assign("/");
    } catch { setError("Something went wrong. Please try again."); setBusy(false); }
  };
  return <main className="signin-layout">
    <section className="signin-story"><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}><a href="/" className="brand" style={{textDecoration:"none",color:"inherit"}}><span className="brand-mark" aria-hidden="true">f</span> forme</a><ThemeToggle/></div><div className="signin-story-copy"><div className="eyebrow">A thoughtful resume workspace</div><h1>Your experience, clearly told.</h1><p>Build a resume from the facts you know. Get careful suggestions, stay in control, and keep every detail true to you.</p></div><span className="signin-footer">Your resume stays yours.</span></section>
    <section className="signin-panel"><div className="signin-form-wrap"><a href="/" className="signin-back">← Back to editor</a><h2>{signup?"Create your account":"Welcome back"}</h2><p className="signin-subtitle">{signup?"Save your work and access your resumes anywhere.":"Sign in to continue to your resumes."}</p><button className="button primary" style={{width:"100%"}} onClick={()=>void signIn("google",{callbackUrl:"/"})}>Continue with Google</button><div className="signin-separator"><span/>or with email<span/></div><form onSubmit={(e)=>void submit(e)} style={{display:"grid",gap:12}}>{signup&&<div className="field"><label htmlFor="name">Your name</label><input id="name" autoComplete="name" placeholder="e.g. Ada Okafor" required value={name} onChange={(e)=>setName(e.target.value)}/></div>}<div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e)=>setEmail(e.target.value)}/></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={signup?"new-password":"current-password"} placeholder={signup?"At least 10 characters":"Enter your password"} minLength={signup?10:1} required value={password} onChange={(e)=>setPassword(e.target.value)}/>{signup&&<span className="field-note">Use at least 10 characters.</span>}</div>{error&&<div role="alert" style={{fontSize:12,color:"var(--brick)"}}>{error}</div>}<button className="button primary" disabled={busy} style={{width:"100%",marginTop:4}}>{busy?"Please wait…":signup?"Create account":"Sign in"}</button></form><p style={{fontSize:12,textAlign:"center",color:"var(--slate)",marginTop:20}}>{signup?"Already have an account?":"New to Forme?"} <button className="add-link" style={{padding:0}} onClick={()=>{setSignup(!signup);setError("")}}>{signup?"Sign in":"Create an account"}</button></p><p className="signin-legal">By continuing, you agree to use Forme responsibly. Review your resume for accuracy before sharing it. <a href="/privacy">Privacy notice</a>.</p></div></section>
  </main>;
}
