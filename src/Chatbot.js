import { useEffect, useRef, useState } from 'react';

/* =========================================================
   DESIGN TOKENS
========================================================= */

const C = {
  greenDark: '#0d2b1e',
  green: '#1B4332',
  greenMid: '#2d6a4f',
  sage: '#52B788',
  gold: '#C9A84C',
  cream: '#F8F5F0',
};

/* =========================================================
   API CONFIGURATION

   Local:
   REACT_APP_API_URL=http://localhost:5000/api

   Production:
   REACT_APP_API_URL=https://homeodesk.onrender.com/api
========================================================= */

const API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/* =========================================================
   SYMPTOM ROUTES

   These are kept locally because they are directly connected
   to your HomeoDesk booking functionality.
========================================================= */

const SYMPTOM_ROUTES = [
  {
    keywords: ['migraine', 'headache', 'head pain', 'head ache'],
    focus: 'Chronic Headache & Migraine Care',
    reply:
      "Recurring headaches or migraines can have many causes. A proper consultation is recommended to understand the symptoms, triggers, duration and medical history.",
    concern: 'Recurring headaches / migraine',
    type: 'in-clinic',
  },

  {
    keywords: [
      'skin',
      'rash',
      'eczema',
      'acne',
      'psoriasis',
      'allergy on skin',
      'itching',
    ],
    focus: 'Skin Disorders',
    reply:
      'Skin symptoms can have different causes. A consultation can help assess the symptoms and determine whether further medical evaluation is needed.',
    concern: 'Skin issue (rash/allergy/acne)',
    type: 'in-clinic',
  },

  {
    keywords: [
      'child',
      'kid',
      'son',
      'daughter',
      'baby',
      'infant',
      'toddler',
      'pediatric',
    ],
    focus: 'Pediatric Care',
    reply:
      'For children, it is important to consider their age, symptoms, medical history and current medications. A qualified healthcare professional should evaluate persistent or concerning symptoms.',
    concern: "Child's health concern",
    type: 'in-clinic',
  },

  {
    keywords: [
      'stress',
      'anxiety',
      'anxious',
      'low mood',
      'overwhelmed',
      'panic',
      'sleep',
      'insomnia',
      "can't sleep",
      'cant sleep',
    ],
    focus: 'Mental Wellness & Sleep Support',
    reply:
      'Stress, anxiety and sleep problems can have several causes. If symptoms are persistent or affecting daily life, consider speaking with a qualified healthcare professional.',
    concern: 'Stress / sleep / mood support',
    type: 'online',
  },

  {
    keywords: [
      'period',
      'pcos',
      'pcod',
      'hormonal',
      'menstrual',
      'irregular periods',
      'pregnancy',
      'fertility',
      "women's health",
      'womens health',
    ],
    focus: "Women's Health",
    reply:
      'Menstrual and hormonal symptoms can have different causes. A healthcare professional can assess your history and determine whether further evaluation is appropriate.',
    concern: "Women's health / hormonal concern",
    type: 'in-clinic',
  },

  {
    keywords: [
      'joint pain',
      'arthritis',
      'back pain',
      'knee pain',
      'body pain',
      'muscle pain',
    ],
    focus: 'Chronic Pain & Joint Care',
    reply:
      'Persistent joint or muscle pain should be evaluated based on its location, duration, severity and associated symptoms.',
    concern: 'Joint / chronic pain',
    type: 'in-clinic',
  },

  {
    keywords: [
      'asthma',
      'breathing',
      'breathless',
      'wheeze',
      'cough',
      'cold',
      'sinus',
      'sinusitis',
      'allergy',
      'allergies',
    ],
    focus: 'Respiratory & Allergy Care',
    reply:
      'Respiratory symptoms can range from mild conditions to problems requiring urgent evaluation. Persistent or worsening symptoms should be assessed by a healthcare professional.',
    concern: 'Respiratory / allergy issue',
    type: 'online',
  },

  {
    keywords: [
      'stomach',
      'digestion',
      'acidity',
      'constipation',
      'ibs',
      'bloating',
      'gas',
    ],
    focus: 'Digestive Health',
    reply:
      'Digestive symptoms can have many causes, including diet, medications and underlying conditions. Persistent symptoms are worth discussing with a healthcare professional.',
    concern: 'Digestive health concern',
    type: 'online',
  },

  {
    keywords: [
      'fatigue',
      'tired',
      'low energy',
      'weakness',
      'immunity',
      'immune',
    ],
    focus: 'Fatigue & General Health',
    reply:
      'Persistent fatigue or weakness can have many possible causes. A healthcare professional can help assess the overall picture.',
    concern: 'Fatigue / general health concern',
    type: 'online',
  },
];

