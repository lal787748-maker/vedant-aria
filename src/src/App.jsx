import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity, X, ChevronRight, Stethoscope, AlertCircle,
  ArrowUpCircle, MinusCircle, CheckCircle, Mic, MicOff,
  Volume2, VolumeX, Zap, KeyRound
} from "lucide-react";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

const CATEGORY = {
  Critical: { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.28)", label: "CRITICAL",      order: 0, Icon: AlertCircle   },
  High:     { color: "#FB923C", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.28)",  label: "HIGH PRIORITY", order: 1, Icon: ArrowUpCircle  },
  Moderate: { color: "#FCD34D", bg: "rgba(252,211,77,0.1)",  border: "rgba(252,211,77,0.28)",  label: "MODERATE",      order: 2, Icon: MinusCircle    },
  Routine:  { color: "#4ADE80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.28)",  label: "ROUTINE",       order: 3, Icon: CheckCircle    },
};

const HOURS = [9,10,11,12,13,14,15,16,17];

const INITIAL_PATIENTS = {
  9:  [
    { id:"p1", name:"Priya Sharma",  category:"Critical", urgencyScore:9, primarySymptoms:"Severe chest pain, shortness of breath",        visitType:"first",     requiresSpecialist:true,  requiresLongerConsult:true,  estimatedDuration:60, doctorSummary:"45F presenting with acute chest pain and dyspnea. No prior cardiac history. Urgent ECG and troponin recommended. Cardiology referral advised.",                  referralType:"self-referred",   preExistingConditions:"None known",              medications:"None"               },
    { id:"p2", name:"Arun Mehta",    category:"High",     urgencyScore:7, primarySymptoms:"Persistent headache, blurred vision (3 days)",   visitType:"follow-up", requiresSpecialist:false, requiresLongerConsult:false, estimatedDuration:45, doctorSummary:"62M hypertensive on Amlodipine 5mg OD. Severe headache and new-onset vision blurring. Last BP 162/104. Hypertensive emergency to be ruled out; fundoscopy indicated.", referralType:"doctor-referred", preExistingConditions:"Hypertension (10 yrs)",    medications:"Amlodipine 5mg OD"  },
  ],
  10: [{ id:"p3", name:"Sunita Patel",  category:"Moderate", urgencyScore:4, primarySymptoms:"Persistent fatigue, elevated fasting glucose", visitType:"follow-up", requiresSpecialist:false, requiresLongerConsult:false, estimatedDuration:30, doctorSummary:"55F with T2DM, routine review. HbA1c 8.2% three months ago. On Metformin 500mg BD. Reports fatigue and diet difficulty. Medication review and nutrition counseling warranted.", referralType:"doctor-referred", preExistingConditions:"Type 2 Diabetes Mellitus", medications:"Metformin 500mg BD"  }],
  11: [{ id:"p4", name:"Rajan Desai",   category:"Routine",  urgencyScore:2, primarySymptoms:"Annual health checkup, no complaints",         visitType:"first",     requiresSpecialist:false, requiresLongerConsult:false, estimatedDuration:30, doctorSummary:"38M, no comorbidities. Presenting for routine annual check. BP, fasting glucose, CBC, and lipid panel indicated. Low clinical risk.",                                            referralType:"self-referred",   preExistingConditions:"None",                    medications:"None"               }],
  14: [{ id:"p5", name:"Kavita Joshi",  category:"High",     urgencyScore:6, primarySymptoms:"Acute lower back pain radiating to left leg",  visitType:"first",     requiresSpecialist:true,  requiresLongerConsult:false, estimatedDuration:45, doctorSummary:"42F with 5-day LBP and left leg radiation with paresthesia. L4/L5 herniation suspected. MRI lumbar spine recommended. Orthopedic referral warranted.",                       referralType:"self-referred",   preExistingConditions:"None",                    medications:"Ibuprofen 400mg PRN" }],
};

