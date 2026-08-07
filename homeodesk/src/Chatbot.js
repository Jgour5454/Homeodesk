import React, { useState, useRef, useEffect } from 'react';

/* ─────────────────────────────────────────────
   DESIGN TOKENS (kept local so this file can be
   dropped into any page without extra wiring)
───────────────────────────────────────────── */
const C = {
  greenDark: '#0d2b1e', green: '#1B4332', greenMid: '#2d6a4f',
  sage: '#52B788', gold: '#C9A84C', cream: '#F8F5F0',
};

/* ─────────────────────────────────────────────
   KNOWLEDGE BASE
   Everything the bot "knows" lives here — no
   external API calls, so it works instantly and
   for free. Swap `getBotReply` for a real API call
   later if you want a smarter model behind it.
───────────────────────────────────────────── */

// Symptom → suggested care focus. Since the clinic has a single doctor
// (Dr. Isha Khimani) who treats all of these, "suggesting a doctor" here
// means routing the patient to the right consultation type + care focus
// and pre-filling their concern, rather than picking between doctors.
const SYMPTOM_ROUTES = [
  {
    keywords: ['migraine', 'headache', 'head pain', 'head ache'],
    focus: 'Chronic Headache & Migraine Care',
    reply: "Recurring headaches or migraines are one of Dr. Khimani's focus areas. A first visit is usually best in-clinic so she can take a full case history.",
    concern: 'Recurring headaches / migraine',
    type: 'in-clinic',
  },
  {
    keywords: ['skin', 'rash', 'eczema', 'acne', 'psoriasis', 'allergy on skin', 'itching'],
    focus: 'Skin Disorders',
    reply: 'Skin concerns like this respond well to homeopathic treatment. Dr. Khimani will want to see the affected area, so an in-clinic visit (or a clear photo shared during an online consult) works best.',
    concern: 'Skin issue (rash/allergy/acne)',
    type: 'in-clinic',
  },
  {
    keywords: ['child', 'kid', 'son', 'daughter', 'baby', 'infant', 'toddler', 'pediatric'],
    focus: 'Pediatric Care',
    reply: "Dr. Khimani sees children regularly and tailors gentle, low-dose treatment for them. It's helpful to bring (or describe) recent growth/vaccination records if you have them.",
    concern: "Child's health concern",
    type: 'in-clinic',
  },
  {
    keywords: ['stress', 'anxiety', 'anxious', 'low mood', 'overwhelmed', 'panic', 'sleep', 'insomnia', "can't sleep", 'cant sleep'],
    focus: 'Mental Wellness & Sleep Support',
    reply: "Stress, sleep trouble, and low mood are things Dr. Khimani supports alongside conventional care — homeopathy here works best as a complement, not a replacement for therapy or medical treatment if you're already receiving it.",
    concern: 'Stress / sleep / mood support',
    type: 'online',
  },
  {
    keywords: ['period', 'pcos', 'pcod', 'hormonal', 'menstrual', 'irregular periods', 'pregnancy', 'fertility', "women's health", 'womens health'],
    focus: "Women's Health",
    reply: "Hormonal and menstrual health is one of Dr. Khimani's specialties, including PCOS/PCOD support. She'll likely ask about your cycle history in detail.",
    concern: "Women's health / hormonal concern",
    type: 'in-clinic',
  },
  {
    keywords: ['joint pain', 'arthritis', 'back pain', 'knee pain', 'body pain', 'muscle pain'],
    focus: 'Chronic Pain & Joint Care',
    reply: 'For joint or chronic pain, an in-clinic visit lets Dr. Khimani examine movement and pain patterns directly.',
    concern: 'Joint / chronic pain',
    type: 'in-clinic',
  },
  {
    keywords: ['asthma', 'breathing', 'breathless', 'wheeze', 'cough', 'cold', 'sinus', 'sinusitis', 'allergy', 'allergies'],
    focus: 'Respiratory & Allergy Care',
    reply: 'Respiratory and allergy complaints are treated regularly here. An online consult is fine to start if symptoms are mild and manageable.',
    concern: 'Respiratory / allergy issue',
    type: 'online',
  },
  {
    keywords: ['stomach', 'digestion', 'acidity', 'constipation', 'ibs', 'bloating', 'gas'],
    focus: 'Digestive Health',
    reply: 'Digestive issues often connect to diet and routine — Dr. Khimani may also point you to one of our diet plans alongside treatment.',
    concern: 'Digestive health concern',
    type: 'online',
  },
  {
    keywords: ['fatigue', 'tired', 'low energy', 'weakness', 'immunity', 'immune'],
    focus: 'Fatigue & Immunity Care',
    reply: 'Persistent fatigue or low immunity is worth a proper consult to look at the full picture rather than just one symptom.',
    concern: 'Fatigue / immunity concern',
    type: 'online',
  },
];