/* =========================================================
   EMERGENCY KEYWORDS

   These are handled BEFORE sending anything to Gemini.
========================================================= */

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'cant breathe',
  "can't breathe",
  'cannot breathe',
  'difficulty breathing',
  'severe bleeding',
  'unconscious',
  'stroke',
  'heart attack',
  'suicidal',
  'suicide',
  'kill myself',
  'self harm',
  'self-harm',
  'overdose',
  'seizure',
  'not breathing',
  'severe allergic reaction',
  'anaphylaxis',
];

/* =========================================================
   LOCAL CLINIC FAQS

   These don't need Gemini because they are specific to
   your HomeoDesk application.
========================================================= */

const FAQS = [
  {
    keywords: ['timing', 'timings', 'hours', 'open', 'closed', 'when are you open'],
    reply:
      'Clinic hours are Mon–Sat, 9:00 AM – 7:00 PM, and Sunday 10 AM – 1 PM (online only).',
  },

  {
    keywords: ['address', 'location', 'where are you', 'clinic location'],
    reply:
      'The clinic is at 204 Wellness Tower, CG Road, Ahmedabad, Gujarat 380009.',
  },

  {
    keywords: ['price', 'cost', 'fee', 'fees', 'charge', 'charges'],
    reply:
      'Fees vary by consultation type. Please call +91 99999 88888 or ask during booking and our team will confirm the exact pricing before your appointment.',
  },

  {
    keywords: ['cancel', 'reschedule', 'change appointment'],
    reply:
      "You can cancel or manage a booking from your patient dashboard after logging in. If you booked without an account, contact the clinic to help you reschedule.",
  },

  {
    keywords: ['online consult', 'video call', 'video consultation'],
    reply:
      'Online consultations happen over a secure video call. Once booked, the consultation link can be provided according to your appointment details.',
  },

  {
    keywords: ['contact', 'phone number', 'call you'],
    reply:
      'You can reach the clinic at +91 99999 88888 or contact@homeodesk.in.',
  },
];

/* =========================================================
   COMMON WORDS
========================================================= */

const GREETING_WORDS = [
  'hi',
  'hello',
  'hey',
  'namaste',
  'good morning',
  'good afternoon',
  'good evening',
];

const BOOKING_WORDS = [
  'book',
  'appointment',
  'schedule',
  'slot',
  'consult',
  'consultation',
];

const THANKS_WORDS = ['thank', 'thanks', 'thank you'];

/* =========================================================
   HELPERS
========================================================= */

