import { API_CONFIG, MODELS, VOICES, MODEL_TIERS } from './config.js';

console.log('🚀 API Helper loaded!', {
    GEMINI_API_KEY: API_CONFIG.GEMINI_API_KEY.substring(0, 10) + '...',
    GROQ_API_KEY: API_CONFIG.GROQ_API_KEY.substring(0, 10) + '... (LLM + TTS)',
    FIREWORKS_API_KEY: API_CONFIG.FIREWORKS_API_KEY.substring(0, 10) + '...'
});

// Gemini API wrapper - for text generation
export const gemini = {
    async chat(messages, options = {}) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.GEMINI}:generateContent?key=${API_CONFIG.GEMINI_API_KEY}`;

        // Convert messages to Gemini format
        // Gemini uses 'user' and 'model' roles, and needs full conversation history
        let contents = [];
        let systemInstruction = '';

        if (Array.isArray(messages)) {
            // Extract system message as system instruction
            const systemMsg = messages.find(m => m.role === 'system');
            if (systemMsg) {
                systemInstruction = systemMsg.content;
            }

            // Convert conversation messages to Gemini format
            for (const msg of messages) {
                if (msg.role === 'system') continue; // Skip system, we handle it separately

                // Map roles: 'user' stays 'user', 'assistant' becomes 'model'
                const role = msg.role === 'assistant' ? 'model' : 'user';

                contents.push({
                    role: role,
                    parts: [{ text: msg.content }]
                });
            }

            // If we have system instruction, prepend it to first user message
            if (systemInstruction && contents.length > 0 && contents[0].role === 'user') {
                contents[0].parts[0].text = `${systemInstruction}\n\n${contents[0].parts[0].text}`;
            }
        } else {
            // Single string message
            contents = [{
                role: 'user',
                parts: [{ text: messages }]
            }];
        }

        // Add JSON instruction if json option is enabled
        if (options.json && contents.length > 0) {
            const lastContent = contents[contents.length - 1];
            lastContent.parts[0].text += '\n\nRespond with valid JSON only, no additional text.';
        }

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 8000,
                responseMimeType: options.json ? 'application/json' : undefined
            }
        };

        try {
            console.log('Sending to Gemini:', { url, requestBody });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Gemini API HTTP error:', response.status, error);
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            console.log('Gemini raw response:', data);

            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                console.error('Invalid Gemini response structure:', data);
                throw new Error('Invalid response from Gemini API');
            }

            const content = data.candidates[0].content.parts[0].text;
            console.log('Extracted content:', content);

            return {
                choices: [{
                    message: {
                        content: content
                    }
                }]
            };
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    },

    // Simplified interface matching websim API
    completions: {
        async create({ messages, model, temperature, max_tokens, json }) {
            try {
                const result = await gemini.chat(messages, {
                    temperature,
                    maxTokens: max_tokens,
                    json: json
                });
                console.log('Gemini API result:', result);
                // Return in a format that works with both .content and .choices[0].message.content
                return {
                    content: result.choices[0].message.content,
                    choices: result.choices
                };
            } catch (error) {
                console.error('Error in completions.create:', error);
                throw error;
            }
        }
    }
};

// Groq API wrapper - for text generation (OpenAI-compatible)
export const groq = {
    async chat(messages, options = {}) {
        const url = 'https://api.groq.com/openai/v1/chat/completions';

        // Groq uses OpenAI-compatible format with system, user, assistant roles
        const requestBody = {
            model: options.model || MODELS.GROQ_BEST,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 8000,
            top_p: 1,
            stream: false
        };

        // Add JSON response format if requested
        if (options.json) {
            requestBody.response_format = { type: 'json_object' };
            // Ensure the last message asks for JSON
            if (Array.isArray(messages) && messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg.content.includes('JSON')) {
                    lastMsg.content += '\n\nRespond with valid JSON only.';
                }
            }
        }

        try {
            console.log('Sending to Groq:', { url, model: requestBody.model });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Groq API HTTP error:', response.status, error);
                throw new Error(`Groq API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            console.log('Groq raw response:', data);

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Invalid Groq response structure:', data);
                throw new Error('Invalid response from Groq API');
            }

            return {
                choices: [{
                    message: {
                        content: data.choices[0].message.content
                    }
                }]
            };
        } catch (error) {
            console.error('Groq API Error:', error);
            throw error;
        }
    },

    // Simplified interface matching websim API
    completions: {
        async create({ messages, model, temperature, max_tokens, json }) {
            try {
                const result = await groq.chat(messages, {
                    model,
                    temperature,
                    maxTokens: max_tokens,
                    json: json
                });
                console.log('Groq API result:', result);
                // Return in a format that works with both .content and .choices[0].message.content
                return {
                    content: result.choices[0].message.content,
                    choices: result.choices
                };
            } catch (error) {
                console.error('Error in Groq completions.create:', error);
                throw error;
            }
        }
    }
};