// Red-flag / emergency terms — the bot should never try to "handle" these,
// only redirect to urgent/emergency care immediately.
const EMERGENCY_KEYWORDS = [
  'chest pain', 'cant breathe', "can't breathe", 'difficulty breathing', 'severe bleeding',
  'unconscious', 'stroke', 'heart attack', 'suicidal', 'suicide', 'kill myself', 'self harm', 'self-harm',
  'overdose', 'seizure', 'not breathing', 'severe allergic reaction', 'anaphylaxis',
];

const FAQS = [
  {
    keywords: ['what is homeopathy', 'homeopathy', 'how does it work'],
    reply: "Homeopathy is a natural system of medicine that uses highly diluted substances to stimulate the body's own healing response. It's used here for chronic conditions, allergies, hormonal issues, and general wellness — gently and with minimal side effects.",
  },
  {
    keywords: ['side effect', 'side effects', 'safe', 'safety'],
    reply: 'Homeopathic remedies are generally very gentle with minimal side effects, but you should always share your full medical history and any medicines you take with Dr. Khimani during your consultation.',
  },
  {
    keywords: ['timing', 'timings', 'hours', 'open', 'closed', 'when are you open'],
    reply: 'Clinic hours are Mon–Sat, 9:00 AM – 7:00 PM, and Sunday 10 AM – 1 PM (online only).',
  },
  {
    keywords: ['address', 'location', 'where are you', 'clinic location'],
    reply: 'The clinic is at 204 Wellness Tower, CG Road, Ahmedabad, Gujarat 380009.',
  },
  {
    keywords: ['price', 'cost', 'fee', 'fees', 'charge', 'charges'],
    reply: "Fees vary by consultation type. Please call +91 99999 88888 or ask during booking and our team will confirm exact pricing before your appointment.",
  },
  {
    keywords: ['cancel', 'reschedule', 'change appointment'],
    reply: "You can cancel or manage a booking from your patient dashboard after logging in. If you booked without an account, call the clinic at +91 99999 88888 and we'll help you reschedule.",
  },
  {
    keywords: ['online consult', 'video call', 'video consultation'],
    reply: 'Online consultations happen over a secure video call. Once booked, a Zoom/Meet link is sent to your email and WhatsApp, and a free 15-minute follow-up is included within 7 days.',
  },
  {
    keywords: ['diet', 'diet plan', 'food', 'nutrition'],
    reply: 'We offer condition-based diet plans (anti-inflammatory, hormone-balancing, immunity-boosting, and more) that complement your treatment. Check the "Diet Plans" tab, or your doctor can assign one during your consult.',
  },
  {
    keywords: ['contact', 'phone number', 'call you'],
    reply: 'You can reach the clinic at +91 99999 88888 or contact@homeodesk.in.',
  },
];

const GREETING_WORDS = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening'];
const BOOKING_WORDS = ['book', 'appointment', 'schedule', 'slot', 'consult', 'consultation'];
const THANKS_WORDS = ['thank', 'thanks', 'thank you'];

function matches(text, keywords) {
  return keywords.some(k => text.includes(k));
}