function matches(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

/* =========================================================
   LOCAL RESPONSE

   Returns null when the question should be sent to Gemini.
========================================================= */

function getLocalReply(rawText) {
  const text = rawText.toLowerCase().trim();

  /* Emergency */

  if (matches(text, EMERGENCY_KEYWORDS)) {
    return {
      text:
        'This may be an emergency. Please seek immediate medical attention rather than relying on an online chatbot. In India, call 112 or go to the nearest emergency department.',
      chips: [],
      note:
        'For emergencies, please use emergency medical services rather than waiting for an online consultation.',
    };
  }

  /* Booking */

  if (matches(text, BOOKING_WORDS)) {
    return {
      text:
        'I can help you start an appointment. Would you like an in-clinic visit or an online consultation?',
      chips: ['In-clinic', 'Online'],
      action: {
        concern: '',
        type: '',
        label: '📅 Open Booking Form',
      },
    };
  }

  /* Greetings */

  if (matches(text, GREETING_WORDS)) {
    return {
      text:
        "Hi! I'm the HomeoDesk Assistant 🌿 I can answer general health questions, provide basic health information, help with clinic information, or help you start an appointment.",
      chips: [
        'I have symptoms',
        'Book an appointment',
        'Clinic timings',
      ],
    };
  }

  /* Thanks */

  if (matches(text, THANKS_WORDS)) {
    return {
      text: 'You are welcome! Is there anything else I can help you with?',
      chips: [
        'Ask another health question',
        'Book an appointment',
      ],
    };
  }

  /* In-clinic */

  if (text.includes('in-clinic')) {
    return {
      text:
        'Got it — an in-clinic consultation. Let me open the booking form for you.',
      action: {
        concern: '',
        type: 'in-clinic',
        label: '📅 Continue to Booking',
      },
    };
  }

  /* Online */

  if (text === 'online' || text.includes('online consultation')) {
    return {
      text:
        'Got it — an online consultation. Let me open the booking form for you.',
      action: {
        concern: '',
        type: 'online',
        label: '📅 Continue to Booking',
      },
    };
  }

  /* Clinic FAQ */

  const faqMatch = FAQS.find((faq) =>
    matches(text, faq.keywords)
  );

  if (faqMatch) {
    return {
      text: faqMatch.reply,
      chips: [
        'Ask another question',
        'Book an appointment',
      ],
    };
  }

  /* Symptom routing */

  const routeMatches = SYMPTOM_ROUTES.filter((route) =>
    matches(text, route.keywords)
  );

  if (routeMatches.length > 0) {
    const route = routeMatches[0];

    return {
      text:
        `${route.reply}\n\n` +
        `Suggested consultation focus: ${route.focus}.\n\n` +
        `Would you like to book a consultation with this concern?`,
      action: {
        concern: route.concern,
        type: route.type,
        label: `📅 Book Now — ${route.focus}`,
      },
      chips: ['Ask another health question', 'Book an appointment'],
      note:
        'This is general health information and not a medical diagnosis.',
    };
  }

  /*
    IMPORTANT:

    Return null here.

    This tells the application that the question is NOT one
    of our fixed local questions and should be sent to Gemini.
  */

  return null;
}

/* =========================================================
   CHAT UI STYLES
========================================================= */

const styles = {
  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 1000,
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: `linear-gradient(135deg,${C.gold},#d4b96a)`,
    color: C.green,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    fontSize: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  panel: {
    position: 'fixed',
    bottom: 96,
    right: 24,
    zIndex: 1000,
    width: 360,
    maxWidth: '92vw',
    height: 540,
    maxHeight: '75vh',
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },

  header: {
    background: `linear-gradient(135deg,${C.greenDark},${C.green})`,
    padding: '16px 18px',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },

  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 14px 6px',
    background: C.cream,
  },

  inputRow: {
    display: 'flex',
    gap: 8,
    padding: 10,
    borderTop: '1px solid rgba(27,67,50,0.08)',
    background: '#fff',
    flexShrink: 0,
  },

  input: {
    flex: 1,
    border: '1px solid rgba(27,67,50,0.15)',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },

  sendBtn: {
    background: C.green,
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 38,
    height: 38,
    cursor: 'pointer',
    fontSize: 15,
    flexShrink: 0,
  },

  bubbleBot: {
    background: '#fff',
    color: '#1a1a1a',
    border: '1px solid rgba(27,67,50,0.08)',
    borderRadius: '4px 16px 16px 16px',
    padding: '10px 13px',
    fontSize: 13.5,
    lineHeight: 1.55,
    maxWidth: '85%',
    marginBottom: 4,
    whiteSpace: 'pre-line',
  },

  bubbleUser: {
    background: C.green,
    color: '#fff',
    borderRadius: '16px 4px 16px 16px',
    padding: '10px 13px',
    fontSize: 13.5,
    lineHeight: 1.5,
    maxWidth: '85%',
    marginBottom: 4,
    marginLeft: 'auto',
  },

  note: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: '2px 0 10px 2px',
  },

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    margin: '0 0 12px 2px',
  },

  chip: {
    background: 'rgba(82,183,136,0.1)',
    border: '1px solid rgba(82,183,136,0.3)',
    color: C.green,
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },

  actionBtn: {
    background: `linear-gradient(135deg,${C.gold},#d4b96a)`,
    color: C.green,
    border: 'none',
    borderRadius: 999,
    padding: '9px 16px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    margin: '0 0 12px 2px',
    display: 'inline-block',
  },

  typingDot: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: '0 0 10px 2px',
  },
};

/* =========================================================
   MESSAGE ID
========================================================= */

let msgId = 0;

const nextId = () => `m${++msgId}-${Date.now()}`;

/* =========================================================
   CHATBOT COMPONENT
========================================================= */

