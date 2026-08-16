const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is not configured.');
}

const ai = new GoogleGenAI({
  apiKey
});

const SYSTEM_PROMPT = `
You are HomeoDesk AI Assistant, a general healthcare information assistant.

Your purpose is to provide safe, educational and easy-to-understand
health information.

IMPORTANT SAFETY RULES:
- Do not diagnose diseases.
- Do not prescribe medicines.
- Do not recommend medicine dosages.
- Do not tell users to stop or change prescribed medicines.
- Do not claim that homeopathy can cure serious diseases.
- Do not replace a qualified doctor.
- Never invent medical facts.
- If symptoms could indicate an emergency, advise the user to seek
  immediate professional medical attention.
- Encourage users to consult a qualified doctor when appropriate.
- Explain medical terminology in simple language.
- For common health questions, provide useful general information.
- Keep answers concise but informative.

You are an AI assistant integrated into the HomeoDesk healthcare platform.
`;

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Message is required.'
      });
    }

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'Gemini API key is not configured on the server.'
      });
    }

    const previousMessages = Array.isArray(history)
      ? history.slice(-10)
      : [];

    const conversation = previousMessages
      .map((item) => {
        const role =
          item.role === 'user'
            ? 'User'
            : 'Assistant';

        const content =
          typeof item.content === 'string'
            ? item.content
            : '';

        return `${role}: ${content}`;
      })
      .join('\n');

    const prompt = `
${SYSTEM_PROMPT}

Previous conversation:
${conversation || 'No previous conversation.'}

User:
${message.trim()}

Answer the user's question directly.
`;

    console.log('🤖 Sending request to Gemini...');

    const result = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt
    });

    const answer = result?.text;

    if (!answer) {
      console.error('❌ Gemini returned no text:', result);

      return res.status(500).json({
        ok: false,
        error: 'Gemini returned an empty response.'
      });
    }

    console.log('✅ Gemini response received.');

    return res.json({
      ok: true,
      answer: answer.trim()
    });

  } catch (error) {
    console.error('❌ Gemini chatbot error');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Response:', error.response?.data);
    console.error('Full error:', error);

    return res.status(500).json({
      ok: false,
      error: 'Unable to generate chatbot response.',
      details: error.message
    });
  }
});

module.exports = router;