const SYSTEM_PROMPT = `You are ARIA, the AI receptionist for Vedant Imaging Center. You conduct warm, efficient intake questionnaires.

Your tone is caring, professional, and concise — like an excellent medical receptionist who genuinely cares about patients.

Gather these details naturally (combine related questions where appropriate):
1. Full name
2. Reason for visit and primary symptoms
3. Urgency/pain level (1–10 scale)
4. Pre-existing conditions or chronic illnesses
5. First visit or follow-up
6. Current medications or recent procedures
7. Doctor-referred or self-referred

Categorize as:
- Critical: Urgency 8–10, acute or life-threatening
- High: Urgency 6–7, significant symptoms
- Moderate: Urgency 3–5, subacute or ongoing
- Routine: Urgency 1–2, preventive or wellness

Also determine: requiresSpecialist, requiresLongerConsult, estimatedDuration (30/45/60), recommendedSlot (9–17).

When intake is complete, give ONE warm closing sentence. Then append exactly:

[INTAKE_COMPLETE]
{"patientName":"Full Name","category":"Critical","urgencyScore":8,"primarySymptoms":"...","preExistingConditions":"...","visitType":"first","medications":"...","referralType":"self-referred","requiresSpecialist":false,"requiresLongerConsult":false,"estimatedDuration":30,"doctorSummary":"2–3 sentence clinical briefing: demographics, key symptoms, history, suggested next steps.","recommendedSlot":"10"}

Exact category values: Critical, High, Moderate, Routine`;

const DEMO_STEPS = [
  "Meera Iyer",
  "I've been having really bad migraines for the past week, sometimes with nausea.",
  "I'd say about a 6 out of 10. The pain is behind my eyes mostly.",
  "No chronic conditions that I know of.",
  "This is my first visit here.",
  "I take paracetamol occasionally but nothing regular.",
  "I came on my own, not referred by a doctor.",
];

let nextId = 20;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function ApiKeyGate({ onKey }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ fontFamily:"'IBM Plex Sans',system-ui,sans-serif", background:"#07101F", color:"#DDE6F0", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#0C1828", border:"1px solid #172437", borderRadius:12, padding:"36px 32px", maxWidth:420, width:"100%", textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:12, background:"linear-gradient(135deg,#38BDF8,#3B82F6)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
          <KeyRound size={22} color="#fff" />
        </div>
        <div style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Anthropic API Key Required</div>
        <div style={{ fontSize:12.5, color:"#3A5570", lineHeight:1.7, marginBottom:24 }}>
          Enter your Anthropic API key to power ARIA.<br/>
          Your key is used only in this browser session and never stored.<br/>
          <span style={{ color:"#38BDF8" }}>For production: set <code style={{fontFamily:"'IBM Plex Mono',monospace", fontSize:11}}>VITE_ANTHROPIC_API_KEY</code> in your Vercel environment variables.</span>
        </div>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && val.trim() && onKey(val.trim())}
          placeholder="sk-ant-api03-..."
          type="password"
          style={{ width:"100%", background:"#101D2E", border:"1px solid #172437", borderRadius:8, padding:"10px 14px", color:"#DDE6F0", fontSize:13, fontFamily:"'IBM Plex Mono',monospace", outline:"none", boxSizing:"border-box", marginBottom:12 }}
          onFocus={e => e.target.style.borderColor = "#38BDF8"}
          onBlur={e => e.target.style.borderColor = "#172437"}
        />
        <button
          onClick={() => val.trim() && onKey(val.trim())}
          disabled={!val.trim()}
          style={{ width:"100%", padding:"10px 0", background: val.trim() ? "#38BDF8" : "#172437", color: val.trim() ? "#07101F" : "#3A5570", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor: val.trim() ? "pointer" : "default", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.04em" }}>
          LAUNCH ARIA
        </button>
        <div style={{ marginTop:14, fontSize:11, color:"#243040", fontFamily:"'IBM Plex Mono',monospace" }}>
          Get your key at console.anthropic.com
        </div>
      </div>
    </div>
  );
}

