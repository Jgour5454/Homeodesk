import React, { useState, createContext, useContext, useEffect } from 'react';
import {
  createAppointment, createConsultation,
  getAppointments, updateAppointment, cancelAppointment,
  getConsultations, updateConsultation, cancelConsultation,
  registerUser, loginUser, fetchCurrentUser,
  forgotPassword, verifyResetCode, resetPassword,
  createRecord, getRecords, updateRecord, deleteRecord, getMyPatients,
  createDietPlan, getDietPlans, updateDietPlan, deleteDietPlan,
  submitFeedback, getFeedback,
} from './api';
import Chatbot from './Chatbot';

/* ─────────────────────────────────────────────
   AUTH CONTEXT
───────────────────────────────────────────── */
const AuthCtx = createContext();
const useAuth = () => useContext(AuthCtx);

// The doctor portal is "static" in the sense that there's exactly one, fixed
// clinic account — it's seeded directly on the server (see
// server/scripts/seedDoctor.js) and can never be created or duplicated
// through the public API (server/routes/auth.js rejects role: 'doctor' on
// /register). But logging in as that doctor still goes through the same
// real, password-checked /api/auth/login as every patient — there is no
// client-side "any password works" shortcut. The server is the only thing
// that ever decides whether a login succeeds.
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // On load, restore a session from a saved token, verified against the API.
  // Never trust a locally-cached user object on its own.
  useEffect(() => {
    const token = localStorage.getItem('hd_token');
    if (!token) { setAuthLoading(false); return; }
    fetchCurrentUser(token)
      .then(({ user: me }) => setUser(me))
      .catch(() => localStorage.removeItem('hd_token'))
      .finally(() => setAuthLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user: loggedInUser } = await loginUser({ email, password });
    localStorage.setItem('hd_token', token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (data) => {
    const res = await registerUser(data);
    return res;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hd_token');
  };

  return <AuthCtx.Provider value={{ user, login, register, logout, authLoading }}>{children}</AuthCtx.Provider>;
}

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const C = {
  greenDark: '#0d2b1e', green: '#1B4332', greenMid: '#2d6a4f',
  sage: '#52B788', gold: '#C9A84C', cream: '#F8F5F0',
};

const S = {
  page: { fontFamily: "'Inter', sans-serif", background: C.cream, color: '#1a1a1a', minHeight: '100vh' },
  container: { maxWidth: 1100, margin: '0 auto', padding: '0 20px' },
  card: { background: '#fff', borderRadius: 20, padding: 24, border: '1px solid rgba(27,67,50,0.08)', marginBottom: 16 },
  darkCard: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, marginBottom: 16 },
  input: { width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontFamily: 'Inter,sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  inputLight: { width: '100%', background: '#fff', border: '1px solid rgba(27,67,50,0.15)', borderRadius: 10, padding: '10px 14px', color: '#1a1a1a', fontFamily: 'Inter,sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 },
  labelLight: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 },
  btnGold: { background: `linear-gradient(135deg,${C.gold},#d4b96a)`, color: C.green, fontWeight: 700, border: 'none', borderRadius: 999, padding: '12px 26px', cursor: 'pointer', fontSize: 14, display: 'inline-block' },
  btnGreen: { background: C.green, color: '#fff', fontWeight: 600, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontSize: 14 },
  btnOutline: { background: 'transparent', color: C.green, border: `2px solid ${C.green}`, borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnDanger: { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  sectionH: { fontFamily: 'Playfair Display, serif', color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 20 },
  sectionHLight: { fontFamily: 'Playfair Display, serif', color: C.green, fontSize: 22, fontWeight: 700, marginBottom: 20 },
  tag: { fontSize: 12, color: C.sage, background: 'rgba(82,183,136,0.1)', border: '1px solid rgba(82,183,136,0.25)', borderRadius: 999, padding: '3px 12px', display: 'inline-block', marginRight: 6, marginBottom: 6 },
  badge: (color) => ({ background: color, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600 }),
};

/* ─────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const colors = { pending: '#d97706', confirmed: '#059669', completed: '#2563eb', cancelled: '#dc2626' };
  return <span style={S.badge(colors[status] || '#6b7280')}>{status}</span>;
};

const StarRating = ({ value = 5 }) => (
  <span>{Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < value ? '#EAB308' : '#d1d5db', fontSize: 16 }}>★</span>
  ))}</span>
);

const Alert = ({ msg, type = 'success' }) => msg ? (
  <div style={{ background: type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${type === 'error' ? '#fca5a5' : '#86efac'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: type === 'error' ? '#dc2626' : '#166534' }}>
    {type === 'error' ? '⚠️' : '✅'} {msg}
  </div>
) : null;

const Divider = () => (
  <div style={{ width: 60, height: 3, background: `linear-gradient(90deg,${C.gold},${C.sage})`, borderRadius: 2, margin: '8px auto 32px' }} />
);

/* ─────────────────────────────────────────────
   LIVE DATA HELPERS
───────────────────────────────────────────── */
/**
 * Appointments and online consultations are two separate collections in the
 * database (they're created by two different booking forms). This normalizes
 * either record shape into one common "booking" shape so the doctor and
 * patient dashboards can render/filter/sort them together.
 */
function normalizeBooking(record, kind) {
  const patientName = kind === 'consultation'
    ? record.name
    : `${record.firstName || ''} ${record.lastName || ''}`.trim();
  return {
    ...record,
    kind, // 'appointment' | 'consultation'
    type: kind === 'consultation' ? 'online' : record.type,
    patientName,
    notes: record.notes || '',
  };
}

/* ─────────────────────────────────────────────
   Diet plan templates — quick-fill starting points a doctor can pick from
   when creating a real, patient-specific plan (see DoctorDietPanel). These
   are just presets, not patient data; actual plans are persisted via the
   secured /api/diet-plans endpoints and feedback is still a static demo.
───────────────────────────────────────────── */

const DIET_TEMPLATES = [
  { emoji: '🌿', title: 'Anti-Inflammatory Diet', condition: 'Arthritis, Chronic Pain',
    meals: ['Warm turmeric milk', 'Brown rice + moong dal', 'Steamed veggies', 'Herbal tea'],
    avoid: 'Refined sugar, Fried foods, Red meat', include: 'Turmeric, Ginger, Berries, Leafy greens' },
  { emoji: '🌸', title: 'Hormone-Balancing Diet', condition: 'PCOS, Hormonal Imbalance',
    meals: ['Sprouts + coconut water', 'Millet roti + rajma', 'Flaxseed water', 'Quinoa dinner'],
    avoid: 'White flour, Packaged juices, Excess dairy', include: 'Flaxseeds, Fenugreek, Cinnamon, Whole grains' },
  { emoji: '🛡️', title: 'Immunity-Boosting Diet', condition: 'Recurrent Infections',
    meals: ['Amla juice + idli', 'Tulsi-ginger tea', 'Rice + sambar + buttermilk', 'Turmeric milk'],
    avoid: 'Cold drinks, Ice cream, Junk food', include: 'Amla, Tulsi, Giloy, Citrus, Garlic' },
  { emoji: '🌙', title: 'Better Sleep Diet', condition: 'Insomnia, Stress Support',
    meals: ['Warm chamomile/haldi tea', 'Khichdi + ghee (small portion)', 'Steamed vegetables with cumin', 'Magnesium-rich bedtime snack'],
    avoid: 'Late-night caffeine, Heavy spicy meals', include: 'Warm liquids, Magnesium foods, Gentle carbs' },
  { emoji: '⚡', title: 'Energy & Focus Diet', condition: 'Fatigue, Low Energy',
    meals: ['Oats + berries', 'Moong dal soup + brown rice', 'Lemon-ginger water', 'Roasted chana/seed snack'],
    avoid: 'Sugary desserts, Excess processed carbs', include: 'Protein + fiber, Ginger, Turmeric' },
  { emoji: '🫀', title: 'Heart-Healthy Diet', condition: 'Cholesterol Support',
    meals: ['Vegetable soup + whole grains', 'Moong/rajma bowl with salad', 'Herbal detox water', 'Curd/buttermilk (if suits you)'],
    avoid: 'Trans fats, Deep-fried items, Excess red meat', include: 'Omega-3 sources, Leafy greens, Flax/chia' },
];

/* ─────────────────────────────────────────────
   PUBLIC SITE
───────────────────────────────────────────── */
function PublicSite({ onNavigate }) {
  const [tab, setTab] = useState('home');
  const [bookForm, setBookForm] = useState({ firstName: '', lastName: '', phone: '', email: '', date: '', timeSlot: '9:00 AM', type: '', concern: '' });
  const [onlineForm, setOnlineForm] = useState({ name: '', phone: '', email: '', date: '', timeSlot: '9:00 AM – 10:00 AM', concern: '' });
  const [feedbackForm, setFeedbackForm] = useState({ patientName: '', rating: 5, category: 'general', message: '' });
  const [alert, setAlert] = useState({ msg: '', type: 'success' });
  const [onlineAlert, setOnlineAlert] = useState({ msg: '', type: 'success' });
  const [feedbackAlert, setFeedbackAlert] = useState('');
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [onlineSubmitting, setOnlineSubmitting] = useState(false);

  const submitBooking = async (e) => {
    e.preventDefault();
    setBookSubmitting(true);
    setAlert({ msg: '', type: 'success' });
    try {
      const { message } = await createAppointment(bookForm);
      setAlert({ msg: message, type: 'success' });
      setBookForm({ firstName: '', lastName: '', phone: '', email: '', date: '', timeSlot: '9:00 AM', type: '', concern: '' });
    } catch (err) {
      setAlert({ msg: err.message, type: 'error' });
    } finally {
      setBookSubmitting(false);
    }
  };

  const submitOnlineConsult = async (e) => {
    e.preventDefault();
    setOnlineSubmitting(true);
    setOnlineAlert({ msg: '', type: 'success' });
    try {
      const { message } = await createConsultation(onlineForm);
      setOnlineAlert({ msg: message, type: 'success' });
      setOnlineForm({ name: '', phone: '', email: '', date: '', timeSlot: '9:00 AM – 10:00 AM', concern: '' });
    } catch (err) {
      setOnlineAlert({ msg: err.message, type: 'error' });
    } finally {
      setOnlineSubmitting(false);
    }
  };

  const submitFeedback = (e) => {
    e.preventDefault();
    setFeedbackAlert('Thank you for your feedback! It means a lot to us.');
    setFeedbackForm({ patientName: '', rating: 5, category: 'general', message: '' });
  };

  // Called by the chatbot when the user accepts a booking suggestion —
  // prefills the booking form with whatever the bot worked out and jumps
  // straight to the Book Appt tab.
  const chatbotBook = (concern, type) => {
    setBookForm(f => ({ ...f, concern: concern || f.concern, type: type || f.type }));
    setTab('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navTabs = [
    ['home','🏠 Home'],['online','💻 Online Consult'],['booking','📅 Book Appt'],
    ['diet','🥗 Diet Plans'],['feedback','⭐ Feedback'],['login','🔐 Login'],
  ];

  return (
    <div style={S.page}>
      {/* ── HERO ── */}
      <section style={{ background: `linear-gradient(135deg,${C.greenDark},${C.green},${C.greenMid})`, padding: '90px 24px 70px', display: 'flex', alignItems: 'center' }}>
        <div style={{ ...S.container, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(82,183,136,0.18)', color: C.sage, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, marginBottom: 24 }}>🌿 Natural Healing Since 2005</div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem,5vw,3.2rem)', fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 16 }}>Heal from <span style={{ color: C.gold, fontStyle: 'italic' }}>Within.</span></h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>Evidence-based homeopathic care tailored to your unique constitution — addressing chronic illness, emotional wellness, and preventive health with zero side effects.</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 }}>
              <button onClick={() => setTab('booking')} style={S.btnGold}>📅 Book Appointment</button>
              <button onClick={() => setTab('online')} style={{ ...S.btnGold, background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.6)', fontWeight: 500 }}>💻 Online Consultation</button>
            </div>
            <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
              {[['2000+','Patients Healed'],['18+','Years Exp.'],['95%','Recovery Rate']].map(([n,l]) => (
                <div key={l}><div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 700, color: C.gold }}>{n}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>{l}</div></div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 280, height: 340, borderRadius: 28, background: `linear-gradient(135deg,${C.greenMid},${C.green})`, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 0 28px', boxShadow: '0 32px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <img src="/doctor.jpg" alt="Dr. Isha Khimani" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '78%', objectFit: 'cover', objectPosition: 'top center' }} />
                <div style={{ background: 'rgba(13,43,30,0.9)', borderRadius: 14, padding: '12px 20px', textAlign: 'center', width: 'calc(100% - 32px)', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: 'Playfair Display,serif', color: '#fff', fontSize: 17, fontWeight: 600 }}>Dr. Isha Khimani</div>
                  <div style={{ color: C.sage, fontSize: 12, marginTop: 2 }}>BHMS, MD (Homeopathy)</div>
                  <StarRating value={5} />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: -14, left: -14, background: C.gold, color: C.green, borderRadius: 16, padding: '10px 16px', boxShadow: '0 8px 24px rgba(201,168,76,0.4)' }}>
                <div style={{ fontFamily: 'Playfair Display,serif', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>18+</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Years Practice</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HEADER NAV (moved from sticky tab bar) ── */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, zIndex: 60, pointerEvents: 'none' }}>
        <div style={{ ...S.container, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ height: 46, minWidth: 46, borderRadius: 14, background: 'rgba(255,255,255,0.95)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, padding: '0 10px' }}><img src="/logo-full.png" alt="Dr. Isha's Homeopathic Clinic" style={{ height: '78%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {navTabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  background: tab === id ? 'rgba(201,168,76,0.22)' : 'rgba(255,255,255,0.08)',
                  color: tab === id ? C.gold : 'rgba(255,255,255,0.8)',
                  border: tab === id ? `1px solid rgba(201,168,76,0.35)` : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: tab === id ? 700 : 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...S.container, padding: '40px 20px' }}>

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div>
            <h2 style={{ ...S.sectionHLight, textAlign: 'center', fontSize: 28, marginBottom: 4 }}>Comprehensive care for every stage of life</h2>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 48 }}>
              {[
                ['🌿','Chronic Disease Care','Arthritis, asthma, IBS, skin disorders through individualized constitutional treatment.'],
                ['🧠','Mental & Emotional Wellness','Support for anxiety, depression, stress and sleep disorders — no dependency-forming meds.'],
                ['👶','Pediatric Homeopathy','Gentle remedies for children\'s infections, allergies, and behavioral concerns.'],
                ['🌸','Women\'s Health','PCOS, menstrual irregularities, menopause and hormonal balance naturally.'],
                ['💻','Online Consultation','Expert care from home via video call with follow-up support included.'],
                ['🔬','Acute & Preventive Care','Rapid relief for fevers and seasonal illness, plus immunity-building protocols.'],
              ].map(([icon,title,desc]) => (
                <div key={title} style={S.card}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
                  <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
                  <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{desc}</p>

                  <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: C.green, marginBottom: 4 }}>What you can expect</div>
                    <div>
                      • A personalized plan based on symptoms and constitution
                      <br />
                      • Safe, supportive guidance for daily routines
                      <br />
                      • Follow-up to adjust remedies and diet over time
                    </div>
                  </div>


                </div>
              ))}
            </div>

            {/* Doctor */}
            <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius: 24, padding: 40, marginBottom: 48 }}>
              <div style={{ textAlign: 'center', color: C.sage, fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Meet the Doctor</div>
              <h2 style={{ ...S.sectionH, textAlign: 'center', marginBottom: 32 }}>Expert care from a trusted <span style={{ color: C.gold }}>healer</span></h2>
              <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ width: 140, height: 140, borderRadius: '50%', border: '4px solid rgba(201,168,76,0.3)', flexShrink: 0, overflow: 'hidden' }}>
                  <img src="/doctor.jpg" alt="Dr. Isha Khimani" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                </div>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <h3 style={{ fontFamily: 'Playfair Display,serif', color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dr. Isha Khimani</h3>
                  <p style={{ color: C.sage, fontSize: 13, marginBottom: 14 }}>BHMS, MD (Homeopathy) · Mumbai University</p>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.75, marginBottom: 16 }}>With over 18 years of clinical experience, Dr. Khimani has helped thousands of patients overcome chronic illness, allergies, hormonal disorders, and mental health challenges.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {['Chronic Diseases','Pediatrics','Mental Health','Women\'s Health','Skin Disorders'].map(t => <span key={t} style={S.tag}>{t}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                    {[['18+','Years Practice'],['2000+','Cases Resolved'],['4','Papers Published']].map(([n,l]) => (
                      <div key={l}><div style={{ fontFamily: 'Playfair Display,serif', fontSize: 22, fontWeight: 700, color: C.gold }}>{n}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{l}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <h2 style={{ ...S.sectionHLight, textAlign: 'center', marginBottom: 4 }}>Lives transformed by <span style={{ color: C.gold, fontStyle: 'italic' }}>natural healing</span></h2>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              {[
                ['PS','Priya Sharma','Migraine relief in 4 months after years of struggle. Dr. Khimani gave me my life back. Truly remarkable approach.','Patient since 2021'],
                ['RP','Rajesh Patel','My son\'s chronic asthma improved dramatically. We\'ve reduced his inhaler use by 90%. Truly patient-first approach.','Patient since 2020'],
                ['AV','Ananya Verma','PCOS had been affecting me for years. Hormones balanced naturally without harsh side effects. Remarkable results.','Patient since 2022'],
              ].map(([init,name,text,role]) => (
                <div key={name} style={{ ...S.card, background: C.cream }}>
                  <StarRating value={5} />
                  <p style={{ color: '#4b5563', fontSize: 14, fontStyle: 'italic', lineHeight: 1.7, margin: '14px 0 18px' }}>"{text}"</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>{init}</div>
                    <div><div style={{ fontWeight: 600, color: C.green, fontSize: 14 }}>{name}</div><div style={{ color: '#9ca3af', fontSize: 12 }}>{role}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ONLINE CONSULT TAB ── */}
        {tab === 'online' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <h2 style={{ ...S.sectionHLight, marginBottom: 8 }}>💻 Online Consultation</h2>
            <p style={{ color: '#6b7280', marginBottom: 28 }}>Consult Dr. Khimani from anywhere in India via secure video call. Same quality care, zero travel.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {[['🕐','Flexible Timing','Morning & evening slots available'],['🔒','Secure & Private','Encrypted video consultation'],['💊','E-Prescription','Digital prescription post-consultation'],['🔄','Follow-up Included','Free 15-min follow-up within 7 days']].map(([ic,t,d]) => (
                <div key={t} style={S.card}><div style={{ fontSize: 28, marginBottom: 10 }}>{ic}</div><h4 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontWeight: 600, marginBottom: 4 }}>{t}</h4><p style={{ color: '#9ca3af', fontSize: 13 }}>{d}</p></div>
              ))}
            </div>
            <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius: 20, padding: 32 }}>
              <h3 style={S.sectionH}>Book Online Consultation</h3>
              <Alert msg={onlineAlert.msg} type={onlineAlert.type} />
              <form onSubmit={submitOnlineConsult}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.label}>Your Name</label><input style={S.input} placeholder="Arjun Sharma" value={onlineForm.name} onChange={e => setOnlineForm({ ...onlineForm, name: e.target.value })} required /></div>
                  <div><label style={S.label}>Phone</label><input style={S.input} placeholder="+91 98765 43210" value={onlineForm.phone} onChange={e => setOnlineForm({ ...onlineForm, phone: e.target.value })} required /></div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="arjun@email.com" value={onlineForm.email} onChange={e => setOnlineForm({ ...onlineForm, email: e.target.value })} required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.label}>Preferred Date</label><input style={S.input} type="date" value={onlineForm.date} onChange={e => setOnlineForm({ ...onlineForm, date: e.target.value })} required /></div>
                  <div><label style={S.label}>Time Slot</label>
                    <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} value={onlineForm.timeSlot} onChange={e => setOnlineForm({ ...onlineForm, timeSlot: e.target.value })}>
                      {['9:00 AM – 10:00 AM','11:00 AM – 12:00 PM','4:00 PM – 5:00 PM','6:00 PM – 7:00 PM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Health Concern</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="Describe your health concern..." value={onlineForm.concern} onChange={e => setOnlineForm({ ...onlineForm, concern: e.target.value })} required /></div>
                <button type="submit" disabled={onlineSubmitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: onlineSubmitting ? 0.7 : 1, cursor: onlineSubmitting ? 'not-allowed' : 'pointer' }}>{onlineSubmitting ? 'Submitting…' : 'Request Online Consultation →'}</button>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>A Zoom/Meet link will be shared to your email & WhatsApp</p>
              </form>
            </div>
          </div>
        )}

        {/* ── BOOKING TAB ── */}
        {tab === 'booking' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>📅 Book an Appointment</h2>
            <p style={{ color: '#6b7280', marginBottom: 28 }}>Choose in-clinic or online. We'll confirm your slot within 2 hours.</p>
            <Alert msg={alert.msg} type={alert.type} />
            <div style={S.card}>
              <form onSubmit={submitBooking}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.labelLight}>First Name</label><input style={S.inputLight} placeholder="Arjun" value={bookForm.firstName} onChange={e => setBookForm({ ...bookForm, firstName: e.target.value })} required /></div>
                  <div><label style={S.labelLight}>Last Name</label><input style={S.inputLight} placeholder="Sharma" value={bookForm.lastName} onChange={e => setBookForm({ ...bookForm, lastName: e.target.value })} required /></div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Phone Number</label><input style={S.inputLight} placeholder="+91 98765 43210" value={bookForm.phone} onChange={e => setBookForm({ ...bookForm, phone: e.target.value })} required /></div>
                <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Email</label><input style={S.inputLight} type="email" placeholder="arjun@email.com" value={bookForm.email} onChange={e => setBookForm({ ...bookForm, email: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.labelLight}>Preferred Date</label><input style={S.inputLight} type="date" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} required /></div>
                  <div><label style={S.labelLight}>Time Slot</label>
                    <select style={{ ...S.inputLight }} value={bookForm.timeSlot} onChange={e => setBookForm({ ...bookForm, timeSlot: e.target.value })}>
                      {['9:00 AM','10:00 AM','11:00 AM','12:00 PM','4:00 PM','5:00 PM','6:00 PM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Consultation Type</label>
                  <select style={S.inputLight} value={bookForm.type} onChange={e => setBookForm({ ...bookForm, type: e.target.value })} required>
                    <option value="">Select type</option>
                    <option value="in-clinic">In-Clinic Visit</option>
                    <option value="online">Online Video Consultation</option>
                    <option value="follow-up">Follow-up Appointment</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}><label style={S.labelLight}>Your Health Concern</label><textarea rows={3} style={{ ...S.inputLight, resize: 'none' }} placeholder="Briefly describe your concern..." value={bookForm.concern} onChange={e => setBookForm({ ...bookForm, concern: e.target.value })} required /></div>
                <button type="submit" disabled={bookSubmitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: bookSubmitting ? 0.7 : 1, cursor: bookSubmitting ? 'not-allowed' : 'pointer' }}>{bookSubmitting ? 'Submitting…' : 'Request Appointment →'}</button>
                <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 10 }}>Our team will confirm your slot within 2 hours</p>
              </form>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['📞','Phone','+91 99999 88888','Mon–Sat, 9 AM – 7 PM'],['📍','Address','204 Wellness Tower, CG Road','Ahmedabad, Gujarat 380009'],['🕐','Hours','Mon–Sat: 9:00 AM – 7:00 PM','Sunday: 10 AM – 1 PM (Online)']].map(([ic,l,v,s]) => (
                <div key={l} style={{ ...S.card, flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{ic}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 600, color: C.green, fontSize: 14 }}>{v}</div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DIET PLANS TAB ── */}
        {tab === 'diet' && (
          <div>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>🥗 Diet Plans & Nutrition</h2>
            <p style={{ color: '#6b7280', marginBottom: 28 }}>Homeopathic healing works best alongside the right diet. These evidence-based plans complement your treatment.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
              {DIET_TEMPLATES.map((plan) => (
                <div key={plan.title} style={S.card}>
                  <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenMid})`, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 16, marginLeft: -24, marginRight: -24, marginTop: -24, borderRadius: '20px 20px 0 0' }}>{plan.emoji}</div>
                  <span style={{ ...S.tag, color: C.gold, borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)', marginBottom: 10, display: 'inline-block' }}>{plan.condition}</span>
                  <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{plan.title}</h3>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Meal Guide</div>
                    {plan.meals.map((m,i) => <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}><span style={{ color: C.sage, fontSize: 14 }}>•</span><span style={{ fontSize: 13, color: '#374151' }}>{m}</span></div>)}
                  </div>
                  <div style={{ background: '#fef9f0', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginBottom: 4 }}>✅ Include</div>
                    <p style={{ fontSize: 12, color: '#374151' }}>{plan.include}</p>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>⛔ Avoid</div>
                    <p style={{ fontSize: 12, color: '#374151' }}>{plan.avoid}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...S.card, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, marginTop: 24 }}>
              <h3 style={S.sectionH}>💡 General Diet Principles in Homeopathy</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                {[['☕ Avoid Coffee & Mint','These antidote homeopathic remedies. Switch to herbal teas.'],['🌡️ Prefer Warm Foods','Warm, freshly cooked meals aid digestion and healing.'],['⏰ Eat on Time','Regular meal timings support constitutional balance.'],['💧 Hydrate Well','8–10 glasses of room-temperature water daily.']].map(([t,d]) => (
                  <div key={t} style={S.darkCard}><div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginBottom: 6 }}>{t}</div><p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{d}</p></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK TAB ── */}
        {tab === 'feedback' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>⭐ Share Your Feedback</h2>
            <p style={{ color: '#6b7280', marginBottom: 28 }}>Your experience helps us serve patients better. We'd love to hear from you.</p>
            <Alert msg={feedbackAlert} />
            <div style={S.card}>
              <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Leave a Review</h3>
              <form onSubmit={submitFeedback}>
                <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Your Name</label><input style={S.inputLight} placeholder="Priya Sharma" value={feedbackForm.patientName} onChange={e => setFeedbackForm({ ...feedbackForm, patientName: e.target.value })} required /></div>
                <div style={{ marginBottom: 16 }}>
                  <label style={S.labelLight}>Rating</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {[1,2,3,4,5].map(r => (
                      <button type="button" key={r} onClick={() => setFeedbackForm({ ...feedbackForm, rating: r })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: r <= feedbackForm.rating ? '#EAB308' : '#d1d5db', transition: 'color 0.1s' }}>★</button>
                    ))}
                    <span style={{ alignSelf: 'center', fontWeight: 600, color: C.green, fontSize: 15, marginLeft: 4 }}>{feedbackForm.rating}/5</span>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Category</label>
                  <select style={S.inputLight} value={feedbackForm.category} onChange={e => setFeedbackForm({ ...feedbackForm, category: e.target.value })}>
                    <option value="general">General</option>
                    <option value="treatment">Treatment Outcome</option>
                    <option value="doctor">Doctor's Care</option>
                    <option value="clinic">Clinic Experience</option>
                    <option value="online-consultation">Online Consultation</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}><label style={S.labelLight}>Your Feedback</label><textarea rows={4} style={{ ...S.inputLight, resize: 'none' }} placeholder="Tell us about your experience..." value={feedbackForm.message} onChange={e => setFeedbackForm({ ...feedbackForm, message: e.target.value })} required /></div>
                <button type="submit" style={{ ...S.btnGold, width: '100%', padding: 14 }}>Submit Feedback →</button>
              </form>
            </div>
            <h3 style={{ ...S.sectionHLight, marginTop: 32, fontSize: 20 }}>What Patients Say</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
              {[
                ['PS','Priya Sharma',5,'Treatment Outcome','After years of migraines, Dr. Khimani\'s treatment gave me my life back in 4 months.'],
                ['RP','Rajesh Patel',5,'Doctor\'s Care','My son\'s asthma improved dramatically. We\'ve reduced inhaler use by 90%.'],
                ['AV','Ananya Verma',5,'Treatment Outcome','PCOS balanced naturally without harsh side effects. Truly remarkable results.'],
              ].map(([init,name,r,cat,msg]) => (
                <div key={name} style={{ ...S.card, background: C.cream }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <StarRating value={r} />
                    <span style={{ ...S.tag, fontSize: 11 }}>{cat}</span>
                  </div>
                  <p style={{ color: '#4b5563', fontSize: 13, fontStyle: 'italic', lineHeight: 1.65, marginBottom: 14 }}>"{msg}"</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{init}</div>
                    <div style={{ fontWeight: 600, color: C.green, fontSize: 13 }}>{name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOGIN TAB ── */}
        {tab === 'login' && <LoginPanel onNavigate={onNavigate} />}
      </div>

      {/* Footer */}
      <footer style={{ background: '#0a1f16', padding: '28px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 40 }}>
        <div style={{ ...S.container, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 120, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', flexShrink: 0 }}><img src="/logo-full.png" alt="Dr. Isha's Homeopathic Clinic" style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} /></div>
            </div>
            <p style={{ color: '#f5f5f5', fontSize: 12, lineHeight: 1.7, margin: 0 }}>
              Evidence-based homeopathic care with compassionate support.
            </p>
            <p style={{ color: '#e5e7eb', fontSize: 12, marginTop: 14 }}>
              © 2025 Dr. Isha's Homeopathic Clinic · Rajkot · All rights reserved
            </p>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: 0.3 }}>Visit Us</div>
            <div style={{ color: '#f5f5f5', fontSize: 12, lineHeight: 1.7 }}>
              📍 Dummy Address, Near Gondal Road Flyover
              <br />
              Rajkot, Gujarat 360001
            </div>
            <div style={{ color: '#f5f5f5', fontSize: 12, marginTop: 10 }}>
              📞 +91 98765 43210 · ✉️ contact@homeodesk.in
            </div>
          </div>

          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: 0.3 }}>Quick Links</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {['Privacy','Terms','Sitemap'].map(l => (
                <a key={l} href="#" style={{ color: '#f5f5f5', fontSize: 12, textDecoration: 'none' }}>
                  {l}
                </a>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ color: '#e5e7eb', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Hours
              </div>
              <div style={{ color: '#f5f5f5', fontSize: 12, lineHeight: 1.7 }}>
                Mon–Sat: 9:00 AM – 7:00 PM
                <br />
                Sunday: 10 AM – 1 PM (Online)
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...S.container, marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, color: '#cbd5e1', fontSize: 11 }}>
          Built for demonstration · No real medical claims · Consult a qualified professional.
        </div>
      </footer>

      <Chatbot onBook={chatbotBook} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOGIN PANEL
───────────────────────────────────────────── */
function LoginPanel({ onNavigate }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'verify_code' | 'new_password'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'patient' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ email: '', resetToken: '', newPassword: '', confirmPassword: '' });
  const [alertState, setAlertState] = useState({ msg: '', type: 'success' });
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try { const user = await login(form.email, form.password); onNavigate(user.role); }
    catch (err) { setAlertState({ msg: err.message, type: 'error' }); }
    finally { setSubmitting(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { user: newUser } = await register({ ...form, role: 'patient' });
      setAlertState({
        msg: `Account created successfully for ${newUser.name || 'you'}! Please log in with your password to open the portal.`,
        type: 'success',
      });
      setForm(prev => ({ ...prev, password: '' }));
      setMode('login');
    } catch (err) {
      setAlertState({ msg: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlertState({ msg: '', type: 'success' });
    try {
      const res = await forgotPassword({ email: forgotEmail });
      setResetForm({
        email: forgotEmail,
        resetToken: '',
        newPassword: '',
        confirmPassword: '',
      });
      setAlertState({
        msg: res.message || 'A 6-digit password reset code has been sent to your email address.',
        type: 'success'
      });
      setMode('verify_code');
    } catch (err) {
      setAlertState({ msg: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlertState({ msg: '', type: 'success' });
    try {
      await verifyResetCode({ email: resetForm.email, code: resetForm.resetToken });
      setAlertState({ msg: 'Code verified successfully! Please enter your new password below.', type: 'success' });
      setMode('new_password');
    } catch (err) {
      setAlertState({ msg: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setAlertState({ msg: 'New passwords do not match.', type: 'error' });
      return;
    }
    setSubmitting(true);
    setAlertState({ msg: '', type: 'success' });
    try {
      const res = await resetPassword({
        email: resetForm.email,
        resetToken: resetForm.resetToken,
        newPassword: resetForm.newPassword,
      });
      setAlertState({ msg: res.message || 'Password reset successfully! Please log in with your new password.', type: 'success' });
      setForm(prev => ({ ...prev, email: resetForm.email, password: '' }));
      setMode('login');
    } catch (err) {
      setAlertState({ msg: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return 'Welcome Back';
    if (mode === 'register') return 'Create Account';
    if (mode === 'forgot') return 'Forgot Password';
    if (mode === 'verify_code') return 'Verify Reset Code';
    if (mode === 'new_password') return 'Set New Password';
  };

  const getSubtitle = () => {
    if (mode === 'login') return 'Login to your patient or doctor portal';
    if (mode === 'register') return 'Register as a new patient';
    if (mode === 'forgot') return 'Step 1 of 3: Enter email to receive reset code';
    if (mode === 'verify_code') return 'Step 2 of 3: Enter the 6-digit code sent to your email';
    if (mode === 'new_password') return 'Step 3 of 3: Choose a new password for your account';
  };

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔑</div>
        <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>{getTitle()}</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{getSubtitle()}</p>
      </div>
      <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius: 24, padding: 32 }}>
        {(mode === 'login' || mode === 'register') && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 4 }}>
            {[['login','Login'],['register','Register']].map(([v,l]) => (
              <button key={v} onClick={() => { setMode(v); setAlertState({ msg: '', type: 'success' }); }} style={{ flex: 1, background: mode === v ? 'rgba(255,255,255,0.1)' : 'transparent', color: mode === v ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 14, fontWeight: mode === v ? 600 : 400 }}>{l}</button>
            ))}
          </div>
        )}

        <Alert msg={alertState.msg} type={alertState.type} />

        {/* LOGIN OR REGISTER FORM */}
        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            {mode === 'register' && (
              <>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Full Name</label><input style={S.input} placeholder="Arjun Sharma" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Phone</label><input style={S.input} placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Email</label>
              <input
                style={S.input}
                type="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div style={{ marginBottom: mode === 'login' ? 8 : 20 }}>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(form.email);
                    setAlertState({ msg: '', type: 'success' });
                    setMode('forgot');
                  }}
                  style={{ background: 'none', border: 'none', color: C.sage, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" disabled={submitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'default' : 'pointer' }}>
              {submitting ? 'Please wait…' : (mode === 'login' ? 'Login →' : 'Create Account →')}
            </button>
          </form>
        )}

        {/* STEP 1: FORGOT PASSWORD FORM (Enter Email) */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Account Email Address</label>
              <input
                style={S.input}
                type="email"
                placeholder="you@email.com"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={submitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'default' : 'pointer', marginBottom: 14 }}>
              {submitting ? 'Sending Code…' : 'Send Reset Code →'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setAlertState({ msg: '', type: 'success' }); setMode('login'); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY CODE FORM (Enter 6-Digit Code) */}
        {mode === 'verify_code' && (
          <form onSubmit={handleVerifyCode}>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Email Address</label>
              <input
                style={S.input}
                type="email"
                placeholder="you@email.com"
                value={resetForm.email}
                onChange={e => setResetForm({ ...resetForm, email: e.target.value })}
                required
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>6-Digit Verification Code</label>
              <input
                style={{ ...S.input, fontSize: 18, letterSpacing: 4, textAlign: 'center' }}
                placeholder="123456"
                value={resetForm.resetToken}
                onChange={e => setResetForm({ ...resetForm, resetToken: e.target.value })}
                required
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={submitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'default' : 'pointer', marginBottom: 14 }}>
              {submitting ? 'Verifying Code…' : 'Verify Code →'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setAlertState({ msg: '', type: 'success' }); setMode('forgot'); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
              >
                ← Re-enter Email
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SET NEW PASSWORD FORM (Shown only after code is verified!) */}
        {mode === 'new_password' && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>New Password</label>
              <input
                style={S.input}
                type="password"
                placeholder="Minimum 6 characters"
                value={resetForm.newPassword}
                onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Confirm New Password</label>
              <input
                style={S.input}
                type="password"
                placeholder="Re-enter new password"
                value={resetForm.confirmPassword}
                onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={submitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'default' : 'pointer', marginBottom: 14 }}>
              {submitting ? 'Updating Password…' : 'Reset Password →'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setAlertState({ msg: '', type: 'success' }); setMode('login'); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {mode === 'register' && (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 10 }}>
              Doctor accounts are set up by the clinic directly and can't be self-registered.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PATIENT PORTAL
───────────────────────────────────────────── */
function PatientPortal() {
  const { user, logout } = useAuth();

  // Guard clause: this component must never render content for a doctor
  // account. If it's ever reached with a non-patient user (defensive —
  // AppInner already prevents this), log out immediately instead of
  // showing patient data/actions.
  useEffect(() => {
    if (user && user.role !== 'patient') logout();
  }, [user]);

  const [tab, setTab] = useState('dashboard');
  const [alert, setAlert] = useState({ msg: '', type: 'success' });
  const [bookForm, setBookForm] = useState({ type: 'online', phone: user?.phone || '', email: user?.email || '', date: '', timeSlot: '10:00 AM', concern: '' });
  const [bookSubmitting, setBookSubmitting] = useState(false);

  const [myBookings, setMyBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');

  const loadMyBookings = async () => {
    if (!user?.id) return;
    setBookingsLoading(true);
    setBookingsError('');
    try {
      const [apptRes, consultRes] = await Promise.all([
        getAppointments({ patientId: user.id }),
        getConsultations({ patientId: user.id }),
      ]);
      const merged = [
        ...(apptRes.appointments || []).map((a) => normalizeBooking(a, 'appointment')),
        ...(consultRes.consultations || []).map((c) => normalizeBooking(c, 'consultation')),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyBookings(merged);
    } catch (err) {
      setBookingsError(err.message);
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => { loadMyBookings(); }, [user?.id]);

  const [myDietPlans, setMyDietPlans] = useState([]);
  const [dietLoading, setDietLoading] = useState(true);
  const [dietError, setDietError] = useState('');

  const loadMyDietPlans = async () => {
    if (!user?.id) return;
    setDietLoading(true);
    setDietError('');
    try {
      const { plans } = await getDietPlans();
      setMyDietPlans(plans || []);
    } catch (err) {
      setDietError(err.message);
    } finally {
      setDietLoading(false);
    }
  };

  useEffect(() => { loadMyDietPlans(); }, [user?.id]);
  const activeDietPlan = myDietPlans.find((p) => p.status !== 'inactive') || myDietPlans[0] || null;

  const submitBooking = async (e) => {
    e.preventDefault();
    setBookSubmitting(true);
    setAlert({ msg: '', type: 'success' });
    const [firstName, ...rest] = (user?.name || '').split(' ');
    try {
      const { message } = await createAppointment({
        firstName: firstName || 'Patient',
        lastName: rest.join(' ') || '-',
        phone: bookForm.phone,
        email: bookForm.email,
        date: bookForm.date,
        timeSlot: bookForm.timeSlot,
        type: bookForm.type,
        concern: bookForm.concern,
        patientId: user?.id,
      });
      setAlert({ msg: message, type: 'success' });
      setBookForm({ type: 'online', phone: user?.phone || '', email: user?.email || '', date: '', timeSlot: '10:00 AM', concern: '' });
      loadMyBookings();
      setTimeout(() => { setTab('appointments'); setAlert({ msg: '', type: 'success' }); }, 1200);
    } catch (err) {
      setAlert({ msg: err.message, type: 'error' });
    } finally {
      setBookSubmitting(false);
    }
  };

  const cancelBooking = async (booking) => {
    try {
      if (booking.kind === 'consultation') await cancelConsultation(booking.id);
      else await cancelAppointment(booking.id);
      loadMyBookings();
    } catch (err) {
      setAlert({ msg: err.message, type: 'error' });
    }
  };

  const sidebarTabs = [
    ['dashboard','🏠 Dashboard'],['appointments','📅 My Appointments'],['online','💻 Online Consult'],
    ['diet','🥗 Diet Plan'],['records','📋 My Records'],['feedback','⭐ Feedback'],
  ];

  return (
    <div style={{ ...S.page, display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 230, background: `linear-gradient(180deg,${C.greenDark},${C.green})`, padding: '24px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 130, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', flexShrink: 0 }}><img src="/logo-full.png" alt="Dr. Isha's Homeopathic Clinic" style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} /></div></div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>PATIENT PORTAL</div>
        </div>
        <div style={{ flex: 1, padding: '16px 12px' }}>
          {sidebarTabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ width: '100%', textAlign: 'left', background: tab === id ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab === id ? '#fff' : 'rgba(255,255,255,0.55)', border: 'none', borderLeft: tab === id ? `3px solid ${C.gold}` : '3px solid transparent', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontSize: 13, fontWeight: tab === id ? 600 : 400, marginBottom: 2 }}>{label}</button>
          ))}
        </div>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(82,183,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sage, fontWeight: 700, fontSize: 14 }}>{user?.name?.[0]}</div>
            <div><div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.name}</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Patient</div></div>
          </div>
          <button onClick={logout} style={{ ...S.btnOutline, width: '100%', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, background: C.cream, padding: 32, overflowY: 'auto' }}>
        <Alert msg={alert.msg} type={alert.type} />

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
            <p style={{ color: '#6b7280', marginBottom: 28 }}>Your health journey at a glance.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
              {[
                ['📅', myBookings.length, 'Total Appointments', C.green],
                ['✅', myBookings.filter(a => a.status === 'completed').length, 'Completed', C.sage],
                ['⏳', myBookings.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length, 'Upcoming', '#d97706'],
                ['🥗', activeDietPlan ? '1' : '0', 'Active Diet Plan', C.gold],
              ].map(([ic,n,l,c]) => (
                <div key={l} style={{ ...S.card, borderTop: `4px solid ${c}` }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{ic}</div>
                  <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, fontWeight: 700, color: c }}>{n}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={S.card}>
                <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 17, marginBottom: 16 }}>Upcoming Appointments</h3>
                {bookingsLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
                {!bookingsLoading && myBookings.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length === 0 && (
                  <p style={{ color: '#6b7280', fontSize: 13 }}>No upcoming appointments yet.</p>
                )}
                {myBookings.filter(a => a.status !== 'completed' && a.status !== 'cancelled').map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(27,67,50,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 14 }}>{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {a.timeSlot}</div>
                      <div style={{ color: '#6b7280', fontSize: 12, textTransform: 'capitalize' }}>{a.type.replace('-', ' ')}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 17, marginBottom: 14 }}>Current Diet Plan</h3>
                {dietLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
                {!dietLoading && !activeDietPlan && (
                  <p style={{ color: '#6b7280', fontSize: 13 }}>No diet plan assigned yet — your doctor will add one after your visit.</p>
                )}
                {activeDietPlan && (
                  <>
                    <span style={S.tag}>{activeDietPlan.condition || 'General'}</span>
                    <h4 style={{ fontWeight: 600, color: '#1a1a1a', margin: '10px 0' }}>{activeDietPlan.title}</h4>
                    <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                      <div style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: C.green }}>Today's meals: </span>{[activeDietPlan.meals?.breakfast?.[0], activeDietPlan.meals?.lunch?.[0]].filter(Boolean).join(', ') || '—'}</div>
                      {activeDietPlan.foodsToAvoid?.length > 0 && (
                        <div style={{ color: '#dc2626', fontSize: 12 }}>⛔ Avoid: {activeDietPlan.foodsToAvoid.slice(0, 2).join(', ')}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={S.sectionHLight}>My Appointments</h2>
              <button onClick={() => setTab('online')} style={S.btnGold}>+ Book New</button>
            </div>
            {bookingsError && <Alert msg={bookingsError} type="error" />}
            {bookingsLoading && <p style={{ color: '#6b7280' }}>Loading your appointments…</p>}
            {!bookingsLoading && myBookings.length === 0 && <p style={{ color: '#6b7280' }}>You haven't booked any appointments yet.</p>}
            {myBookings.map(a => (
              <div key={a.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>{a.type === 'online' ? '💻' : a.type === 'follow-up' ? '🔄' : '🏥'}</span>
                      <span style={{ fontFamily: 'Playfair Display,serif', fontWeight: 600, color: C.green, fontSize: 17, textTransform: 'capitalize' }}>{a.type.replace('-', ' ')}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div style={{ color: '#374151', fontSize: 14, marginBottom: 4 }}>📅 {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {a.timeSlot}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Concern: {a.concern}</div>
                    {a.notes && <div style={{ color: C.green, fontSize: 13, marginTop: 6, background: 'rgba(27,67,50,0.06)', borderRadius: 8, padding: '6px 10px' }}>📝 Doctor's notes: {a.notes}</div>}
                    {a.meetingLink && a.status === 'confirmed' && <div style={{ marginTop: 8 }}><a href={a.meetingLink} target="_blank" rel="noreferrer" style={{ color: '#fff', background: C.greenMid, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>🔗 Join Video Call</a></div>}
                  </div>
                  {a.status === 'pending' && <button onClick={() => cancelBooking(a)} style={S.btnDanger}>Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ONLINE CONSULT */}
        {tab === 'online' && (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>💻 Book Online Consultation</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>Consult Dr. Khimani from home. A video link will be sent to your email and WhatsApp.</p>
            <div style={{ background: `linear-gradient(135deg,${C.green},${C.greenDark})`, borderRadius: 20, padding: 32 }}>
              <form onSubmit={submitBooking}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.label}>Consultation Type</label>
                    <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} value={bookForm.type} onChange={e => setBookForm({ ...bookForm, type: e.target.value })}>
                      <option value="online">Online Video</option>
                      <option value="in-clinic">In-Clinic</option>
                      <option value="follow-up">Follow-up</option>
                    </select>
                  </div>
                  <div><label style={S.label}>Preferred Date</label><input style={S.input} type="date" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={S.label}>Phone</label><input style={S.input} placeholder="+91 98765 43210" value={bookForm.phone} onChange={e => setBookForm({ ...bookForm, phone: e.target.value })} required /></div>
                  <div><label style={S.label}>Time Slot</label>
                    <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} value={bookForm.timeSlot} onChange={e => setBookForm({ ...bookForm, timeSlot: e.target.value })}>
                      {['9:00 AM','10:00 AM','11:00 AM','4:00 PM','5:00 PM','6:00 PM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@email.com" value={bookForm.email} onChange={e => setBookForm({ ...bookForm, email: e.target.value })} /></div>
                <div style={{ marginBottom: 20 }}><label style={S.label}>Health Concern</label><textarea rows={4} style={{ ...S.input, resize: 'none' }} placeholder="Describe your symptoms or reason for consultation..." value={bookForm.concern} onChange={e => setBookForm({ ...bookForm, concern: e.target.value })} required /></div>
                <button type="submit" disabled={bookSubmitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: bookSubmitting ? 0.7 : 1, cursor: bookSubmitting ? 'not-allowed' : 'pointer' }}>{bookSubmitting ? 'Submitting…' : 'Confirm Booking →'}</button>
              </form>
            </div>
          </div>
        )}

        {/* DIET PLAN */}
        {tab === 'diet' && (
          <div>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>🥗 Your Diet Plan</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>Prescribed by your doctor · Tailored for your constitution</p>
            {dietError && <Alert msg={dietError} type="error" />}
            {dietLoading && <p style={{ color: '#6b7280' }}>Loading your diet plan…</p>}
            {!dietLoading && !activeDietPlan && (
              <p style={{ color: '#6b7280' }}>No diet plan has been assigned to you yet. Your doctor will add one after reviewing your case.</p>
            )}
            {activeDietPlan && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                <div>
                  <div style={S.card}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 20, fontWeight: 700 }}>{activeDietPlan.title}</span>
                      {activeDietPlan.condition && <span style={S.tag}>{activeDietPlan.condition}</span>}
                    </div>
                    {[['🌅 Breakfast', activeDietPlan.meals?.breakfast || []],['☀️ Lunch', activeDietPlan.meals?.lunch || []],['🌙 Dinner', activeDietPlan.meals?.dinner || []]].map(([meal, items]) => (
                      <div key={meal} style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, color: C.green, fontSize: 14, marginBottom: 6 }}>{meal}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {items.length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Not specified</span>}
                          {items.map(item => <span key={item} style={{ background: C.cream, border: '1px solid rgba(27,67,50,0.12)', borderRadius: 999, padding: '4px 12px', fontSize: 13, color: '#374151' }}>{item}</span>)}
                        </div>
                      </div>
                    ))}
                    {activeDietPlan.hydration && (
                      <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 8 }}>
                        <div style={{ fontWeight: 600, color: '#166534', fontSize: 13, marginBottom: 4 }}>💧 Hydration</div>
                        <p style={{ color: '#374151', fontSize: 13 }}>{activeDietPlan.hydration}</p>
                      </div>
                    )}
                    {activeDietPlan.notes && (
                      <div style={{ background: 'rgba(27,67,50,0.06)', borderRadius: 10, padding: 14, marginTop: 8 }}>
                        <div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginBottom: 4 }}>📝 Doctor's Notes</div>
                        <p style={{ color: '#374151', fontSize: 13 }}>{activeDietPlan.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div style={S.card}>
                    <h4 style={{ fontFamily: 'Playfair Display,serif', color: C.green, marginBottom: 12 }}>✅ Include</h4>
                    {(activeDietPlan.foodsToInclude || []).length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Not specified</span>}
                    {(activeDietPlan.foodsToInclude || []).map(f => <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><span style={{ color: C.sage }}>•</span><span style={{ fontSize: 13, color: '#374151' }}>{f}</span></div>)}
                  </div>
                  <div style={{ ...S.card, background: '#fef2f2', border: '1px solid rgba(220,38,38,0.12)' }}>
                    <h4 style={{ fontFamily: 'Playfair Display,serif', color: '#dc2626', marginBottom: 12 }}>⛔ Avoid</h4>
                    {(activeDietPlan.foodsToAvoid || []).length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Not specified</span>}
                    {(activeDietPlan.foodsToAvoid || []).map(f => <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><span style={{ color: '#dc2626' }}>•</span><span style={{ fontSize: 13, color: '#374151' }}>{f}</span></div>)}
                  </div>
                  <div style={{ ...S.card, background: '#fffbeb', border: '1px solid rgba(217,119,6,0.15)' }}>
                    <h4 style={{ fontFamily: 'Playfair Display,serif', color: '#92400e', marginBottom: 12 }}>🌿 Lifestyle</h4>
                    {(activeDietPlan.lifestyle || []).length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Not specified</span>}
                    {(activeDietPlan.lifestyle || []).map(l => <div key={l} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><span style={{ color: C.gold }}>•</span><span style={{ fontSize: 13, color: '#374151' }}>{l}</span></div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECORDS */}
        {tab === 'records' && <PatientRecordsPanel user={user} />}

        {/* FEEDBACK */}
        {tab === 'feedback' && <PatientFeedback />}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PATIENT: MY RECORDS (real, secured data — the API
   scopes every result to this logged-in patient only)
───────────────────────────────────────────── */
function formatRecordDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PatientRecordsPanel({ user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { records: r } = await getRecords();
      setRecords(r || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const latest = records[0];

  return (
    <div>
      <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>📋 My Health Records</h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Your complete clinical history — visible only to you and your doctor</p>

      {error && <Alert msg={error} type="error" />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={S.card}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, marginBottom: 16 }}>Personal Details</h3>
          {[['Name', user?.name], ['Email', user?.email], ['Phone', user?.phone || '—']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(27,67,50,0.06)', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{k}</span><span style={{ fontWeight: 600, color: '#1a1a1a' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, marginBottom: 16 }}>Current Care Summary</h3>
          {latest ? (
            [
              ['Last Visit', formatRecordDate(latest.visitDate)],
              ['Chief Complaint', latest.chiefComplaint],
              ['Current Remedy', latest.remedy + (latest.potency ? ` (${latest.potency})` : '')],
              ['Next Follow-up', latest.followUpDate ? formatRecordDate(latest.followUpDate) : 'Not scheduled'],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '8px 0', borderBottom: '1px solid rgba(27,67,50,0.06)', fontSize: 13 }}>
                <div style={{ color: '#6b7280', marginBottom: 2 }}>{k}</div>
                <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{v}</div>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No visits recorded yet.</p>
          )}
        </div>
      </div>

      <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 17, marginBottom: 14 }}>Visit History</h3>
      {loading && <p style={{ color: '#6b7280' }}>Loading your records…</p>}
      {!loading && records.length === 0 && (
        <p style={{ color: '#6b7280' }}>No records yet — your doctor will add visit notes here after your consultation.</p>
      )}
      {records.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 600, color: C.green }}>{formatRecordDate(r.visitDate)}</span>
            <span style={S.tag}>{r.remedy}{r.potency ? ` · ${r.potency}` : ''}</span>
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}><b>Complaint:</b> {r.chiefComplaint}</div>
          {r.diagnosis && <div style={{ fontSize: 13, color: '#374151' }}><b>Diagnosis / Constitution:</b> {r.diagnosis}</div>}
          {r.followUpDate && <div style={{ fontSize: 13, color: '#374151' }}><b>Follow-up:</b> {formatRecordDate(r.followUpDate)}</div>}
          {r.notes && <div style={{ fontSize: 13, color: C.green, marginTop: 6, background: 'rgba(27,67,50,0.05)', borderRadius: 8, padding: '6px 10px' }}>📝 {r.notes}</div>}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Recorded by {r.doctorName}</div>
        </div>
      ))}
    </div>
  );
}

function PatientFeedback() {
  const [form, setForm] = useState({ rating: 5, category: 'treatment', message: '' });
  const [alert, setAlert] = useState({ msg: '', type: 'success' });
  const [submitting, setSubmitting] = useState(false);

  const [myFeedback, setMyFeedback] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadMyFeedback = async () => {
    setHistoryLoading(true);
    try {
      const { feedback } = await getFeedback();
      setMyFeedback(feedback || []);
    } catch {
      // Non-critical — the submit form still works even if history fails to load.
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadMyFeedback(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlert({ msg: '', type: 'success' });
    try {
      await submitFeedback(form);
      setAlert({ msg: 'Thank you! Your feedback has been submitted and sent to your doctor.', type: 'success' });
      setForm({ rating: 5, category: 'treatment', message: '' });
      loadMyFeedback();
    } catch (err) {
      setAlert({ msg: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 580 }}>
      <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>⭐ Submit Feedback</h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Share your experience with Dr. Khimani</p>
      <Alert msg={alert.msg} type={alert.type} />
      <div style={S.card}>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.labelLight}>Your Rating</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[1,2,3,4,5].map(r => <button type="button" key={r} onClick={() => setForm({ ...form, rating: r })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: r <= form.rating ? '#EAB308' : '#d1d5db' }}>★</button>)}
              <span style={{ alignSelf: 'center', fontWeight: 600, color: C.green, fontSize: 14 }}>{form.rating}/5</span>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Category</label>
            <select style={S.inputLight} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="treatment">Treatment Outcome</option>
              <option value="doctor">Doctor's Care</option>
              <option value="clinic">Clinic Experience</option>
              <option value="online-consultation">Online Consultation</option>
            </select>
          </div>
          <div style={{ marginBottom: 20 }}><label style={S.labelLight}>Your Feedback</label><textarea rows={5} style={{ ...S.inputLight, resize: 'none' }} placeholder="Share your experience..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required /></div>
          <button type="submit" disabled={submitting} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Submitting…' : 'Submit Feedback →'}</button>
        </form>
      </div>

      {!historyLoading && myFeedback.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, marginBottom: 12 }}>Your Past Feedback</h3>
          {myFeedback.map(f => (
            <div key={f.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <StarRating value={f.rating} />
                <span style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <p style={{ color: '#4b5563', fontSize: 13, fontStyle: 'italic' }}>"{f.message}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   DOCTOR PORTAL
───────────────────────────────────────────── */
function DoctorPortal() {
  const { user, logout } = useAuth();

  // Guard clause: this component must never render content for a patient
  // account. If it's ever reached with a non-doctor user (defensive —
  // AppInner already prevents this), log out immediately instead of
  // showing doctor-only data/actions.
  useEffect(() => {
    if (user && user.role !== 'doctor') logout();
  }, [user]);

  const [tab, setTab] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Doctors only ever see appointments/consultations assigned to them —
  // enforced by filtering on the logged-in doctor's own id.
  const loadBookings = async () => {
    if (!user?.id) return;
    setBookingsLoading(true);
    setBookingsError('');
    try {
      const [apptRes, consultRes] = await Promise.all([
        getAppointments({ doctorId: user.id }),
        getConsultations({ doctorId: user.id }),
      ]);
      const merged = [
        ...(apptRes.appointments || []).map((a) => normalizeBooking(a, 'appointment')),
        ...(consultRes.consultations || []).map((c) => normalizeBooking(c, 'consultation')),
      ].sort((a, b) => new Date(a.date) - new Date(b.date));
      setBookings(merged);
    } catch (err) {
      setBookingsError(err.message);
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => { loadBookings(); }, [user?.id]);

  const updateBookingStatus = async (booking, status) => {
    try {
      if (booking.kind === 'consultation') await updateConsultation(booking.id, { status });
      else await updateAppointment(booking.id, { status });
      loadBookings();
    } catch (err) {
      setBookingsError(err.message);
    }
  };

  const addMeetingLink = async (booking) => {
    const link = window.prompt('Enter the video meeting link:', booking.meetingLink || '');
    if (link === null) return;
    try {
      if (booking.kind === 'consultation') {
        await updateConsultation(booking.id, { meetingLink: link });
      } else {
        await updateAppointment(booking.id, { meetingLink: link });
      }
      loadBookings();
    } catch (err) {
      setBookingsError(err.message);
    }
  };

  const addNotes = async (booking) => {
    if (booking.kind !== 'appointment') return; // consultations have no notes field
    const notes = window.prompt("Doctor's notes:", booking.notes || '');
    if (notes === null) return;
    try {
      await updateAppointment(booking.id, { notes });
      loadBookings();
    } catch (err) {
      setBookingsError(err.message);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysBookings = bookings.filter(b => b.date === todayStr);
  const onlineCount = bookings.filter(b => b.type === 'online' && b.status !== 'cancelled').length;
  const uniquePatientCount = new Set(bookings.map(b => b.patientId || b.phone || b.email)).size;
  const visibleBookings = bookings.filter(b => statusFilter === 'All' || b.status === statusFilter.toLowerCase());

  // Only bookings from a registered (logged-in) patient can be opened as a
  // linked patient record — walk-in bookings without an account have no
  // patientId to securely attach records to.
  const recentPatients = Object.values(
    bookings.filter(b => b.patientId).reduce((acc, b) => {
      const existing = acc[b.patientId];
      if (!existing || new Date(b.createdAt) > new Date(existing.createdAt)) {
        acc[b.patientId] = { id: b.patientId, name: b.patientName, condition: b.concern, createdAt: b.createdAt };
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const sidebarTabs = [
    ['dashboard','🏠 Dashboard'],['appointments','📅 Appointments'],
    ['patients','👥 Patients'],['diet','🥗 Diet Plans'],['feedback','⭐ Feedback'],
  ];

  return (
    <div style={{ ...S.page, display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 230, background: `linear-gradient(180deg,#0a1f16,${C.greenDark})`, padding: '24px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><div style={{ width: 130, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', flexShrink: 0 }}><img src="/logo-full.png" alt="Dr. Isha's Homeopathic Clinic" style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} /></div></div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>DOCTOR PANEL</div>
        </div>
        <div style={{ flex: 1, padding: '16px 12px' }}>
          {sidebarTabs.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSelectedPatient(null); }} style={{ width: '100%', textAlign: 'left', background: tab === id ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab === id ? '#fff' : 'rgba(255,255,255,0.55)', border: 'none', borderLeft: tab === id ? `3px solid ${C.gold}` : '3px solid transparent', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontSize: 13, fontWeight: tab === id ? 600 : 400, marginBottom: 2 }}>{label}</button>
          ))}
        </div>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(201,168,76,0.4)' }}><img src="/doctor.jpg" alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div><div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.name}</div><div style={{ color: C.sage, fontSize: 11 }}>Homeopath</div></div>
          </div>
          <button onClick={logout} style={{ ...S.btnOutline, width: '100%', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, background: C.cream, padding: 32, overflowY: 'auto' }}>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>Good Morning, {user?.name} 🌿</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>Here's your practice overview for today.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
              {[
                ['👥', uniquePatientCount, 'Total Patients', C.green],
                ['📅', todaysBookings.length, 'Appointments Today', '#d97706'],
                ['💻', onlineCount, 'Online Consults', C.sage],
                ['⭐','4.9','Avg Rating',C.gold],
              ].map(([ic,n,l,c]) => (
                <div key={l} style={{ ...S.card, borderTop: `4px solid ${c}` }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{ic}</div>
                  <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, fontWeight: 700, color: c }}>{n}</div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
              <div style={S.card}>
                <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, marginBottom: 16 }}>Today's Schedule</h3>
                {bookingsLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
                {!bookingsLoading && todaysBookings.length === 0 && <p style={{ color: '#6b7280', fontSize: 13 }}>Nothing scheduled for today.</p>}
                {todaysBookings.slice(0, 3).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(27,67,50,0.06)' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 18 }}>{a.type === 'online' ? '💻' : '🏥'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{a.patientName}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{a.timeSlot} · {a.concern.slice(0, 30)}…</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <StatusBadge status={a.status} />
                      {a.type === 'online' && a.meetingLink && <a href={a.meetingLink} target="_blank" rel="noreferrer" style={{ background: C.sage, color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Join</a>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, marginBottom: 14 }}>Recent Patients</h3>
                {recentPatients.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No patients yet.</p>}
                {recentPatients.slice(0, 3).map(p => (
                  <div key={p.id} onClick={() => { setSelectedPatient(p.id); setTab('patients'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(27,67,50,0.06)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{p.name[0]}</div>
                    <div><div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>{p.name}</div><div style={{ color: '#9ca3af', fontSize: 11 }}>{p.condition}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={S.sectionHLight}>📅 All Appointments</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['All','Pending','Confirmed','Completed','Cancelled'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      ...S.btnOutline, fontSize: 12, padding: '7px 14px',
                      ...(statusFilter === s ? { background: C.green, color: '#fff' } : {}),
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {bookingsError && <Alert msg={bookingsError} type="error" />}
            {bookingsLoading && <p style={{ color: '#6b7280' }}>Loading appointments…</p>}
            {!bookingsLoading && visibleBookings.length === 0 && (
              <p style={{ color: '#6b7280' }}>No appointments assigned to you{statusFilter !== 'All' ? ` with status "${statusFilter}"` : ''} yet.</p>
            )}
            {visibleBookings.map(a => (
              <div key={a.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>{a.type === 'online' ? '💻' : '🏥'}</span>
                      <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 16 }}>{a.patientName}</span>
                      <StatusBadge status={a.status} />
                      {a.type === 'online' && <span style={{ background: 'rgba(82,183,136,0.1)', color: C.sage, fontSize: 11, borderRadius: 6, padding: '2px 8px' }}>Online</span>}
                    </div>
                    <div style={{ color: '#374151', fontSize: 13, marginBottom: 3 }}>📅 {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {a.timeSlot}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Concern: {a.concern}</div>
                    {a.notes && <div style={{ color: C.green, fontSize: 13, marginTop: 6, background: 'rgba(27,67,50,0.06)', borderRadius: 8, padding: '6px 10px' }}>📝 {a.notes}</div>}
                    {a.meetingLink && <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>🔗 <a href={a.meetingLink} target="_blank" rel="noreferrer" style={{ color: C.greenMid }}>{a.meetingLink}</a></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.status === 'pending' && <button onClick={() => updateBookingStatus(a, 'confirmed')} style={{ ...S.btnGreen, fontSize: 12, padding: '8px 14px' }}>✓ Confirm</button>}
                    {a.status === 'confirmed' && <button onClick={() => updateBookingStatus(a, 'completed')} style={{ ...S.btnGreen, fontSize: 12, padding: '8px 14px' }}>✔ Mark Completed</button>}
                    {(a.status === 'pending' || a.status === 'confirmed') && <button onClick={() => updateBookingStatus(a, 'cancelled')} style={{ ...S.btnDanger, fontSize: 12, padding: '8px 14px' }}>✕ Cancel</button>}
                    {a.type === 'online' && <button onClick={() => addMeetingLink(a)} style={{ ...S.btnGold, fontSize: 12, padding: '8px 14px' }}>🔗 {a.meetingLink ? 'Edit Link' : 'Add Link'}</button>}
                    {a.kind === 'appointment' && <button onClick={() => addNotes(a)} style={{ ...S.btnOutline, fontSize: 12, padding: '8px 14px' }}>📝 Notes</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PATIENTS */}
        {tab === 'patients' && <DoctorPatientsPanel user={user} selectedPatientId={selectedPatient} setSelectedPatientId={setSelectedPatient} />}

        {/* DIET */}
        {tab === 'diet' && <DoctorDietPanel />}

        {/* FEEDBACK */}
        {tab === 'feedback' && <DoctorFeedbackPanel />}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DOCTOR: DIET PANEL
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   DOCTOR: PATIENTS + RECORDS (real, secured CRUD —
   the API scopes everything to records this doctor authored)
───────────────────────────────────────────── */
const EMPTY_RECORD_FORM = {
  visitDate: new Date().toISOString().slice(0, 10),
  chiefComplaint: '', diagnosis: '', remedy: '', potency: '', followUpDate: '', notes: '',
};

function DoctorPatientsPanel({ user, selectedPatientId, setSelectedPatientId }) {
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState('');

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_RECORD_FORM);
  const [saving, setSaving] = useState(false);

  const loadPatients = async () => {
    setPatientsLoading(true);
    setError('');
    try {
      const { patients: p } = await getMyPatients();
      setPatients(p || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadRecords = async (patientId) => {
    if (!patientId) return;
    setRecordsLoading(true);
    try {
      const { records: r } = await getRecords({ patientId });
      setRecords(r || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => { loadPatients(); }, [user?.id]);
  useEffect(() => {
    if (selectedPatientId) loadRecords(selectedPatientId);
    else { setRecords([]); setShowForm(false); setEditingId(null); }
  }, [selectedPatientId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const openAdd = () => { setForm(EMPTY_RECORD_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (r) => {
    setForm({
      visitDate: r.visitDate || '', chiefComplaint: r.chiefComplaint || '', diagnosis: r.diagnosis || '',
      remedy: r.remedy || '', potency: r.potency || '', followUpDate: r.followUpDate || '', notes: r.notes || '',
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateRecord(editingId, form);
      } else {
        await createRecord({ ...form, patientId: selectedPatientId });
      }
      setShowForm(false);
      setEditingId(null);
      await Promise.all([loadRecords(selectedPatientId), loadPatients()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (r) => {
    if (!window.confirm(`Delete the ${formatRecordDate(r.visitDate)} visit record? This cannot be undone.`)) return;
    try {
      await deleteRecord(r.id);
      await Promise.all([loadRecords(selectedPatientId), loadPatients()]);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!selectedPatientId) {
    return (
      <div>
        <h2 style={{ ...S.sectionHLight, marginBottom: 4 }}>👥 Patient Records</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>{patients.length} patient{patients.length === 1 ? '' : 's'} on your roster</p>
        {error && <Alert msg={error} type="error" />}
        {patientsLoading && <p style={{ color: '#6b7280' }}>Loading patients…</p>}
        {!patientsLoading && patients.length === 0 && (
          <p style={{ color: '#6b7280' }}>No patients yet — once someone books an appointment or online consultation with you, they'll appear here.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
          {patients.map((p) => (
            <div key={p.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setSelectedPatientId(p.id)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${C.sage},${C.green})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{p.name[0]}</div>
                <div><div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 15 }}>{p.name}</div><div style={{ color: '#9ca3af', fontSize: 12 }}>{p.email}</div></div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>📋 {p.recordCount} record{p.recordCount === 1 ? '' : 's'}{p.lastRemedy ? ` · ${p.lastRemedy}` : ''}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>Last visit: {p.lastVisit ? formatRecordDate(p.lastVisit) : 'No visits yet'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...S.btnGreen, flex: 1, fontSize: 12, padding: 8 }}>View Record</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setSelectedPatientId(null)} style={{ ...S.btnOutline, marginBottom: 20, fontSize: 13 }}>← Back to Patients</button>
      {error && <Alert msg={error} type="error" />}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: `linear-gradient(135deg,${C.sage},${C.green})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>{selectedPatient?.name?.[0]}</div>
        <div>
          <h2 style={{ ...S.sectionHLight, margin: 0 }}>{selectedPatient?.name}</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>{selectedPatient?.email}{selectedPatient?.phone ? ` · ${selectedPatient.phone}` : ''}</p>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 16, margin: 0 }}>Visit History</h3>
          {!showForm && <button onClick={openAdd} style={{ ...S.btnGold, fontSize: 12, padding: '8px 16px' }}>+ Add Visit</button>}
        </div>

        {showForm && (
          <form onSubmit={submitForm} style={{ background: C.cream, borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <h4 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 14, marginBottom: 12 }}>{editingId ? 'Edit Visit' : 'New Visit'}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.labelLight}>Visit Date</label><input style={S.inputLight} type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} required /></div>
              <div><label style={S.labelLight}>Follow-up Date</label><input style={S.inputLight} type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={S.labelLight}>Chief Complaint</label><input style={S.inputLight} value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} placeholder="e.g. Migraine episodes 3×/week" required /></div>
            <div style={{ marginBottom: 12 }}><label style={S.labelLight}>Diagnosis / Constitution</label><input style={S.inputLight} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Phosphorous type, psoric background" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.labelLight}>Remedy</label><input style={S.inputLight} value={form.remedy} onChange={(e) => setForm({ ...form, remedy: e.target.value })} placeholder="e.g. Natrum Mur" required /></div>
              <div><label style={S.labelLight}>Potency / Dosage</label><input style={S.inputLight} value={form.potency} onChange={(e) => setForm({ ...form, potency: e.target.value })} placeholder="e.g. 200C, 1 dose weekly" /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={S.labelLight}>Notes</label><textarea rows={3} style={{ ...S.inputLight, resize: 'none' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Response, observations, next steps…" /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{ ...S.btnGreen, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Visit'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={S.btnOutline}>Cancel</button>
            </div>
          </form>
        )}

        {recordsLoading && <p style={{ color: '#6b7280' }}>Loading visit history…</p>}
        {!recordsLoading && records.length === 0 && <p style={{ color: '#6b7280' }}>No visits recorded yet.</p>}
        {records.map((r) => (
          <div key={r.id} style={{ borderBottom: '1px solid rgba(27,67,50,0.06)', padding: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 600, color: C.green, fontSize: 14 }}>{formatRecordDate(r.visitDate)}</span>
                {r.followUpDate && <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 10 }}>Follow-up: {formatRecordDate(r.followUpDate)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={S.tag}>{r.remedy}{r.potency ? ` · ${r.potency}` : ''}</span>
                <button onClick={() => openEdit(r)} style={{ ...S.btnOutline, fontSize: 11, padding: '5px 10px' }}>Edit</button>
                <button onClick={() => removeRecord(r)} style={{ ...S.btnDanger, fontSize: 11, padding: '5px 10px' }}>Delete</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}><b>Complaint:</b> {r.chiefComplaint}</div>
            {r.diagnosis && <div style={{ fontSize: 13, color: '#374151' }}><b>Diagnosis:</b> {r.diagnosis}</div>}
            {r.notes && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>📝 {r.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_DIET_FORM = {
  title: '', condition: '', breakfastItems: '', lunchItems: '', dinnerItems: '',
  include: '', avoid: '', hydration: '', lifestyle: '', notes: '', status: 'active',
};

function DoctorDietPanel() {
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [form, setForm] = useState(EMPTY_DIET_FORM);
  const [saving, setSaving] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  const loadPatients = async () => {
    setPatientsLoading(true);
    try {
      const { patients: p } = await getMyPatients();
      setPatients(p || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const { plans: pl } = await getDietPlans();
      setPlans(pl || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => { loadPatients(); loadPlans(); }, []);

  const applyTemplate = (tpl) => {
    setForm((f) => ({
      ...f,
      title: tpl.title,
      condition: tpl.condition,
      breakfastItems: tpl.meals.join('\n'),
      include: tpl.include,
      avoid: tpl.avoid,
    }));
  };

  const openAdd = () => {
    setForm(EMPTY_DIET_FORM);
    setSelectedPatientId('');
    setEditingId(null);
    setShowForm(true);
    setAlert('');
  };

  const openEdit = (p) => {
    setForm({
      title: p.title || '',
      condition: p.condition || '',
      breakfastItems: (p.meals?.breakfast || []).join('\n'),
      lunchItems: (p.meals?.lunch || []).join('\n'),
      dinnerItems: (p.meals?.dinner || []).join('\n'),
      include: (p.foodsToInclude || []).join('\n'),
      avoid: (p.foodsToAvoid || []).join('\n'),
      hydration: p.hydration || '',
      lifestyle: (p.lifestyle || []).join('\n'),
      notes: p.notes || '',
      status: p.status || 'active',
    });
    setSelectedPatientId(p.patientId);
    setEditingId(p.id);
    setShowForm(true);
    setAlert('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      condition: form.condition,
      breakfast: form.breakfastItems,
      lunch: form.lunchItems,
      dinner: form.dinnerItems,
      foodsToInclude: form.include,
      foodsToAvoid: form.avoid,
      hydration: form.hydration,
      lifestyle: form.lifestyle,
      notes: form.notes,
      status: form.status,
    };
    try {
      if (editingId) {
        await updateDietPlan(editingId, payload);
        setAlert('Diet plan updated successfully!');
      } else {
        await createDietPlan({ ...payload, patientId: selectedPatientId });
        setAlert('Diet plan created and assigned to patient successfully!');
      }
      setShowForm(false);
      setEditingId(null);
      await loadPlans();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (p) => {
    if (!window.confirm(`Delete "${p.title}" for ${p.patientName}? This cannot be undone.`)) return;
    try {
      await deleteDietPlan(p.id);
      await loadPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={S.sectionHLight}>🥗 Diet Plans</h2>
        <button onClick={() => (showForm ? setShowForm(false) : openAdd())} style={S.btnGold}>{showForm ? '✕ Cancel' : '+ Create Plan'}</button>
      </div>
      <Alert msg={alert} />
      {error && <Alert msg={error} type="error" />}

      {showForm && (
        <div style={{ ...S.card, background: `linear-gradient(135deg,${C.green},${C.greenDark})`, marginBottom: 24 }}>
          <h3 style={S.sectionH}>{editingId ? 'Edit Diet Plan' : 'Create Diet Plan'}</h3>
          {!editingId && (
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Quick-fill from a template (optional)</label>
              <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} defaultValue="" onChange={(e) => {
                const tpl = DIET_TEMPLATES.find((t) => t.title === e.target.value);
                if (tpl) applyTemplate(tpl);
              }}>
                <option value="">Start from scratch</option>
                {DIET_TEMPLATES.map((t) => <option key={t.title} value={t.title}>{t.emoji} {t.title}</option>)}
              </select>
            </div>
          )}
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label style={S.label}>Patient</label>
                <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} required disabled={!!editingId}>
                  <option value="">{patientsLoading ? 'Loading patients…' : 'Select patient'}</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {!patientsLoading && patients.length === 0 && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>No patients yet — once someone books with you, they'll appear here.</div>
                )}
              </div>
              <div><label style={S.label}>Plan Title</label><input style={S.input} placeholder="e.g. Anti-Inflammatory Diet" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Health Condition / Goal</label><input style={S.input} placeholder="e.g. PCOS, Arthritis, Immunity" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label style={S.label}>Breakfast Items</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="One item per line" value={form.breakfastItems} onChange={e => setForm({ ...form, breakfastItems: e.target.value })} /></div>
              <div><label style={S.label}>Lunch Items</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="One item per line" value={form.lunchItems} onChange={e => setForm({ ...form, lunchItems: e.target.value })} /></div>
              <div><label style={S.label}>Dinner Items</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="One item per line" value={form.dinnerItems} onChange={e => setForm({ ...form, dinnerItems: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><label style={S.label}>Foods to Include</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="Turmeric, Ginger, Berries..." value={form.include} onChange={e => setForm({ ...form, include: e.target.value })} /></div>
              <div><label style={S.label}>Foods to Avoid</label><textarea rows={3} style={{ ...S.input, resize: 'none' }} placeholder="Sugar, Fried foods..." value={form.avoid} onChange={e => setForm({ ...form, avoid: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Hydration Notes</label><input style={S.input} placeholder="8-10 glasses warm water daily..." value={form.hydration} onChange={e => setForm({ ...form, hydration: e.target.value })} /></div>
            <div style={{ marginBottom: 14 }}><label style={S.label}>Lifestyle Tips</label><textarea rows={2} style={{ ...S.input, resize: 'none' }} placeholder="One tip per line — sleep, screen time, walks..." value={form.lifestyle} onChange={e => setForm({ ...form, lifestyle: e.target.value })} /></div>
            <div style={{ marginBottom: 20 }}><label style={S.label}>Additional Notes</label><textarea rows={2} style={{ ...S.input, resize: 'none' }} placeholder="Anything else for the patient..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            {editingId && (
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>Status</label>
                <select style={{ ...S.input, background: 'rgba(27,67,50,0.9)' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
            <button type="submit" disabled={saving} style={{ ...S.btnGold, width: '100%', padding: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : editingId ? 'Save Changes →' : 'Create & Assign Diet Plan →'}</button>
          </form>
        </div>
      )}

      <h3 style={{ fontFamily: 'Playfair Display,serif', color: C.green, fontSize: 17, marginBottom: 14 }}>Assigned Plans</h3>
      {plansLoading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading plans…</p>}
      {!plansLoading && plans.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No diet plans created yet — use "+ Create Plan" to assign one to a patient.</p>
      )}
      {plans.map((p) => (
        <div key={p.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 15 }}>{p.patientName}</span>
              <span style={{ ...S.tag, marginLeft: 10 }}>{p.title}</span>
              {p.status === 'inactive' && <span style={{ ...S.tag, marginLeft: 6, color: '#9ca3af', borderColor: '#e5e7eb' }}>Inactive</span>}
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Condition: {p.condition || '—'} · Assigned {formatRecordDate(p.createdAt)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openEdit(p)} style={{ ...S.btnGold, fontSize: 12, padding: '7px 14px' }}>Edit</button>
              <button onClick={() => setViewingId(viewingId === p.id ? null : p.id)} style={{ ...S.btnOutline, fontSize: 12, padding: '7px 14px' }}>{viewingId === p.id ? 'Hide' : 'View'}</button>
              <button onClick={() => removePlan(p)} style={{ ...S.btnDanger, fontSize: 12, padding: '7px 14px' }}>Delete</button>
            </div>
          </div>
          {viewingId === p.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(27,67,50,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginBottom: 6 }}>🌅 Breakfast</div>
                <div style={{ color: '#374151', fontSize: 13 }}>{(p.meals?.breakfast || []).join(', ') || '—'}</div>
                <div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginTop: 10, marginBottom: 6 }}>☀️ Lunch</div>
                <div style={{ color: '#374151', fontSize: 13 }}>{(p.meals?.lunch || []).join(', ') || '—'}</div>
                <div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginTop: 10, marginBottom: 6 }}>🌙 Dinner</div>
                <div style={{ color: '#374151', fontSize: 13 }}>{(p.meals?.dinner || []).join(', ') || '—'}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginBottom: 6 }}>✅ Include</div>
                <div style={{ color: '#374151', fontSize: 13 }}>{(p.foodsToInclude || []).join(', ') || '—'}</div>
                <div style={{ fontWeight: 600, color: '#dc2626', fontSize: 13, marginTop: 10, marginBottom: 6 }}>⛔ Avoid</div>
                <div style={{ color: '#374151', fontSize: 13 }}>{(p.foodsToAvoid || []).join(', ') || '—'}</div>
                {p.hydration && (<><div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginTop: 10, marginBottom: 6 }}>💧 Hydration</div><div style={{ color: '#374151', fontSize: 13 }}>{p.hydration}</div></>)}
                {p.notes && (<><div style={{ fontWeight: 600, color: C.green, fontSize: 13, marginTop: 10, marginBottom: 6 }}>📝 Notes</div><div style={{ color: '#374151', fontSize: 13 }}>{p.notes}</div></>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   DOCTOR: FEEDBACK PANEL
───────────────────────────────────────────── */
const FEEDBACK_CATEGORY_LABELS = {
  treatment: 'Treatment Outcome',
  doctor: "Doctor's Care",
  clinic: 'Clinic Experience',
  'online-consultation': 'Online Consultation',
  general: 'General',
};

function DoctorFeedbackPanel() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeedback = async () => {
    setLoading(true);
    setError('');
    try {
      const { feedback } = await getFeedback();
      setFeedbacks(feedback || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeedback(); }, []);

  const avg = feedbacks.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : '0.0';
  const recommendPct = feedbacks.length
    ? Math.round((feedbacks.filter(f => f.rating >= 4).length / feedbacks.length) * 100)
    : 0;

  return (
    <div>
      <h2 style={{ ...S.sectionHLight, marginBottom: 20 }}>⭐ Patient Feedback</h2>
      {error && <Alert msg={error} type="error" />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ ...S.card, borderTop: `4px solid ${C.gold}`, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 40, fontWeight: 700, color: C.gold }}>{avg}</div>
          <StarRating value={Math.round(parseFloat(avg))} />
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Average Rating</div>
        </div>
        <div style={{ ...S.card, textAlign: 'center', borderTop: `4px solid ${C.sage}` }}>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 40, fontWeight: 700, color: C.sage }}>{feedbacks.length}</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>Total Reviews</div>
        </div>
        <div style={{ ...S.card, textAlign: 'center', borderTop: `4px solid ${C.green}` }}>
          <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 40, fontWeight: 700, color: C.green }}>{recommendPct}%</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>Would Recommend</div>
        </div>
      </div>
      {loading && <p style={{ color: '#6b7280' }}>Loading feedback…</p>}
      {!loading && feedbacks.length === 0 && <p style={{ color: '#6b7280' }}>No patient feedback yet.</p>}
      {feedbacks.map((f) => (
        <div key={f.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{f.patientName?.[0] || '?'}</div>
              <div>
                <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{f.patientName}</div>
                <div style={{ color: '#9ca3af', fontSize: 12 }}>{FEEDBACK_CATEGORY_LABELS[f.category] || f.category} · {new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>
            <StarRating value={f.rating} />
          </div>
          <p style={{ color: '#4b5563', fontSize: 13, fontStyle: 'italic' }}>"{f.message}"</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────── */
export default function App() {
  const [portal, setPortal] = useState('public');

  return (
    <AuthProvider>
      <AppInner portal={portal} setPortal={setPortal} />
    </AuthProvider>
  );
}

function AppInner({ portal, setPortal }) {
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (user) setPortal(user.role === 'doctor' ? 'doctor' : 'patient');
    else setPortal('public');
  }, [user, authLoading]);

  if (authLoading) {
    return <div style={{ padding: '80px 20px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>;
  }

  // Defense in depth: `portal` is local UI state, but which dashboard
  // actually renders is always re-derived from the authenticated user's
  // server-issued role below, never from `portal` alone. This means even
  // a stale/out-of-sync `portal` value can never open the wrong dashboard
  // for the logged-in account — a doctor can never see PatientPortal, and
  // a patient can never see DoctorPortal, regardless of local state.
  if (user?.role === 'doctor') return <DoctorPortal />;
  if (user?.role === 'patient') return <PatientPortal />;
  // No authenticated user (or portal state without a matching session,
  // e.g. session expired mid-navigation) — always fall back to public
  // rather than rendering either dashboard unauthenticated.
  return <PublicSite onNavigate={setPortal} />;
}