function getBotReply(rawText) {
  const text = rawText.toLowerCase().trim();

  if (matches(text, EMERGENCY_KEYWORDS)) {
    return {
      text: "This sounds urgent. Please don't wait for an online consultation — call your local emergency number right away (in India: 112) or go to the nearest emergency room. If this is about thoughts of self-harm, you can also reach AASRA at 91-9820466726 (24/7) or iCall at 9152987821 for immediate support.",
      chips: [],
    };
  }

  // Symptom routing — check all matching categories, not just the first
  const routeMatches = SYMPTOM_ROUTES.filter(r => matches(text, r.keywords));
  if (routeMatches.length > 0) {
    const r = routeMatches[0];
    return {
      text: `${r.reply}\n\nSuggested focus: **${r.focus}**. Want me to start a booking with this pre-filled?`,
      action: { concern: r.concern, type: r.type, label: '📅 Book Now — ' + r.focus },
      chips: ['Book Now', 'Something else'],
      note: 'This is general guidance, not a diagnosis — Dr. Khimani will confirm the right treatment during your consult.',
    };
  }

  const faqMatch = FAQS.find(f => matches(text, f.keywords));
  if (faqMatch) {
    return { text: faqMatch.reply, chips: ['Book an appointment', 'Ask something else'] };
  }

  if (matches(text, BOOKING_WORDS)) {
    return {
      text: "I can take you straight to the booking form. Would you like an in-clinic visit or an online video consultation?",
      chips: ['In-clinic', 'Online', 'Not sure — describe my symptoms'],
      action: { concern: '', type: '', label: '📅 Open Booking Form' },
    };
  }

  if (matches(text, GREETING_WORDS)) {
    return {
      text: "Hi! I'm the HomeoDesk assistant 🌿 I can help you understand symptoms, point you to the right kind of consultation, or book an appointment. What's going on?",
      chips: ['I have symptoms', 'Book an appointment', 'About homeopathy', 'Clinic timings'],
    };
  }

  if (matches(text, THANKS_WORDS)) {
    return { text: "You're welcome! Anything else I can help with?", chips: ['Book an appointment', 'Ask something else'] };
  }

  if (text.includes('in-clinic')) {
    return {
      text: 'Got it — an in-clinic visit. Let me open the booking form for you.',
      action: { concern: '', type: 'in-clinic', label: '📅 Continue to Booking' },
    };
  }
  if (text.includes('online')) {
    return {
      text: 'Got it — an online video consultation. Let me open the booking form for you.',
      action: { concern: '', type: 'online', label: '📅 Continue to Booking' },
    };
  }

  // Fallback — still useful, still friendly
  return {
    text: "I'm not fully sure I understood that, but I can help with symptom guidance, clinic info, or booking. Could you tell me a bit more, or pick an option below?",
    chips: ['I have symptoms', 'Book an appointment', 'About homeopathy', 'Clinic timings'],
  };
}

/* ─────────────────────────────────────────────
   CHAT UI
───────────────────────────────────────────── */
const styles = {
  fab: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
    width: 58, height: 58, borderRadius: '50%',
    background: `linear-gradient(135deg,${C.gold},#d4b96a)`,
    color: C.green, border: 'none', cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontSize: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    position: 'fixed', bottom: 96, right: 24, zIndex: 1000,
    width: 360, maxWidth: '92vw', height: 540, maxHeight: '75vh',
    background: '#fff', borderRadius: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    background: `linear-gradient(135deg,${C.greenDark},${C.green})`,
    padding: '16px 18px', color: '#fff', display: 'flex',
    justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
  },
  body: { flex: 1, overflowY: 'auto', padding: '14px 14px 6px', background: C.cream },
  inputRow: { display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(27,67,50,0.08)', background: '#fff', flexShrink: 0 },
  input: {
    flex: 1, border: '1px solid rgba(27,67,50,0.15)', borderRadius: 999,
    padding: '10px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  },
  sendBtn: {
    background: C.green, color: '#fff', border: 'none', borderRadius: '50%',
    width: 38, height: 38, cursor: 'pointer', fontSize: 15, flexShrink: 0,
  },
  bubbleBot: {
    background: '#fff', color: '#1a1a1a', border: '1px solid rgba(27,67,50,0.08)',
    borderRadius: '4px 16px 16px 16px', padding: '10px 13px', fontSize: 13.5,
    lineHeight: 1.55, maxWidth: '85%', marginBottom: 4, whiteSpace: 'pre-line',
  },
  bubbleUser: {
    background: C.green, color: '#fff', borderRadius: '16px 4px 16px 16px',
    padding: '10px 13px', fontSize: 13.5, lineHeight: 1.5, maxWidth: '85%',
    marginBottom: 4, marginLeft: 'auto',
  },
  note: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', margin: '2px 0 10px 2px' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 12px 2px' },
  chip: {
    background: 'rgba(82,183,136,0.1)', border: '1px solid rgba(82,183,136,0.3)',
    color: C.green, borderRadius: 999, padding: '5px 12px', fontSize: 12,
    cursor: 'pointer', fontWeight: 600,
  },
  actionBtn: {
    background: `linear-gradient(135deg,${C.gold},#d4b96a)`, color: C.green,
    border: 'none', borderRadius: 999, padding: '9px 16px', fontSize: 12.5,
    fontWeight: 700, cursor: 'pointer', margin: '0 0 12px 2px', display: 'inline-block',
  },
  typingDot: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', margin: '0 0 10px 2px' },
};