function ARIAFace({ state }) {
  const [blink, setBlink]     = useState(false);
  const [mouthRy, setMouthRy] = useState(2);

  useEffect(() => {
    let t;
    const doBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 110);
      t = setTimeout(doBlink, 2800 + Math.random() * 4000);
    };
    t = setTimeout(doBlink, 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (state !== "speaking") { setMouthRy(2); return; }
    const iv = setInterval(() => {
      setMouthRy(Math.random() > 0.25 ? 4 + Math.random() * 8 : 1.5);
    }, 110 + Math.random() * 60);
    return () => clearInterval(iv);
  }, [state]);

  const stateColor = { idle:"#4ADE80", thinking:"#FCD34D", listening:"#F87171", speaking:"#38BDF8" }[state] || "#4ADE80";
  const ringColor  = state === "listening" ? "rgba(248,113,113,0.5)" : "rgba(56,189,248,0.45)";

  return (
    <div style={{ position:"relative", width:170, height:200, margin:"0 auto" }}>
      {(state === "listening" || state === "speaking") && (<>
        <div style={{ position:"absolute", inset:-18, borderRadius:"50%", border:`1.5px solid ${ringColor}`, animation:"ariaRing1 1.6s ease-out infinite", pointerEvents:"none" }} />
        <div style={{ position:"absolute", inset:-34, borderRadius:"50%", border:`1px solid ${ringColor.replace("0.45","0.2").replace("0.5","0.2")}`, animation:"ariaRing2 1.6s ease-out 0.5s infinite", pointerEvents:"none" }} />
      </>)}
      <svg width="170" height="200" viewBox="0 0 170 200">
        <defs>
          <radialGradient id="fg" cx="50%" cy="38%" r="62%">
            <stop offset="0%"   stopColor="#1b344f" />
            <stop offset="100%" stopColor="#080f1c" />
          </radialGradient>
          <radialGradient id="eyeG" cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#a0f0ff" />
            <stop offset="55%"  stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0c6b8c" />
          </radialGradient>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softG" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect x="68" y="172" width="34" height="26" rx="5" fill="#080f1c" stroke="rgba(56,189,248,0.18)" strokeWidth="0.8" />
        <ellipse cx="85" cy="96" rx="68" ry="80" fill="url(#fg)" stroke="#38BDF8" strokeWidth="1.2" />
        <ellipse cx="85" cy="46" rx="30" ry="14" fill="rgba(56,189,248,0.06)" />
        <path d="M22 87 L42 87 L47 82 L63 82" stroke="rgba(56,189,248,0.14)" strokeWidth="0.7" fill="none"/>
        <path d="M148 87 L128 87 L123 82 L107 82" stroke="rgba(56,189,248,0.14)" strokeWidth="0.7" fill="none"/>
        <circle cx="42" cy="87" r="1.8" fill="rgba(56,189,248,0.35)" />
        <circle cx="128" cy="87" r="1.8" fill="rgba(56,189,248,0.35)" />
        <path d="M55 150 L42 158 L42 168" stroke="rgba(56,189,248,0.1)" strokeWidth="0.7" fill="none"/>
        <path d="M115 150 L128 158 L128 168" stroke="rgba(56,189,248,0.1)" strokeWidth="0.7" fill="none"/>
        <ellipse cx="60"  cy="90" rx="14" ry={blink ? 0.8 : 15} fill="#040a14" style={{ transition:"ry 0.08s ease" }} />
        <ellipse cx="110" cy="90" rx="14" ry={blink ? 0.8 : 15} fill="#040a14" style={{ transition:"ry 0.08s ease" }} />
        {!blink && (<>
          <circle cx="60"  cy="90" r="9" fill="url(#eyeG)" filter="url(#glow)" />
          <circle cx="110" cy="90" r="9" fill="url(#eyeG)" filter="url(#glow)" />
          <circle cx="60"  cy="90" r="4.5" fill="#040e1c" />
          <circle cx="110" cy="90" r="4.5" fill="#040e1c" />
          <circle cx="62.5" cy="87" r="2.5" fill="rgba(255,255,255,0.88)" />
          <circle cx="112.5" cy="87" r="2.5" fill="rgba(255,255,255,0.88)" />
          <circle cx="60"  cy="90" r="9" fill="none" stroke="rgba(160,240,255,0.25)" strokeWidth="1" />
          <circle cx="110" cy="90" r="9" fill="none" stroke="rgba(160,240,255,0.25)" strokeWidth="1" />
          <path d="M46 84 Q60 80 74 84" stroke="rgba(56,189,248,0.25)" strokeWidth="0.8" fill="none" />
          <path d="M96 84 Q110 80 124 84" stroke="rgba(56,189,248,0.25)" strokeWidth="0.8" fill="none" />
        </>)}
        <path d="M82 112 Q85 120 88 112" stroke="rgba(56,189,248,0.22)" strokeWidth="1" fill="none" strokeLinecap="round" />
        <ellipse cx="85" cy="140" rx="19" ry={mouthRy}
          fill={mouthRy > 3 ? "rgba(4,10,20,0.95)" : "none"}
          stroke="#38BDF8" strokeWidth="1.1"
          filter={mouthRy > 4 ? "url(#glow)" : undefined}
          style={{ transition:"ry 0.09s ease" }} />
        <ellipse cx="85" cy="172" rx="28" ry="5" fill="rgba(56,189,248,0.05)" />
        <circle cx="85" cy="24" r="4" fill={stateColor} filter="url(#softG)"
          style={{ animation: state !== "idle" ? "ledPulse 0.9s ease infinite" : "none" }} />
        <circle cx="85" cy="24" r="2" fill="white" opacity="0.5" />
        {state === "thinking" && [0,1,2].map(i => (
          <circle key={i} cx={72 + i * 13} cy="162" r="3.5"
            fill="#FCD34D" opacity="0.8"
            style={{ animation:`thinkDot 1.1s ease ${i * 0.22}s infinite` }} />
        ))}
      </svg>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(API_KEY);
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hello! I'm ARIA, your AI receptionist at Vedant Imaging Center. I'm here to help get you checked in quickly. Could you start by telling me your full name?" }
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [schedule, setSchedule] = useState(INITIAL_PATIENTS);
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [avatarState,  setAvatarState]  = useState("idle");
  const [ttsEnabled,   setTtsEnabled]   = useState(true);
  const [isListening,  setIsListening]  = useState(false);
  const [interim,      setInterim]      = useState("");
  const [voiceMsg,     setVoiceMsg]     = useState("");
  const [demoIdx,      setDemoIdx]      = useState(0);
  const chatEndRef     = useRef(null);
  const recognitionRef = useRef(null);
  const prevMsgLen     = useRef(1);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading, interim]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  const speak = useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.0;
    utt.pitch = 1.05;
    const voices    = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /Samantha|Karen|Moira|Victoria|Susan|Zoe|Emma|Amy|Alice/i.test(v.name)) ||
                      voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setAvatarState("speaking");
    utt.onend   = () => setAvatarState("idle");
    utt.onerror = () => setAvatarState("idle");
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  useEffect(() => {
    if (messages.length <= prevMsgLen.current) return;
    prevMsgLen.current = messages.length;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") speak(last.content);
  }, [messages, speak]);

  useEffect(() => {
    if (loading) setAvatarState("thinking");
  }, [loading]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setAvatarState("idle");
    setInterim("");
  }, []);

  const startListeningWithAutoSend = useCallback(() => {
    if (!SpeechRec) {
      setVoiceMsg("⚠ Speech recognition not supported. Use Chrome, Edge, or Safari.");
      return;
    }
    window.speechSynthesis?.cancel();
    setAvatarState("listening");
    setVoiceMsg("");
    setInterim("");
    const rec = new SpeechRec();
    rec.lang           = "en-IN";
    rec.continuous     = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let final = "", inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += t) : (inter += t);
      }
      if (final) {
        setInterim("");
        setInput(final.trim());
        setTimeout(() => sendText(final.trim()), 350);
      } else {
        setInterim(inter);
      }
    };
    rec.onerror = (e) => {
      setIsListening(false);
      setAvatarState("idle");
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setVoiceMsg("🔒 Microphone blocked. Click the lock icon in your browser address bar → allow microphone → refresh.");
      } else if (e.error === "no-speech") {
        setVoiceMsg("No speech detected. Tap mic and try again.");
      } else {
        setVoiceMsg(`Voice error: ${e.error}`);
      }
    };
    rec.onend = () => {
      setIsListening(false);
      setAvatarState(s => s === "listening" ? "idle" : s);
      setInterim("");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, []);

  const runDemoStep = useCallback(() => {
    if (demoIdx >= DEMO_STEPS.length || loading) return;
    const response = DEMO_STEPS[demoIdx];
    setDemoIdx(p => p + 1);
    setVoiceMsg(`🎭 Demo: "${response}"`);
    let i = 0;
    setInput("");
    const iv = setInterval(() => {
      i++;
      setInput(response.slice(0, i));
      if (i >= response.length) {
        clearInterval(iv);
        setTimeout(() => sendText(response), 400);
      }
    }, 18);
  }, [demoIdx, loading]);

  const parseIntake = (text) => {
    const idx = text.indexOf("[INTAKE_COMPLETE]");
    if (idx === -1) return null;
    try { return JSON.parse(text.slice(idx + 17).trim()); }
    catch { return null; }
  };

  const addToSchedule = (data) => {
    const id   = `p${nextId++}`;
    const slot = Math.min(17, Math.max(9, parseInt(data.recommendedSlot) || 10));
    const patient = { id, name: data.patientName, ...data };
    setSchedule(prev => {
      const upd = { ...prev };
      upd[slot] = [...(upd[slot] || []), patient]
        .sort((a, b) => CATEGORY[a.category].order - CATEGORY[b.category].order);
      return upd;
    });
    setToast(patient);
    setSelected(patient);
    setTimeout(() => setToast(null), 5000);
    setTimeout(() => {
      setMessages([{ role:"assistant", content:"Hello! I'm ARIA, your AI receptionist at Vedant Imaging Center. I'm here to help get you checked in quickly. Could you start by telling me your full name?" }]);
      prevMsgLen.current = 1;
      setDemoIdx(0);
      setVoiceMsg("");
    }, 5000);
  };

  const sendText = async (text) => {
    const trimmed = (typeof text === "string" ? text : input).trim();
    if (!trimmed || loading) return;
    const userMsg = { role:"user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system:     SYSTEM_PROMPT,
          messages:   history.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data   = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw    = data.content?.[0]?.text || "Sorry, I couldn't process that. Please try again.";
      const intake = parseIntake(raw);
      const display = intake ? raw.slice(0, raw.indexOf("[INTAKE_COMPLETE]")).trim() : raw;
      setMessages(prev => [...prev, { role:"assistant", content: display, done: !!intake }]);
      if (intake) addToSchedule(intake);
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Error: ${err.message || "Connection failed. Please try again."}` }]);
    } finally {
      setLoading(false);
    }
  };

  const totalPts    = Object.values(schedule).flat().length;
  const critCount   = Object.values(schedule).flat().filter(p => p.category === "Critical").length;
  const formatHour  = h => h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : `${h} AM`;
  const currentHour = new Date().getHours();

  if (!apiKey) return <ApiKeyGate onKey={setApiKey} />;

  return (
    <div style={{ fontFamily:"'IBM Plex Sans',system-ui,sans-serif", background:"#07101F", color:"#DDE6F0", minHeight:"100vh", display:"flex", flexDirection:"column", fontSize:14 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#172437;border-radius:2px}
        ::-webkit-scrollbar-track{background:transparent}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes ariaRing1{0%{transform:scale(1);opacity:0.85}100%{transform:scale(1.5);opacity:0}}
        @keyframes ariaRing2{0%{transform:scale(1);opacity:0.5}100%{transform:scale(1.6);opacity:0}}
        @keyframes ledPulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes thinkDot{0%,100%{transform:translateY(0);opacity:0.8}50%{transform:translateY(-5px);opacity:1}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,0.6)}70%{box-shadow:0 0 0 10px rgba(248,113,113,0)}}
        @keyframes waveBar{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)}}
        @keyframes speakBar{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <header style={{ background:"#0C1828", borderBottom:"1px solid #172437", padding:"0 20px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:"linear-gradient(135deg,#38BDF8,#3B82F6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Activity size={15} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight:600, fontSize:13.5, letterSpacing:"0.01em" }}>Vedant Imaging Center</div>
            <div style={{ fontSize:9.5, color:"#3A5570", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.07em" }}>AI SCHEDULING SYSTEM</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          <HStat label="PATIENTS" value={totalPts} />
          <HStat label="CRITICAL" value={critCount} color="#F87171" />
          <div style={{ fontSize:10.5, fontFamily:"'IBM Plex Mono',monospace", color:"#38BDF8", background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.18)", borderRadius:5, padding:"3px 9px" }}>
            {new Date().toLocaleDateString("en-IN",{ weekday:"short", day:"numeric", month:"short", year:"numeric" })}
          </div>
        </div>
      </header>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        <div style={{ width:"36%", display:"flex", flexDirection:"column", borderRight:"1px solid #172437", background:"#080f1c" }}>
          <div style={{ padding:"18px 16px 10px", borderBottom:"1px solid #172437", background:"linear-gradient(180deg,#0a1628 0%,#080f1c 100%)", flexShrink:0 }}>
            <ARIAFace state={avatarState} />
            <div style={{ textAlign:"center", marginTop:10 }}>
              <div style={{ fontSize:15, fontWeight:600, letterSpacing:"0.04em", color:"#DDE6F0" }}>ARIA</div>
              <div style={{ fontSize:9.5, color:"#3A5570", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.08em", marginTop:2 }}>
                {avatarState === "listening" ? "● LISTENING" :
                 avatarState === "speaking"  ? "● SPEAKING"  :
                 avatarState === "thinking"  ? "● PROCESSING" : "AI RECEPTIONIST"}
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:10, gap:6 }}>
              <button onClick={() => { setTtsEnabled(p => !p); window.speechSynthesis?.cancel(); setAvatarState("idle"); }}
                style={{ background: ttsEnabled ? "rgba(56,189,248,0.1)" : "#101D2E", border:`1px solid ${ttsEnabled ? "rgba(56,189,248,0.3)" : "#172437"}`, borderRadius:6, padding:"4px 10px", cursor:"pointer", color: ttsEnabled ? "#38BDF8" : "#3A5570", fontSize:9.5, fontFamily:"'IBM Plex Mono',monospace", display:"flex", alignItems:"center", gap:5 }}>
                {ttsEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
                {ttsEnabled ? "AI VOICE ON" : "AI VOICE OFF"}
              </button>
            </div>
          </div>

          {voiceMsg && (
            <div style={{ padding:"8px 14px", background:"rgba(251,146,60,0.07)", borderBottom:"1px solid rgba(251,146,60,0.18)", fontSize:10.5, color:"#FB923C", lineHeight:1.55, animation:"fadeIn 0.2s ease" }}>
              {voiceMsg}
            </div>
          )}
          {interim && (
            <div style={{ padding:"6px 14px", background:"rgba(248,113,113,0.05)", borderBottom:"1px solid rgba(248,113,113,0.12)", fontSize:11.5, color:"rgba(248,113,113,0.75)", fontStyle:"italic" }}>
              "{interim}"
            </div>
          )}

          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && <Dots />}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding:"10px 14px 12px", borderTop:"1px solid #172437", flexShrink:0 }}>
            {isListening && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:3, height:20, marginBottom:8 }}>
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ width:3, height:18, background:"#F87171", borderRadius:2, transformOrigin:"bottom", animation:`waveBar 0.6s ease-in-out ${(i*0.1).toFixed(1)}s infinite` }} />
                ))}
              </div>
            )}
            {avatarState === "speaking" && !isListening && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:3, height:20, marginBottom:8 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width:3, height:[10,18,13,16][i], background:"#38BDF8", borderRadius:2, animation:`speakBar 0.7s ease-in-out ${(i*0.18).toFixed(2)}s infinite` }} />
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:5 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendText()}
                disabled={loading}
                placeholder={isListening ? "Listening… speak now" : "Type or use mic…"}
                style={{ flex:1, background:"#101D2E", border:`1px solid ${isListening ? "rgba(248,113,113,0.5)" : "#172437"}`, borderRadius:7, padding:"8px 11px", color:"#DDE6F0", fontSize:12, fontFamily:"inherit", outline:"none", transition:"border-color 0.15s" }}
                onFocus={e => !isListening && (e.target.style.borderColor="#38BDF8")}
                onBlur={e =>  !isListening && (e.target.style.borderColor="#172437")}
              />
              <button onClick={() => isListening ? stopListening() : startListeningWithAutoSend()} disabled={loading}
                style={{ width:36, height:36, borderRadius:7, border:"none", flexShrink:0, cursor: loading ? "default" : "pointer", background: isListening ? "#EF4444" : "rgba(248,113,113,0.12)", color: isListening ? "#fff" : "#F87171", display:"flex", alignItems:"center", justifyContent:"center", animation: isListening ? "micPulse 1.3s ease infinite" : "none", transition:"all 0.18s" }}>
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button onClick={() => sendText()} disabled={!input.trim() || loading}
                style={{ width:36, height:36, borderRadius:7, border:"none", flexShrink:0, cursor: input.trim() && !loading ? "pointer" : "default", background: input.trim() && !loading ? "#38BDF8" : "#172437", color: input.trim() && !loading ? "#07101F" : "#3A5570", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                <ChevronRight size={16} />
              </button>
            </div>
            <button onClick={runDemoStep} disabled={loading || demoIdx >= DEMO_STEPS.length}
              style={{ width:"100%", marginTop:7, background:"rgba(252,211,77,0.07)", border:"1px solid rgba(252,211,77,0.2)", borderRadius:6, padding:"6px 0", color: demoIdx >= DEMO_STEPS.length ? "#3A5570" : "#FCD34D", fontSize:9.5, fontFamily:"'IBM Plex Mono',monospace", cursor: loading || demoIdx >= DEMO_STEPS.length ? "default" : "pointer", letterSpacing:"0.05em", display:"flex", alignItems:"center", justifyContent:"center", gap:5, transition:"all 0.15s" }}>
              <Zap size={10} />
              {demoIdx >= DEMO_STEPS.length ? "DEMO COMPLETE" : `DEMO STEP ${demoIdx+1}/${DEMO_STEPS.length}`}
            </button>
          </div>
        </div>

        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"11px 16px", borderBottom:"1px solid #172437", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0C1828", flexShrink:0 }}>
            <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:"#38BDF8", letterSpacing:"0.07em" }}>HOURLY SCHEDULE</div>
            <div style={{ display:"flex", gap:12 }}>
              {Object.entries(CATEGORY).map(([k,v]) => (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9.5 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:v.color }} />
                  <span style={{ color:"#3A5570", fontFamily:"'IBM Plex Mono',monospace" }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
              {HOURS.map(h => (
                <HourRow key={h} hour={h} patients={schedule[h]||[]} currentHour={currentHour}
                  selected={selected} onSelect={p => setSelected(prev => prev?.id===p.id ? null : p)}
                  formatHour={formatHour} newId={toast?.id} />
              ))}
            </div>
            {selected && (
              <div style={{ width:"41%", borderLeft:"1px solid #172437", overflowY:"auto", padding:"18px 16px", background:"#0C1828" }}>
                <Detail patient={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:18, right:18, background:"#0C1828", border:`1px solid ${CATEGORY[toast.category].color}`, borderRadius:10, padding:"11px 15px", maxWidth:272, boxShadow:"0 8px 28px rgba(0,0,0,0.5)", zIndex:99 }}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:CATEGORY[toast.category].color, marginBottom:3, letterSpacing:"0.06em" }}>✓ PATIENT SCHEDULED</div>
          <div style={{ fontWeight:600, fontSize:13.5 }}>{toast.name}</div>
          <div style={{ fontSize:11, color:"#3A5570", marginTop:2 }}>
            {CATEGORY[toast.category].label} · {formatHour(Math.min(17,Math.max(9,parseInt(toast.recommendedSlot)||10)))} block · {toast.estimatedDuration}min
          </div>
        </div>
      )}
    </div>
  );
}

function HStat({ label, value, color }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:17, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace", color:color||"#DDE6F0" }}>{value}</div>
      <div style={{ fontSize:8.5, color:"#3A5570", letterSpacing:"0.05em" }}>{label}</div>
    </div>
  );
}

function Bubble({ msg }) {
  const isAI = msg.role === "assistant";
  return (
    <div style={{ display:"flex", justifyContent: isAI?"flex-start":"flex-end", animation:"fadeIn 0.2s ease" }}>
      <div style={{ maxWidth:"88%", background: isAI?"#0d1c2e":"rgba(56,189,248,0.09)", border:`1px solid ${isAI?"#172437":"rgba(56,189,248,0.2)"}`, borderRadius: isAI?"3px 9px 9px 9px":"9px 3px 9px 9px", padding:"9px 12px", fontSize:12.5, lineHeight:1.68, color:"#C8D8E8" }}>
        {msg.content}
        {msg.done && (
          <div style={{ marginTop:7, paddingTop:7, borderTop:"1px solid #172437", fontSize:9.5, color:"#4ADE80", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"0.04em" }}>
            ✓ INTAKE COMPLETE — SCHEDULED
          </div>
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display:"flex", gap:5, padding:"9px 12px", background:"#0d1c2e", border:"1px solid #172437", borderRadius:"3px 9px 9px 9px", width:"fit-content" }}>
      {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:"#3A5570", animation:`blink 1.2s ease ${i*0.22}s infinite` }} />)}
    </div>
  );
}

function HourRow({ hour, patients, currentHour, selected, onSelect, formatHour, newId }) {
  const isPast    = hour < currentHour;
  const isCurrent = hour === currentHour;
  const totalMins = patients.reduce((s,p) => s+(p.estimatedDuration||30), 0);
  const load      = Math.min(100, Math.round((totalMins/60)*100));
  return (
    <div style={{ display:"flex", gap:10, marginBottom:9, opacity: isPast?0.42:1 }}>
      <div style={{ width:50, flexShrink:0, paddingTop:9, textAlign:"right" }}>
        <div style={{ fontSize:10.5, fontFamily:"'IBM Plex Mono',monospace", color: isCurrent?"#38BDF8":"#3A5570" }}>{formatHour(hour)}</div>
        {isCurrent && <div style={{ fontSize:7.5, color:"#38BDF8", marginTop:1, letterSpacing:"0.06em" }}>NOW</div>}
      </div>
      <div style={{ flex:1 }}>
        {patients.length === 0 ? (
          <div style={{ border:"1px dashed #172437", borderRadius:7, padding:"9px 12px", fontSize:10.5, color:"#243040", fontFamily:"'IBM Plex Mono',monospace" }}>— Available</div>
        ) : (<>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
            <div style={{ flex:1, height:2, background:"#172437", borderRadius:1 }}>
              <div style={{ width:`${load}%`, height:"100%", background: load>90?"#F87171":load>70?"#FB923C":"#38BDF8", borderRadius:1, transition:"width 0.4s ease" }} />
            </div>
            <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#3A5570", flexShrink:0 }}>{totalMins}m/60m</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {patients.map(p => <PCard key={p.id} patient={p} isSelected={selected?.id===p.id} isNew={newId===p.id} onSelect={() => onSelect(p)} />)}
          </div>
        </>)}
      </div>
    </div>
  );
}

function PCard({ patient, isSelected, isNew, onSelect }) {
  const cat = CATEGORY[patient.category];
  const CatIcon = cat.Icon;
  return (
    <div onClick={onSelect} style={{ background: isSelected?cat.bg:"#0C1828", border:`1px solid ${isNew||isSelected?cat.color:"#172437"}`, borderRadius:7, padding:"8px 11px", cursor:"pointer", display:"flex", alignItems:"center", gap:9, transition:"all 0.18s", boxShadow: isNew?`0 0 12px ${cat.color}28`:"none" }}>
      <div style={{ color:cat.color, flexShrink:0, display:"flex" }}><CatIcon size={16} /></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontWeight:500, fontSize:12.5 }}>{patient.name}</span>
          {patient.requiresSpecialist && <span style={{ fontSize:8.5, background:"rgba(251,146,60,0.12)", color:"#FB923C", border:"1px solid rgba(251,146,60,0.25)", borderRadius:3, padding:"1px 5px", fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>SPECIALIST</span>}
        </div>
        <div style={{ fontSize:11, color:"#3A5570", marginTop:1.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{patient.primarySymptoms}</div>
      </div>
      <div style={{ flexShrink:0, textAlign:"right" }}>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:cat.color }}>{cat.label}</div>
        <div style={{ fontSize:10, color:"#3A5570", marginTop:1 }}>{patient.estimatedDuration}m</div>
      </div>
      <div style={{ width:22, height:22, borderRadius:5, background:cat.bg, border:`1px solid ${cat.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:10.5, fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, color:cat.color }}>
        {patient.urgencyScore}
      </div>
    </div>
  );
}