export default function Chatbot({ onBook }) {
  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: nextId(),
      role: 'bot',
      text:
        "Hi! I'm the HomeoDesk Assistant 🌿 I can answer general health questions, provide basic health information, help with clinic information, or help you book an appointment.",
      note:
        "I'm not a substitute for professional medical advice. For emergencies, seek immediate medical care.",
      chips: [
        'I have symptoms',
        'Book an appointment',
        'Ask a health question',
        'Clinic timings',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const bodyRef = useRef(null);

  /* =========================================================
     AUTO SCROLL
  ========================================================= */

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop =
        bodyRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  /* =========================================================
     CALL GEMINI BACKEND
  ========================================================= */

  const askBackend = async (userText) => {
    try {
      /*
        Only send the previous conversation to the backend.

        We limit it to the last 10 messages so the request
        doesn't become unnecessarily large.
      */

      const history = messages
        .slice(-10)
        .map((message) => ({
          role:
            message.role === 'user'
              ? 'user'
              : 'assistant',
          content: message.text,
        }));

      const response = await fetch(
        `${API_URL}/chatbot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userText,
            history,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || 'Chatbot API request failed.'
        );
      }

      return data.answer;
    } catch (error) {
      console.error('Chatbot API error:', error);

      return (
        "I'm having trouble connecting to the AI assistant right now. " +
        'Please try again in a moment, or you can book a consultation directly.'
      );
    }
  };

  /* =========================================================
     SEND MESSAGE
  ========================================================= */

  const send = async (textOverride) => {
    const text = (
      textOverride !== undefined
        ? textOverride
        : input
    ).trim();

    if (!text || typing) {
      return;
    }

    /* Add user message */

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        text,
      },
    ]);

    setInput('');
    setTyping(true);

    try {
      /*
        First check local functionality.

        This handles:
        - emergencies
        - bookings
        - clinic FAQ
        - symptom → booking routing
        - greetings

        If nothing matches, getLocalReply() returns null
        and we call Gemini.
      */

      const localReply = getLocalReply(text);

      if (localReply) {
        /*
          Small delay makes the chatbot feel natural.
        */

        await new Promise((resolve) =>
          setTimeout(resolve, 350)
        );

        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'bot',
            ...localReply,
          },
        ]);

        return;
      }

      /*
        No local match.

        Send the question to Gemini through your backend.
      */

      const answer = await askBackend(text);

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'bot',
          text: answer,
          note:
            'AI-generated general health information. This is not a medical diagnosis or a substitute for professional medical care.',
          chips: [
            'Ask another health question',
            'Book an appointment',
          ],
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  /* =========================================================
     BOOKING ACTION
  ========================================================= */

  const handleAction = (action) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        text: action.label,
      },
    ]);

    if (onBook) {
      onBook(
        action.concern || '',
        action.type || ''
      );
    }

    setTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'bot',
          text:
            "Done — I've opened the booking form" +
            (action.concern
              ? ' with your concern filled in.'
              : '.') +
            ' Just add your details and submit.',
        },
      ]);

      setTyping(false);
    }, 350);
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      {/* Floating button */}

      <button
        onClick={() => setOpen((value) => !value)}
        style={styles.fab}
        aria-label={
          open
            ? 'Close chat assistant'
            : 'Open chat assistant'
        }
        title="Chat with HomeoDesk Assistant"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}

      {open && (
        <div
          style={styles.panel}
          role="dialog"
          aria-label="HomeoDesk chat assistant"
        >
          {/* Header */}

          <div style={styles.header}>
            <div>
              <div
                style={{
                  fontFamily:
                    'Playfair Display, serif',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                🌿 HomeoDesk Assistant
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color:
                    'rgba(255,255,255,0.65)',
                  marginTop: 2,
                }}
              >
                AI Health Assistant · Bookings ·
                Clinic Info
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color:
                  'rgba(255,255,255,0.7)',
                fontSize: 16,
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Messages */}

          <div
            style={styles.body}
            ref={bodyRef}
          >
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  style={
                    message.role === 'bot'
                      ? styles.bubbleBot
                      : styles.bubbleUser
                  }
                >
                  {message.text}
                </div>

                {/* Disclaimer */}

                {message.role === 'bot' &&
                  message.note && (
                    <div style={styles.note}>
                      ℹ️ {message.note}
                    </div>
                  )}

                {/* Booking action */}

                {message.role === 'bot' &&
                  message.action && (
                    <button
                      style={styles.actionBtn}
                      onClick={() =>
                        handleAction(
                          message.action
                        )
                      }
                    >
                      {message.action.label}
                    </button>
                  )}

                {/* Quick chips */}

                {message.role === 'bot' &&
                  message.chips &&
                  message.chips.length > 0 && (
                    <div
                      style={styles.chipsRow}
                    >
                      {message.chips.map(
                        (chip) => (
                          <button
                            key={chip}
                            style={styles.chip}
                            onClick={() =>
                              send(chip)
                            }
                            disabled={typing}
                          >
                            {chip}
                          </button>
                        )
                      )}
                    </div>
                  )}
              </div>
            ))}

            {/* Typing indicator */}

            {typing && (
              <div style={styles.typingDot}>
                Assistant is typing…
              </div>
            )}
          </div>

          {/* Input */}

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Describe your symptom or ask a question…"
              value={input}
              disabled={typing}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  send();
                }
              }}
            />

            <button
              style={{
                ...styles.sendBtn,
                opacity: typing ? 0.6 : 1,
              }}
              onClick={() => send()}
              disabled={typing}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}