let msgId = 0;
const nextId = () => `m${++msgId}-${Date.now()}`;

/**
 * Floating chatbot widget for the HomeoDesk public site.
 *
 * Rule-based (no external API needed) so it works instantly, offline, and
 * for free. It answers basic health/clinic FAQs, matches described symptoms
 * to the right care focus + consultation type, and can hand off straight
 * into the booking form via `onBook`.
 *
 * Props:
 *   onBook(concern: string, type: string) — called when the user accepts a
 *     booking suggestion; expected to prefill the booking form and switch
 *     to the booking tab.
 */
export default function Chatbot({ onBook }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: nextId(),
      role: 'bot',
      text: "Hi! I'm the HomeoDesk assistant 🌿 I can help with basic health questions, suggest the right kind of consultation for your symptoms, or book an appointment for you.",
      note: "I'm not a substitute for medical advice — for emergencies, call 112 or go to the nearest ER.",
      chips: ['I have symptoms', 'Book an appointment', 'About homeopathy', 'Clinic timings'],
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing, open]);

  const pushBotReply = (userText) => {
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(userText);
      setMessages(prev => [...prev, { id: nextId(), role: 'bot', ...reply }]);
      setTyping(false);
    }, 420);
  };

  const send = (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: nextId(), role: 'user', text }]);
    setInput('');
    pushBotReply(text);
  };

  const handleAction = (action) => {
    setMessages(prev => [...prev, { id: nextId(), role: 'user', text: action.label }]);
    if (onBook) onBook(action.concern || '', action.type || '');
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: nextId(), role: 'bot',
        text: "Done — I've opened the booking form" + (action.concern ? ' with your concern filled in.' : '.') + ' Just add your details and submit.',
      }]);
      setTyping(false);
    }, 350);
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={styles.fab}
        aria-label={open ? 'Close chat assistant' : 'Open chat assistant'}
        title="Chat with HomeoDesk Assistant"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div style={styles.panel} role="dialog" aria-label="HomeoDesk chat assistant">
          <div style={styles.header}>
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 16 }}>🌿 HomeoDesk Assistant</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Symptoms · Bookings · Clinic info</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
              aria-label="Close"
            >✕</button>
          </div>

          <div style={styles.body} ref={bodyRef}>
            {messages.map(m => (
              <div key={m.id}>
                <div style={m.role === 'bot' ? styles.bubbleBot : styles.bubbleUser}>{m.text}</div>
                {m.role === 'bot' && m.note && <div style={styles.note}>ℹ️ {m.note}</div>}
                {m.role === 'bot' && m.action && (
                  <button style={styles.actionBtn} onClick={() => handleAction(m.action)}>{m.action.label}</button>
                )}
                {m.role === 'bot' && m.chips && m.chips.length > 0 && (
                  <div style={styles.chipsRow}>
                    {m.chips.map(c => (
                      <button key={c} style={styles.chip} onClick={() => send(c)}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div style={styles.typingDot}>Assistant is typing…</div>}
          </div>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Describe your symptom or ask a question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
            />
            <button style={styles.sendBtn} onClick={() => send()} aria-label="Send">➤</button>
          </div>
        </div>
      )}
    </>
  );
}