// Fireworks AI wrapper - for image generation
export const fireworks = {
    async imageGen({ prompt, width = 1280, height = 720, seed }) {
        const url = 'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image';

        // Determine aspect ratio from dimensions
        let aspectRatio = '1:1';
        const ratio = width / height;
        if (Math.abs(ratio - 16/9) < 0.1) aspectRatio = '16:9';
        else if (Math.abs(ratio - 9/16) < 0.1) aspectRatio = '9:16';
        else if (Math.abs(ratio - 4/3) < 0.1) aspectRatio = '4:3';
        else if (Math.abs(ratio - 3/4) < 0.1) aspectRatio = '3:4';

        const requestBody = {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            guidance_scale: 3.5,
            num_inference_steps: 4,
            seed: seed !== undefined ? seed : Math.floor(Math.random() * 1000000)
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.FIREWORKS_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'image/png'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Fireworks API error: ${response.status} - ${error}`);
            }

            // Get image as blob
            const blob = await response.blob();

            // Convert to data URL for easy use
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        url: reader.result,
                        blob: blob
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Fireworks AI Error:', error);
            throw error;
        }
    }
};

// Store selected model tier (default to BEST)
let selectedModelTier = 'BEST';

// Function to set the model tier
export function setModelTier(tier) {
    if (MODEL_TIERS[tier]) {
        selectedModelTier = tier;
        console.log(`Model tier changed to: ${tier} (${MODEL_TIERS[tier].displayName})`);
        // Save to localStorage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('selectedModelTier', tier);
        }
    } else {
        console.error(`Invalid model tier: ${tier}`);
    }
}

// Function to get current model tier
export function getModelTier() {
    // Load from localStorage if available
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('selectedModelTier');
        if (saved && MODEL_TIERS[saved]) {
            selectedModelTier = saved;
        }
    }
    return selectedModelTier;
}

// Initialize model tier from localStorage
if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('selectedModelTier');
    if (saved && MODEL_TIERS[saved]) {
        selectedModelTier = saved;
    }
}

// Create a websim-compatible object for easy replacement
export const websim = {
    chat: {
        completions: {
            create: async (options) => {
                // Route to correct provider based on selected model tier
                const tier = MODEL_TIERS[getModelTier()];
                const provider = tier.provider;
                const model = tier.model;

                console.log(`Using model tier: ${tier.displayName} (${provider}/${model})`);

                if (provider === 'gemini') {
                    return await gemini.completions.create({ ...options, model });
                } else if (provider === 'groq') {
                    return await groq.completions.create({ ...options, model });
                } else {
                    throw new Error(`Unknown provider: ${provider}`);
                }
            }
        }
    },
    imageGen: async (options) => await fireworks.imageGen(options),
    soundEffects: async ({ prompt, duration = 10 }) => {
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
                method: 'POST',
                headers: {
                    'xi-api-key': API_CONFIG.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: prompt,
                    duration_seconds: duration,
                    prompt_influence: 0.3
                })
            });

            if (!response.ok) {
                console.error('ElevenLabs SFX API error:', response.status);
                return null;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            return { url, blob };
        } catch (error) {
            console.error('ElevenLabs SFX Error:', error);
            return null;
        }
    },
    generateSFXPrompt: async ({ imagePrompt }) => {
        try {
            // Use LLM to generate a good SFX prompt from the image description
            const result = await websim.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert sound designer. Given an image description, create a short, vivid sound effect prompt (1-2 sentences max) that captures the ambience and atmosphere. Focus on environmental sounds, not music. Be specific and evocative.'
                    },
                    {
                        role: 'user',
                        content: `Create a sound effect prompt for this scene: ${imagePrompt}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 100
            });

            return result.content.trim();
        } catch (error) {
            console.error('Error generating SFX prompt:', error);
            // Fallback to a simple extraction
            return `ambient sounds, atmospheric`;
        }
    },
    textToSpeech: async ({ text, voice }) => {
        try {
            // Map voice parameter to PlayAI voice name (use provided voice or default to narrator)
            let voiceName = voice ? VOICES[voice] : VOICES.NARRATOR;

            // Fallback if voice not found
            if (!voiceName) {
                console.warn(`Voice '${voice}' not found in VOICES, using NARRATOR default`);
                voiceName = VOICES.NARRATOR || 'Calum'; // Double fallback
            }

            // Add -PlayAI suffix (required by Groq API)
            if (!voiceName.endsWith('-PlayAI')) {
                voiceName = `${voiceName}-PlayAI`;
            }

            console.log(`🎤 TTS Request: voice="${voice}" → voiceName="${voiceName}"`);

            const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'playai-tts',
                    voice: voiceName,
                    input: text,
                    response_format: 'mp3'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Groq PlayAI TTS error:', response.status, errorText);

                if (response.status === 404 || response.status === 400) {
                    // Voice not found, try falling back to default
                    console.warn(`Voice ${voiceName} not found, falling back to Aaliyah-PlayAI`);
                    voiceName = 'Aaliyah-PlayAI';

                    const fallbackResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${API_CONFIG.GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'playai-tts',
                            voice: voiceName,
                            input: text,
                            response_format: 'mp3'
                        })
                    });

                    if (!fallbackResponse.ok) {
                        console.error('Groq PlayAI TTS error (fallback):', fallbackResponse.status);
                        console.log('🔄 Trying Web Speech TTS as fallback...');
                        return await tryWebSpeechTTS(text, voice);
                    }

                    const blob = await fallbackResponse.blob();
                    const url = URL.createObjectURL(blob);
                    return { url, blob };
                }

                console.error('Groq PlayAI TTS error:', response.status);
                console.log('🔄 Trying Web Speech TTS as fallback...');
                return await tryWebSpeechTTS(text, voice);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            return { url, blob };
        } catch (error) {
            console.error('Groq PlayAI TTS Error:', error);
            console.log('🔄 Trying Web Speech TTS as fallback...');
            return await tryWebSpeechTTS(text, voice);
        }
    }
};