function Detail({ patient, onClose }) {
  const cat = CATEGORY[patient.category];
  const CatIcon = cat.Icon;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
            <CatIcon size={12} color={cat.color} />
            <span style={{ fontSize:9.5, fontFamily:"'IBM Plex Mono',monospace", color:cat.color, letterSpacing:"0.05em" }}>{cat.label}</span>
          </div>
          <div style={{ fontSize:16.5, fontWeight:600 }}>{patient.name}</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"1px solid #172437", color:"#3A5570", cursor:"pointer", width:28, height:28, borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ background:cat.bg, border:`1px solid ${cat.border}`, borderRadius:7, padding:"10px 12px", marginBottom:14 }}>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:cat.color, marginBottom:5, letterSpacing:"0.05em" }}>URGENCY SCORE</div>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:24, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace", color:cat.color }}>{patient.urgencyScore}</span>
          <span style={{ fontSize:11, color:"#3A5570" }}>/10</span>
          <div style={{ flex:1, height:3, background:"#172437", borderRadius:1.5, marginLeft:5 }}>
            <div style={{ width:`${patient.urgencyScore*10}%`, height:"100%", background:cat.color, borderRadius:1.5, transition:"width 0.4s" }} />
          </div>
        </div>
      </div>
      <DRow label="PRIMARY SYMPTOMS" val={patient.primarySymptoms} />
      {patient.preExistingConditions && patient.preExistingConditions !== "None" && <DRow label="PRE-EXISTING CONDITIONS" val={patient.preExistingConditions} />}
      <DRow label="VISIT TYPE" val={patient.visitType==="first"?"First Visit":"Follow-up Appointment"} />
      {patient.medications && patient.medications !== "None" && <DRow label="CURRENT MEDICATIONS" val={patient.medications} />}
      <DRow label="REFERRAL" val={patient.referralType==="doctor-referred"?"Doctor Referred":"Self-referred"} />
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, margin:"12px 0" }}>
        {patient.requiresSpecialist    && <Pill label="Specialist Required" c="#FB923C" />}
        {patient.requiresLongerConsult && <Pill label="Extended Consult"    c="#FCD34D" />}
        <Pill label={`${patient.estimatedDuration} min slot`} c="#3A5570" />
      </div>
      <div style={{ background:"#101D2E", border:"1px solid #172437", borderRadius:7, padding:"12px" }}>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#38BDF8", marginBottom:7, letterSpacing:"0.07em", display:"flex", alignItems:"center", gap:5 }}>
          <Stethoscope size={10} /> DOCTOR BRIEFING
        </div>
        <div style={{ fontSize:12, color:"#A8BCCF", lineHeight:1.75 }}>{patient.doctorSummary}</div>
      </div>
    </div>
  );
}

function DRow({ label, val }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:"#3A5570", marginBottom:2.5, letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ fontSize:12.5, color:"#C4D4E0" }}>{val}</div>
    </div>
  );
}

function Pill({ label, c }) {
  return (
    <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:c, background:`${c}14`, border:`1px solid ${c}30`, borderRadius:4, padding:"2px 7px" }}>
      {label}
    </span>
  );
}
