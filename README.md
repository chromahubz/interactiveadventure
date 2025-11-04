# Interactive Adventure RPG

AI-powered text-based RPG game with D&D-style mechanics, TTS narration, and procedurally generated content.

## 🎮 Features

- **AI Dungeon Master** powered by Gemini 2.0 Flash
- **27 TTS Voices** via Groq PlayAI-TTS (Aaliyah, Calum, Celeste, Thunder, etc.)
- **AI Image Generation** with Fireworks AI (Flux-1-schnell-fp8)
- **D&D-Style Combat** with dice rolls, skill checks, and leveling
- **Party System** - Recruit NPCs with unique abilities
- **Full RPG Mechanics** - Inventory, equipment, weapons, armor, rings
- **Save/Load System** - Persistent game progress
- **7 Art Styles** - Pixel art, watercolor, anime, photorealistic, etc.

## 🚀 Live Demo

**Vercel:** Coming soon!
**GitHub:** [chromahubz/interactiveadventure](https://github.com/chromahubz/interactiveadventure)

## 🛠️ Setup

### Option 1: Localhost (Full Features)

```bash
# Clone the repository
git clone https://github.com/chromahubz/interactiveadventure.git
cd interactiveadventure

# Start HTTP server
python -m http.server 3100

# Open browser
http://localhost:3100
```

### Option 2: Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/chromahubz/interactiveadventure)

**Note:** Video export feature requires localhost setup.

## 🔑 API Keys Required

You'll need to add your API keys to `config.js`:

```javascript
GEMINI_API_KEY: 'your-key-here',  // Get from: https://aistudio.google.com/app/apikey
GROQ_API_KEY: 'your-key-here',     // Get from: https://console.groq.com/
FIREWORKS_API_KEY: 'your-key-here' // Get from: https://fireworks.ai/
```

## 📦 Technologies

- **AI**: Gemini 2.0 Flash, Groq LLaMA 3.3 70B
- **TTS**: Groq PlayAI-TTS (27 voices)
- **Images**: Fireworks AI (Flux-1-schnell-fp8)
- **Frontend**: Vanilla JavaScript ES6 modules
- **Audio**: Web Audio API
- **Video Export** (localhost only): FFmpeg, Node.js Express

## 🎤 Available Voices

**Female:** Aaliyah, Adelaide, Arista, Celeste, Cheyenne, Deedee, Eleanor, Gail, Jennifer, Judy, Mamaw, Nia, Ruby

**Male:** Angelo, Atlas, Basil, Briggs, Calum, Chip, Cillian, Fritz, Mason, Mikail, Mitch, Thunder

**Neutral:** Indigo, Quinn

## 🎨 Art Styles

- Pixel Art
- Isometric Pixel Art
- Watercolor Illustration
- Oil Painting
- Photorealistic
- Anime Style
- Pencil Sketch

## 📝 Recent Updates

### v1.1.0 (Latest)
- ✅ Fixed all 27 Groq PlayAI-TTS voices
- ✅ Fixed JSON parsing (handles markdown code blocks)
- ✅ Fixed icon backgrounds (white for compatibility)
- ✅ Added AudioContext auto-init on first click
- ✅ Added debug logging for export/fullscreen
- ✅ Set Aaliyah as default narrator voice

### v1.0.0
- Initial release with AI narrator, TTS, image generation
- D&D-style combat and leveling system
- Party management and equipment system

## 🐛 Known Issues

- Video export only works on localhost (requires Node.js server)
- Some browsers block audio until first user interaction

## 📄 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Open an issue or submit a PR.

---

Made with ❤️ using AI (Claude Code, Gemini, Groq, Fireworks)
