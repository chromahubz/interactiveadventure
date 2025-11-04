// API Configuration
// Replace these with your actual API keys
export const API_CONFIG = {
    GEMINI_API_KEY: 'AIzaSyD_qu413X6P6rfZwzN_lpG1QREQB9j6V5Y', // Get from: https://aistudio.google.com/app/apikey
    GROQ_API_KEY: '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', // Get from: https://console.groq.com/ (also used for TTS)
    FIREWORKS_API_KEY: 'fw_3ZQ21zN3zE1WkiNVRfRnM1CE' // Get from: https://fireworks.ai/
};

// LLM Model tiers - user-friendly names
export const MODEL_TIERS = {
    BEST: {
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        displayName: 'Best'
    },
    STANDARD: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        displayName: 'Standard'
    },
    BASIC: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        displayName: 'Basic'
    }
};

// Models
export const MODELS = {
    GEMINI: 'gemini-2.0-flash-exp',
    GROQ_BEST: 'llama-3.3-70b-versatile',
    GROQ_FAST: 'llama-3.1-8b-instant',
    FIREWORKS_IMAGE: 'flux-1-schnell-fp8',
    ELEVENLABS_MODEL: 'eleven_turbo_v2_5'
};

// Groq PlayAI-TTS Voice Names (27 voices - all real voices from Groq API)
// Format: voice name WITHOUT -PlayAI suffix (apiHelper.js adds it)
export const VOICES = {
    // Female Voices
    AALIYAH: 'Aaliyah',
    ADELAIDE: 'Adelaide',
    ARISTA: 'Arista',
    CELESTE: 'Celeste',
    CHEYENNE: 'Cheyenne',
    DEEDEE: 'Deedee',
    ELEANOR: 'Eleanor',
    GAIL: 'Gail',
    JENNIFER: 'Jennifer',
    JUDY: 'Judy',
    MAMAW: 'Mamaw',
    NIA: 'Nia',
    RUBY: 'Ruby',

    // Male Voices
    ANGELO: 'Angelo',
    ATLAS: 'Atlas',
    BASIL: 'Basil',
    BRIGGS: 'Briggs',
    CALUM: 'Calum',
    CHIP: 'Chip',
    CILLIAN: 'Cillian',
    FRITZ: 'Fritz',
    MASON: 'Mason',
    MIKAIL: 'Mikail',
    MITCH: 'Mitch',
    THUNDER: 'Thunder',

    // Neutral/Androgynous
    INDIGO: 'Indigo',
    QUINN: 'Quinn',

    // Legacy names for backward compatibility
    NARRATOR: 'Calum',
    MALE: 'Mason',
    FEMALE: 'Celeste',
    MYSTERIOUS: 'Indigo'
};
