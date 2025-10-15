import { API_CONFIG, MODELS, VOICES } from './config.js';

console.log('🚀 API Helper loaded!', { GEMINI_API_KEY: API_CONFIG.GEMINI_API_KEY.substring(0, 10) + '...', FIREWORKS_API_KEY: API_CONFIG.FIREWORKS_API_KEY.substring(0, 10) + '...' });

// Gemini API wrapper - for text generation
export const gemini = {
    async chat(messages, options = {}) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.GEMINI}:generateContent?key=${API_CONFIG.GEMINI_API_KEY}`;

        // Convert messages to Gemini format
        // If messages has system role, we need to include it in the prompt
        let prompt = '';
        if (Array.isArray(messages)) {
            const systemMsg = messages.find(m => m.role === 'system');
            const userMsg = messages.find(m => m.role === 'user');

            if (systemMsg && userMsg) {
                prompt = `${systemMsg.content}\n\nUser: ${userMsg.content}`;
            } else {
                prompt = messages.map(m => m.content || m).join('\n');
            }
        } else {
            prompt = messages;
        }

        // Add JSON instruction if json option is enabled
        if (options.json) {
            prompt += '\n\nRespond with valid JSON only, no additional text.';
        }

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
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

// Fireworks AI wrapper - for image generation
export const fireworks = {
    async imageGen({ prompt, width = 1024, height = 1024, seed }) {
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

// Create a websim-compatible object for easy replacement
export const websim = {
    chat: {
        completions: {
            create: async (options) => await gemini.completions.create(options)
        }
    },
    imageGen: async (options) => await fireworks.imageGen(options),
    textToSpeech: async ({ text, voice }) => {
        try {
            // Map voice parameter to ElevenLabs voice ID
            const voiceId = VOICES.NARRATOR; // Default to narrator voice

            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_CONFIG.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: MODELS.ELEVENLABS_MODEL,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                console.error('ElevenLabs API error:', response.status);
                return null;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            return { url, blob };
        } catch (error) {
            console.error('ElevenLabs TTS Error:', error);
            return null;
        }
    }
};

// Export default for easy import
export default websim;