// Web Speech API TTS fallback function
// Built-in browser TTS - works everywhere, no API keys needed
async function tryWebSpeechTTS(text, voice) {
    return new Promise((resolve, reject) => {
        try {
            console.log('🎤 Web Speech TTS Request:', {
                text: text.substring(0, 50) + '...',
                length: text.length
            });

            // Check if Web Speech API is available
            if (!window.speechSynthesis) {
                console.error('❌ Web Speech API not supported in this browser');
                resolve(null);
                return;
            }

            // Create utterance
            const utterance = new SpeechSynthesisUtterance(text);

            // Configure voice settings
            utterance.lang = 'en-US';
            utterance.rate = 0.9; // Slightly slower for better clarity
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Try to find a good voice
            const voices = speechSynthesis.getVoices();
            console.log('🔍 Available Web Speech voices:', voices.length);

            // Prefer Google or Microsoft natural voices
            const preferredVoice = voices.find(v =>
                v.lang.startsWith('en') &&
                (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft'))
            ) || voices.find(v => v.lang.startsWith('en'));

            if (preferredVoice) {
                utterance.voice = preferredVoice;
                console.log('🎤 Using voice:', preferredVoice.name);
            }

            // Record audio using MediaRecorder
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();
            const mediaRecorder = new MediaRecorder(destination.stream);
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);

                console.log('✅ Web Speech TTS success! Blob size:', audioBlob.size, 'bytes');
                console.log('🔊 Audio duration estimated:', text.length / 15, 'seconds');

                resolve({ url, blob: audioBlob });
            };

            utterance.onend = () => {
                console.log('🎤 Speech synthesis complete');
                mediaRecorder.stop();
            };

            utterance.onerror = (event) => {
                console.error('❌ Web Speech TTS error:', event.error);
                mediaRecorder.stop();
                resolve(null);
            };

            // Start recording and speaking
            mediaRecorder.start();
            speechSynthesis.speak(utterance);

            console.log('🎤 Web Speech synthesis started...');

        } catch (error) {
            console.error('❌ Web Speech TTS error:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            resolve(null);
        }
    });
}

// Export default for easy import
export default websim;
