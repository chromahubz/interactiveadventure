// API Configuration
// Replace these with your actual API keys
export const API_CONFIG = {
    GEMINI_API_KEY: 'AIzaSyD_qu413X6P6rfZwzN_lpG1QREQB9j6V5Y', // Get from: https://aistudio.google.com/app/apikey
    GROQ_API_KEY: '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', // Get from: https://console.groq.com/
    FIREWORKS_API_KEY: 'fw_3ZQ21zN3zE1WkiNVRfRnM1CE', // Get from: https://fireworks.ai/
    ELEVENLABS_API_KEY: 'd8b5c8c5fb4115bd4dbf6b5fb2cd73a5' // Get from: https://elevenlabs.io/
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

// ElevenLabs Voice IDs
export const VOICES = {
    OLIVER: 'lhv1eYeMJCUYv7NL7OKD', // Oliver
    CLARA: 'TAqi1SN17xh4b9oH5LBt', // Clara
    LOU: 'kTtBSr1u6tPeSvwQGouN', // Lou
    EMA: 'zsy4Pj2QczHRb9LQKZ4C', // Ema
    KNIGHT: 'rrnv4OiWMYIVshnZnCiS', // Knight
    LOTUS: 'ETlpFFcMLNgKeEoxCJ3C', // Lotus
    RAPID: 'dAf5zlrwZFWzuWgEgeqC', // Rapid
    DARRA: 'JMO2IoLjBdIFeFMsEmp2', // Darra
    MARKY: '1J4RmCsnsNtBy9n1tr2w', // Marky
    TARA: 'u9uKx1c2QSPNvEhvE2Nw', // Tara
    DOBBIE: 'keXMZmDrpwxAwgbPAQY2', // Dobbie
    KATTIE: 'k8uAJkCoKYqp4tWhFXLG', // Kattie
    CW33DO: 'LRa6atI0zVh9JkizupWT', // C-W33DO
    AMMY: 'Qm4Shbx4XxYEUN6Av8wM', // Ammy
    BENNY: 'bVfWLbRLSh47WaYDbaIa', // Benny
    ASHKRABA: 'MF4J4IDTRo0AxOO4dpFR', // Ashkraba
    JOHNTRA: 'x2TJI62csiL0b5uT64UV', // Johntra
    COLIN: 'Owgh2nFdsMDIJ9TrYPpe', // Colin
    BRIAN: 'Trt1LX8CWwQnSOOmXzzn', // Brian - neutral narrator
    PATRICE: '7KjoDCHXqxRgWGIB4NnF', // Patrice
    ALIUS: 'OXXLiM0iFjjIXELJivVT', // Alius
    // Keep legacy names for backward compatibility
    NARRATOR: 'Trt1LX8CWwQnSOOmXzzn', // Brian - neutral narrator
    MALE: 'Owgh2nFdsMDIJ9TrYPpe', // Colin
    FEMALE: 'TAqi1SN17xh4b9oH5LBt', // Clara
    MYSTERIOUS: 'ETlpFFcMLNgKeEoxCJ3C' // Lotus
};
