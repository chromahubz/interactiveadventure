import {
    initAudioContext,
    loadSound,
    playSound
} from './audioManager.js';
import websim, { setModelTier, getModelTier } from './apiHelper.js';

// Helper function to clean JSON responses (removes markdown code blocks)
function cleanJSON(text) {
    if (!text) return text;
    let cleaned = text.trim();
    // Remove markdown code blocks: ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, ''); // Remove opening ```json or ```
        cleaned = cleaned.replace(/\n?```\s*$/, ''); // Remove closing ```
    }
    return cleaned.trim();
}

const form = document.getElementById('message-form');
const input = document.getElementById('message-input');
const messagesContainer = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');
const suggestionButtonsContainer = document.getElementById('suggestion-buttons-container'); // New: Suggestions container
const backgroundMusic = document.getElementById('background-music');
const writingSound = document.getElementById('writing-sound');
const pixelClickSound = new Audio('/pixel_click.mp3');
pixelClickSound.volume = 0.4; // Set volume for click sound

// Add click sound to all buttons
function playClickSound() {
    pixelClickSound.currentTime = 0; // Reset to start for rapid clicks
    pixelClickSound.play().catch(err => console.error('Click sound error:', err));
}

// Global ESC key handler - ALWAYS close fullscreen/modals on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close fullscreen
        const overlay = document.getElementById('fullscreen-overlay');
        if (overlay && overlay.classList.contains('active')) {
            console.log('⌨️ ESC pressed: Closing fullscreen');
            overlay.classList.remove('active');
        }

        // Close export modal
        const exportModal = document.getElementById('export-modal');
        if (exportModal && exportModal.style.display === 'block') {
            console.log('⌨️ ESC pressed: Closing export modal');
            exportModal.style.display = 'none';
        }
    }
});

// Global click handler for fullscreen overlay - click anywhere to close
setTimeout(() => {
    const overlay = document.getElementById('fullscreen-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            console.log('🖱️ Fullscreen overlay clicked: Closing');
            overlay.classList.remove('active');
        });
    }
}, 100);

// Global click debugger AND EMERGENCY HANDLERS for modal buttons
document.addEventListener('click', (e) => {
    if (e.target.id === 'export-files-button' || e.target.closest('#export-files-button')) {
        console.log('🔍 GLOBAL: Export Files (ZIP) button click detected!');

        // EMERGENCY: Call exportMediaZip directly if main handler doesn't fire
        setTimeout(async () => {
            console.log('🚨 EMERGENCY: Calling exportMediaZip() via global handler');
            const modal = document.getElementById('export-modal');
            if (modal) modal.style.display = 'none';

            try {
                if (typeof exportMediaZip === 'function') {
                    await exportMediaZip();
                } else {
                    console.error('❌ exportMediaZip function not defined!');
                }
            } catch (error) {
                console.error('❌ Emergency ZIP export failed:', error);
                alert(`ZIP export failed: ${error.message}`);
            }
        }, 50);
    }

    if (e.target.id === 'export-video-button' || e.target.closest('#export-video-button')) {
        console.log('🔍 GLOBAL: Export Video button click detected!');

        // EMERGENCY: Trigger video export directly
        setTimeout(async () => {
            console.log('🎬 ===== EMERGENCY VIDEO EXPORT HANDLER =====');

            const exportModal = document.getElementById('export-modal');
            const exportVideoButton = document.getElementById('export-video-button');
            const exportFilesButton = document.getElementById('export-files-button');
            const exportSubtitlesCheckbox = document.getElementById('export-subtitles-checkbox');
            const exportStatus = document.getElementById('export-status');

            console.log('  Export modal found:', !!exportModal);
            console.log('  Export video button found:', !!exportVideoButton);
            console.log('  Export status element found:', !!exportStatus);
            console.log('  Subtitles checkbox found:', !!exportSubtitlesCheckbox);

            if (!exportVideoButton || !exportStatus) {
                console.error('❌ Cannot start video export - missing elements');
                return;
            }

            const includeSubtitles = exportSubtitlesCheckbox ? exportSubtitlesCheckbox.checked : false;
            console.log('  Include subtitles:', includeSubtitles);

            exportVideoButton.disabled = true;
            if (exportFilesButton) exportFilesButton.disabled = true;
            exportStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting video export...';

            try {
                console.log('🎬 Checking data availability...');
                console.log('  generatedImages:', typeof generatedImages !== 'undefined' ? generatedImages.length : 'undefined');
                console.log('  ttsAudioUrls:', typeof ttsAudioUrls !== 'undefined' ? ttsAudioUrls.length : 'undefined');
                console.log('  narrativeTexts:', typeof narrativeTexts !== 'undefined' ? narrativeTexts.length : 'undefined');

                if (typeof generatedImages === 'undefined' || generatedImages.length === 0) {
                    throw new Error('No images available. Play the game to generate images first!');
                }

                // Prepare scenes
                const scenes = [];
                const maxScenes = Math.max(generatedImages.length, ttsAudioUrls?.length || 0);
                console.log('🎬 Preparing', maxScenes, 'scenes...');

                for (let i = 0; i < maxScenes; i++) {
                    const scene = {};

                    if (generatedImages.length > 0) {
                        const imgIndex = Math.min(i, generatedImages.length - 1);
                        scene.imageUrl = generatedImages[imgIndex].url;
                    }

                    if (ttsAudioUrls && ttsAudioUrls.length > i && ttsAudioUrls[i].duration) {
                        scene.audioDuration = ttsAudioUrls[i].duration;
                    }

                    if (narrativeTexts && narrativeTexts.length > i) {
                        scene.text = narrativeTexts[i].text;
                    }

                    if (scene.imageUrl) {
                        scenes.push(scene);
                    }
                }

                console.log('✅ Prepared', scenes.length, 'scenes');

                // Call video generation
                console.log('🎬 Calling generateVideoClientSide()...');
                const videoBlob = await generateVideoClientSide(scenes, includeSubtitles);

                // Download with correct extension
                const isWebM = videoBlob.type.includes('webm');
                const extension = isWebM ? 'webm' : 'mp4';
                const filename = `adventure-${Date.now()}.${extension}`;
                const format = isWebM ? 'WebM' : 'MP4';

                console.log('📹 Video format:', format, '(', videoBlob.type, ')');

                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                exportStatus.innerHTML = `<i class="fas fa-check" style="color: green;"></i> Video generated successfully! (${format} format)`;
                console.log('✅ Video export complete:', filename);

                setTimeout(() => {
                    if (exportModal) exportModal.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error('❌ Video export error:', error);
                exportStatus.innerHTML = `<i class="fas fa-times" style="color: red;"></i> Error: ${error.message}`;
            } finally {
                exportVideoButton.disabled = false;
                if (exportFilesButton) exportFilesButton.disabled = false;
            }
        }, 50);
    }

    if (e.target.id === 'export-modal-close' || e.target.closest('#export-modal-close')) {
        console.log('🔍 GLOBAL: Export modal close click detected!');

        // EMERGENCY: Close modal directly
        setTimeout(() => {
            const modal = document.getElementById('export-modal');
            if (modal && modal.style.display === 'block') {
                console.log('⚠️ EMERGENCY: Closing export modal via global handler');
                modal.style.display = 'none';
            }
        }, 50);
    }
}, true);

// Click-to-enlarge for item images (Items, Weapons, Armor, Rings, Party Members, Encounters)
document.addEventListener('click', (e) => {
    // Check if click is on an image inside item containers
    const itemContainers = [
        '.item', '.weapon', '.armor', '.ring', '.party-member',
        '.encounter-item', '#equipment-list li'
    ];

    let clickedImage = null;

    // Check if clicked element is an image
    if (e.target.tagName === 'IMG') {
        // Check if image is inside an item container
        for (const selector of itemContainers) {
            if (e.target.closest(selector)) {
                clickedImage = e.target;
                break;
            }
        }
    }

    if (clickedImage && clickedImage.src && !clickedImage.src.includes('data:image/gif')) {
        console.log('🖼️ Item image clicked, enlarging:', clickedImage.alt);

        const overlay = document.getElementById('fullscreen-overlay');
        const fullscreenImg = document.getElementById('fullscreen-image');

        if (overlay && fullscreenImg) {
            fullscreenImg.style.opacity = '0';
            fullscreenImg.src = clickedImage.src;
            overlay.classList.add('active');
            requestAnimationFrame(() => { fullscreenImg.style.opacity = '1'; });
        }
    }
}, true);

// Global click debugger AND EMERGENCY HANDLER
document.addEventListener('click', (e) => {
    if (e.target.id === 'expand-image-button' || e.target.closest('#expand-image-button')) {
        console.log('🔍 GLOBAL: Fullscreen button click detected!', e.target);

        // EMERGENCY: Open fullscreen directly
        setTimeout(() => {
            console.log('🖼️ ===== EMERGENCY FULLSCREEN HANDLER =====');

            const locationImage = document.getElementById('location-image');
            const overlay = document.getElementById('fullscreen-overlay');
            const fullscreenImg = document.getElementById('fullscreen-image');

            console.log('  Location image found:', !!locationImage);
            console.log('  Location image src:', locationImage ? locationImage.src.substring(0, 60) + '...' : 'N/A');
            console.log('  Fullscreen overlay found:', !!overlay);
            console.log('  Fullscreen image found:', !!fullscreenImg);

            if (locationImage && locationImage.src && overlay && fullscreenImg) {
                console.log('✅ All elements found, opening fullscreen...');
                fullscreenImg.style.opacity = '0';
                fullscreenImg.src = locationImage.src;
                overlay.classList.add('active');
                console.log('  Overlay class "active" added');
                console.log('  Image src set to:', locationImage.src.substring(0, 60) + '...');

                requestAnimationFrame(() => {
                    fullscreenImg.style.opacity = '1';
                    console.log('✅ Fullscreen opened with fade-in animation');
                });
            } else {
                console.error('❌ Cannot open fullscreen - missing elements:');
                console.error('  locationImage:', !!locationImage);
                console.error('  locationImage.src:', locationImage ? !!locationImage.src : false);
                console.error('  overlay:', !!overlay);
                console.error('  fullscreenImg:', !!fullscreenImg);
            }
        }, 50);
    }

    if (e.target.id === 'export-media-button' || e.target.closest('#export-media-button')) {
        console.log('🔍 GLOBAL: Export button click detected!', e.target);

        // EMERGENCY: Open modal directly
        setTimeout(() => {
            const modal = document.getElementById('export-modal');
            if (modal && modal.style.display !== 'block') {
                console.log('⚠️ EMERGENCY: Opening export modal via global handler');
                modal.style.display = 'block';
                const status = document.getElementById('export-status');
                if (status) status.innerHTML = '';
            }
        }, 50);
    }
}, true);

// Add click listeners to all control buttons
document.addEventListener('DOMContentLoaded', () => {
    console.log('📌 DOMContentLoaded event fired');
    document.querySelectorAll('.control-button, button, .race-button, .class-button').forEach(btn => {
        btn.addEventListener('click', playClickSound);
    });
});

const undoButton = document.getElementById('undo-button');
const saveButton = document.getElementById('save-button');
const loadButton = document.getElementById('load-button');
const newGameButton = document.getElementById('new-game-button');
const fileLoader = document.getElementById('file-loader');
const locationImage = document.getElementById('location-image');
const imageLoader = document.getElementById('image-loader');
const autoplayButton = document.getElementById('autoplay-button');
const musicButton = document.getElementById('music-button');
const itemList = document.getElementById('item-list');
const partyList = document.getElementById('party-members-list');
const weaponList = document.getElementById('weapon-list'); // New: Weapon list element
const armorList = document.getElementById('armor-list');
const ringList = document.getElementById('ring-list');
const equipmentList = document.getElementById('equipment-list');
const ttsButton = document.getElementById('tts-button');
const sfxButton = document.getElementById('sfx-button');
const voiceReadButton = document.getElementById('voice-read-button');
const expandImageButton = document.getElementById('expand-image-button');
const fullscreenOverlay = document.getElementById('fullscreen-overlay');
const fullscreenImage = document.getElementById('fullscreen-image');
const exportMediaButton = document.getElementById('export-media-button');

// New: Message context menu elements
const messageContextMenu = document.getElementById('message-context-menu');
const editMessageButton = document.getElementById('edit-message-button');
const regenerateMessageButton = document.getElementById('regenerate-message-button');

// New: State for the context menu
let activeContextMenuMessage = null;
let activeContextMenuMessageIndex = -1;

// New: Race Selection Elements
const raceButtons = document.querySelectorAll('.race-button');
const customRaceInput = document.getElementById('custom-race-input');
const generateRaceButton = document.getElementById('generate-race-button');
const raceDetailsDisplay = document.getElementById('race-details-display');
const raceNameDisplay = document.getElementById('race-name-display');
const raceTraitsDisplay = document.getElementById('race-traits-display');
const raceStatsDisplay = document.getElementById('race-stats-display'); // New element

// New: Class Selection Elements
const classButtons = document.querySelectorAll('.class-button');
const customClassInput = document.getElementById('custom-class-input');
const generateClassButton = document.getElementById('generate-class-button');
const classDetailsDisplay = document.getElementById('class-details-display');
const classNameDisplay = document.getElementById('class-name-display');
const classStatsDisplay = document.getElementById('class-stats-display');
const classMovesetDisplay = document.getElementById('class-moveset-display');
const classSkillTreeDisplay = document.getElementById('class-skill-tree-display'); // New: Skill tree preview

// New: Start Menu elements
const startMenu = document.getElementById('start-menu');
const startScreenContainer = document.getElementById('start-screen-container');
const universeInput = document.getElementById('universe-input');
const startGameButton = document.getElementById('start-game-button');
const loadGameMenuButton = document.getElementById('load-game-menu-button'); // New button for loading from start menu
const appContainer = document.getElementById('app-container'); // Reference to the main game container

// New: Character photo upload
const characterPhotoInput = document.getElementById('character-photo-input');
const characterPhotoPreview = document.getElementById('character-photo-preview');
const characterPhotoFilename = document.getElementById('character-photo-filename');
let characterPhotoDataUrl = null;

// New: Confirm modal elements
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-new-yes');
const confirmNoBtn = document.getElementById('confirm-new-no');
const confirmCloseBtn = document.getElementById('confirm-modal-close');

// Character modal elements
const characterModal = document.getElementById('character-modal');
const closeModalButton = characterModal.querySelector('.close-button');
const modalCharacterIcon = document.getElementById('modal-character-icon');
const modalCharacterName = document.getElementById('modal-character-name');
const modalCharacterDescription = document.getElementById('modal-character-description');
const modalCharacterStats = document.getElementById('modal-character-stats');
const modalCharacterMoveset = document.getElementById('modal-character-moveset');
const modalUpgradeButton = document.getElementById('modal-upgrade-button');

// Party Upgrade modal elements
const partyUpgradeModal = document.getElementById('party-upgrade-modal');
const closePartyUpgradeModalButton = partyUpgradeModal.querySelector('.close-button');
const modalUpgradeCharacterIcon = document.getElementById('modal-upgrade-character-icon');
const modalUpgradeCharacterName = document.getElementById('modal-upgrade-character-name');
const partyUpgradeSkillPointsDisplay = document.getElementById('party-upgrade-skill-points-display');
const partyUpgradeMovesList = document.getElementById('party-upgrade-moves-list');
// New elements for party upgrade modal
const partyUpgradeSkillPointsDisplayStats = document.getElementById('party-upgrade-skill-points-display-stats');
const partyUpgradeSkillPointsDisplayMoves = document.getElementById('party-upgrade-skill-points-display-moves');
const partyUpgradeStatsList = document.getElementById('party-upgrade-stats-list');

// Details modal elements
const detailsModal = document.getElementById('details-modal');
const closeDetailsModalButton = detailsModal.querySelector('.close-button');
const modalDetailsIcon = document.getElementById('modal-details-icon');
const modalDetailsName = document.getElementById('modal-details-name');
const modalDetailsType = document.getElementById('modal-details-type');
const modalDetailsDescription = document.getElementById('modal-details-description');
const modalDetailsInfoContainer = document.getElementById('modal-details-info-container');
const modalDetailsInfoHeader = document.getElementById('modal-details-info-header');
const modalDetailsInfo = document.getElementById('modal-details-info');

// New: Player and Encounter elements
const playerHpBar = document.getElementById('player-hp-bar');
const playerHpText = document.getElementById('player-hp-text');
const playerStatusEffectsContainer = document.getElementById('player-status-effects');
const encounterList = document.getElementById('encounter-list');

// New: Player level/xp elements
const playerLevelDisplay = document.getElementById('player-level');
const playerXpBar = document.getElementById('player-xp-bar');
const playerXpText = document.getElementById('player-xp-text');

// New: Race Menu elements
const raceMenuContainer = document.getElementById('race-menu-container');
const raceSkillsList = document.getElementById('race-skills-list');
const raceSkillPointsDisplay = document.getElementById('race-skill-points-display');

// New: Skill tree elements
const skillTreeContainer = document.getElementById('skill-tree-container');
const skillTreeList = document.getElementById('skill-tree-list');
const skillPointsDisplay = document.getElementById('skill-points-display');

// New: Evolution menu elements
const evolutionContainer = document.getElementById('evolution-container');
const evolutionInfoText = document.getElementById('evolution-info-text');
const evolutionOptionsList = document.getElementById('evolution-options-list');
const EVOLUTION_LEVEL_REQ = 10;

let musicStarted = false;
let conversationHistory = [];
let partyMembers = []; // New array to store party member data
let inventoryItems = []; // New array to store inventory item data
let weapons = []; // New array to store weapon data
let armors = []; // New array to store armor data
let rings = []; // New array to store ring data
let equipment = { // New object for equipped items
    weapon: null,
    armor: null,
    ring1: null,
    ring2: null,
};
let activeEncounters = []; // New array for active enemies
let player = { // New player object
    hp: 100,
    maxHp: 100,
    statusEffects: [],
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    skillPoints: 1,
    upgradePoints: 0, // New: for stat increases
    stats: {},
    baseStats: {}, // To store stats without equipment bonuses
    skillTree: [],
    racialSkills: [], // New: To store upgradable racial skills
    evolution: null, // New: To track chosen evolution
    availableEvolutions: [], // New: To store generated evolution options
};
let selectedClass = null; // New: To store selected class details
let selectedRace = null; // New: To store selected race details
let wasInBattle = false; // New: To track combat state for summons

let isAutoPlaying = false;
let autoplayTimeout;
let currentMusicType = 'tavern'; // The initial music type
let showLoaderForNextImage = false; // Show loader only for the first scene image
let ttsEnabled = true, ttsQueue = [], isSpeaking = false, currentTtsAudio = null, suppressTTS = false;
let sfxEnabled = true, currentSfxAudio = null;

// New: Dice Roll elements
const diceRollOverlay = document.getElementById('dice-roll-overlay');
const diceAnimationContainer = document.getElementById('dice-animation-container');
const diceResultText = document.getElementById('dice-result-text');

// Web Audio API for sound effects
let pixelClickBuffer;
let walkingSoundBuffer; // Buffer for walking sound
let coinSoundBuffer; // Buffer for purchase sound
let diceRollBuffer; // New: Buffer for dice roll sound

// New: Pre-defined class data
const predefinedClasses = {
    Warrior: {
        name: "Warrior",
        moveset: "Power Attack, Shield Bash, Second Wind"
    },
    Mage: {
        name: "Mage",
        moveset: "Fireball, Magic Missile, Frost Nova"
    },
    Rogue: {
        name: "Rogue",
        moveset: "Sneak Attack, Eviscerate, Vanish"
    }
};

// New: Pre-defined race data
const predefinedRaces = {
    Human: {
        name: "Human",
        traits: "Versatile and ambitious, humans are known for their adaptability.",
        stats: "Strength: 11, Dexterity: 11, Constitution: 11, Intelligence: 11, Wisdom: 11, Charisma: 11"
    },
    Elf: {
        name: "Elf",
        traits: "Graceful and wise, with a natural affinity for magic and the forest. Keen senses.",
        stats: "Strength: 9, Dexterity: 13, Constitution: 10, Intelligence: 12, Wisdom: 11, Charisma: 10"
    },
    Dwarf: {
        name: "Dwarf",
        traits: "Stout and resilient, master craftspeople with a strong connection to the mountains.",
        stats: "Strength: 12, Dexterity: 9, Constitution: 13, Intelligence: 10, Wisdom: 11, Charisma: 10"
    }
};

// New: Function to check if start button should be enabled
function checkStartButtonStatus() {
    if (selectedClass && selectedRace) {
        startGameButton.disabled = false;
    } else {
        startGameButton.disabled = true;
    }
}

// New: Function to update the race details display
async function updateRaceDisplay(raceData) {
    if (!raceData || !raceData.name) {
        raceDetailsDisplay.classList.add('hidden');
        selectedRace = null;
        checkStartButtonStatus();
        return;
    }

    raceNameDisplay.textContent = raceData.name;
    raceTraitsDisplay.textContent = raceData.traits_description || "Not yet defined.";
    raceStatsDisplay.textContent = raceData.stats || "Not yet defined.";
    raceDetailsDisplay.classList.remove('hidden');

    // Generate racial skills if they don't exist
    if (!raceData.racial_skills) {
        try {
            raceTraitsDisplay.textContent = "Generating racial traits...";
            raceStatsDisplay.textContent = "Generating base stats...";
            const completion = await websim.chat.completions.create({
                messages: [{
                    role: "system",
                    content: `You are a game designer. Based on the user's input for a fantasy race name, generate a set of base stats, a description, and a set of unique, upgradable racial skills. Respond directly with a JSON object. The JSON object must have three keys: "stats" (a string like "Strength: 10, Dexterity: 12, Constitution: 11, Intelligence: 10, Wisdom: 10, Charisma: 10"), "traits_description" (a short, evocative string describing the race's key features), and "racial_skills". "racial_skills" should be an array of 2-3 skill objects. Each skill object must have "name" (string), "description" (string, a short sentence of what it does), "level" (number, the player level required to unlock it), and "bonus" (string, a specific, short mechanical bonus like "+1 Dexterity" or "10% Fire Resistance").`
                }, {
                    role: "user",
                    content: raceData.name
                }],
                json: true,
            });
            const generatedData = JSON.parse(cleanJSON(completion.content));
            raceData.stats = raceData.stats || generatedData.stats; // Use existing if available
            raceData.traits_description = generatedData.traits_description;
            // Add unlocked and level properties to each skill for tracking
            raceData.racial_skills = generatedData.racial_skills.map(skill => ({ ...skill, unlocked: false }));
        } catch (error) {
            console.error("Error generating racial skills:", error);
            raceTraitsDisplay.textContent = 'Error generating racial traits.';
            raceStatsDisplay.textContent = 'Error generating stats.';
            selectedRace = null;
            checkStartButtonStatus();
            return;
        }
    }
    
    // Update UI with generated data
    raceTraitsDisplay.textContent = raceData.traits_description;
    raceStatsDisplay.textContent = raceData.stats;
    
    selectedRace = raceData;
    checkStartButtonStatus();
}

// New: Function to update the class details display
async function updateClassDisplay(classData) {
    if (!classData || !classData.name) {
        classDetailsDisplay.classList.add('hidden');
        selectedClass = null; // Clear selected class
        checkStartButtonStatus();
        return;
    }
    
    classNameDisplay.textContent = classData.name;
    classMovesetDisplay.textContent = classData.moveset || "Not yet defined.";
    classSkillTreeDisplay.innerHTML = '<li>Generating...</li>';
    classDetailsDisplay.classList.remove('hidden');

    // Generate skill tree if it doesn't exist
    if (!classData.skill_tree) {
        try {
            const completion = await websim.chat.completions.create({
                messages: [{
                    role: "system",
                    content: `You are a game designer creating a class for a fantasy RPG. Based on the user's input for a class name, generate a starting moveset and a skill tree. Respond directly with a JSON object. The JSON object must have two keys: "moveset" (a string with 2-3 comma-separated starting moves like "Power Attack, Shield Bash"), and "skill_tree". The "skill_tree" should be an array of 5-7 skill objects. Each skill object must have "name" (string), "description" (string, a short sentence), and "level" (number, the player level required to unlock it). The skills should be thematically appropriate for the class name and ordered by level requirement.`
                }, {
                    role: "user",
                    content: classData.name
                }],
                json: true,
            });
            const generatedData = JSON.parse(cleanJSON(completion.content));
            classData.moveset = classData.moveset || generatedData.moveset;
            classData.skill_tree = generatedData.skill_tree.map(skill => ({ ...skill, unlocked: false }));
        } catch (error) {
            console.error("Error generating skill tree:", error);
            classSkillTreeDisplay.innerHTML = '<li>Error generating skills.</li>';
            selectedClass = null;
            checkStartButtonStatus();
            return;
        }
    }
    
    selectedClass = classData;
    
    // Update UI with generated data
    classMovesetDisplay.textContent = selectedClass.moveset;
    classSkillTreeDisplay.innerHTML = ''; // Clear 'Generating...'
    selectedClass.skill_tree.forEach(skill => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="skill-level">Lvl ${skill.level}</span> ${skill.name}`;
        classSkillTreeDisplay.appendChild(li);
    });

    checkStartButtonStatus();
}

// New: Event listeners for race buttons
raceButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Deselect other buttons
        raceButtons.forEach(btn => btn.classList.remove('selected'));
        // Select this one
        button.classList.add('selected');

        const raceName = button.dataset.race;
        updateRaceDisplay(predefinedRaces[raceName]);
    });
});

// New: Event listener for custom race generation
generateRaceButton.addEventListener('click', async () => {
    const customRaceName = customRaceInput.value.trim();
    if (!customRaceName) {
        alert("Please enter a name for your custom race.");
        return;
    }

    // Deselect predefined buttons
    raceButtons.forEach(btn => btn.classList.remove('selected'));

    // Show loading state
    const originalButtonText = generateRaceButton.innerHTML;
    generateRaceButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
    generateRaceButton.disabled = true;

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a game designer. Based on the user's input for a fantasy race name, generate a set of base stats, a description, and a set of unique, upgradable racial skills. Respond directly with a JSON object. The JSON object must have three keys: "stats" (a string like "Strength: 10, Dexterity: 12, Constitution: 11, Intelligence: 10, Wisdom: 10, Charisma: 10"), "traits_description" (a short, evocative string describing the race's key features), and "racial_skills". "racial_skills" should be an array of 2-3 skill objects. Each skill object must have "name" (string), "description" (string, a short sentence of what it does), "level" (number, the player level required to unlock it), and "bonus" (string, a specific, short mechanical bonus like "+1 Dexterity" or "10% Fire Resistance").`
                },
                {
                    role: "user",
                    content: customRaceName
                }
            ],
            json: true,
        });

        const raceData = JSON.parse(cleanJSON(completion.content));
        // Add unlocked property to each skill for tracking
        raceData.racial_skills = raceData.racial_skills.map(skill => ({ ...skill, unlocked: false }));
        
        await updateRaceDisplay({
            name: customRaceName,
            stats: raceData.stats,
            traits_description: raceData.traits_description,
            racial_skills: raceData.racial_skills
        });

    } catch (error) {
        console.error("Error generating custom race:", error);
        alert("There was an error generating the race. Please try again.");
    } finally {
        generateRaceButton.innerHTML = originalButtonText;
        generateRaceButton.disabled = false;
    }
});

// New: Event listeners for class buttons
classButtons.forEach(button => {
    button.addEventListener('click', async () => {
        // Deselect other buttons
        classButtons.forEach(btn => btn.classList.remove('selected'));
        // Select this one
        button.classList.add('selected');
        
        const className = button.dataset.class;
        // This will now also generate the skill tree on the fly
        await updateClassDisplay({ name: predefinedClasses[className].name, moveset: predefinedClasses[className].moveset });
    });
});

// New: Event listener for custom class generation
generateClassButton.addEventListener('click', async () => {
    const customClassName = customClassInput.value.trim();
    if (!customClassName) {
        alert("Please enter a name for your custom class.");
        return;
    }

    // Deselect predefined buttons
    classButtons.forEach(btn => btn.classList.remove('selected'));
    
    // Show loading state
    const originalButtonText = generateClassButton.innerHTML;
    generateClassButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating...`;
    generateClassButton.disabled = true;
    
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a game designer creating a class for a fantasy RPG. Based on the user's input for a class name, generate a starting moveset and a skill tree. Respond directly with a JSON object. The JSON object must have two keys: "moveset" (a string with 2-3 comma-separated starting moves like "Power Attack, Shield Bash"), and "skill_tree". The "skill_tree" should be an array of 5-7 skill objects. Each skill object must have "name" (string), "description" (string, a short sentence), and "level" (number, the player level required to unlock it). The skills should be thematically appropriate for the class name and ordered by level requirement.`
                },
                {
                    role: "user",
                    content: customClassName
                }
            ],
            json: true,
        });

        const classData = JSON.parse(cleanJSON(completion.content));
        // Add unlocked property to each skill
        classData.skill_tree = classData.skill_tree.map(skill => ({ ...skill, unlocked: false }));
        
        await updateClassDisplay({
            name: customClassName,
            moveset: classData.moveset,
            skill_tree: classData.skill_tree
        });

    } catch (error) {
        console.error("Error generating custom class:", error);
        alert("There was an error generating the class. Please try again.");
    } finally {
        generateClassButton.innerHTML = originalButtonText;
        generateClassButton.disabled = false;
    }
});

const systemMessage = {
    role: "system",
    content: `You are a Dungeon Master for a fantasy role-playing game. Describe the world, challenges, and NPCs. Your responses should be immersive and concise (1-3 sentences).

IMPORTANT DICE ROLL RULE: For any action with an uncertain outcome (such as skill checks, attack rolls, or damage calculations), you MUST describe a dice roll in the narrative before stating the result. Use standard TTRPG dice notation (e.g., d20, d6, d8). For example: "You attempt to pick the lock (rolling a d20 for Thievery)... it's an 18! The lock clicks open." or "The orc swings its axe and hits (rolling 1d12 for damage)... you take 7 points of damage." This makes the game feel more interactive and transparent.

IMPORTANT COMBAT RULE: When the player is in combat and attacks an enemy, the enemy MUST immediately counter-attack in the same turn. Describe the enemy's attack in the narrative and apply damage to the player using the "player_updates" object.

IMPORTANT LOOT RULE: When an enemy is defeated (meaning you are adding its name to the "encounters_defeated" array), you MUST also generate appropriate loot for that enemy in the same response. This loot can be in the "new_items", "new_weapons", "new_armor", or "new_rings" arrays. Also, describe the player finding the loot in the narrative.

IMPORTANT EATING/CONSUMABLE RULE: If the player's action involves eating or drinking a consumable item (like 'eat apple', 'drink potion'), you must determine an appropriate effect. For food or healing potions, provide a reasonable amount of healing in the "player_updates.healing_received" field. Describe the effect in the "narrative" and remove the consumed item by adding it to the "items_used" array with a quantity of 1.

When the player encounters a well-known fictional character (e.g., from movies, comics, or novels), use your knowledge to describe them accurately. For image prompts of these characters, describe their key features for a pixel art representation.
If the player uses an ability like "summon" or "raise dead", describe the creature appearing and joining the fight in the narrative. Then, create a temporary party member by adding an object to the "new_party_members" array and setting its "is_summon" property to true. These summons are temporary and will automatically be removed from the party at the end of combat.

Your output MUST be a single valid JSON object. Do not include any text, code blocks, or markdown formatting before or after the JSON object.
The JSON object must have seventeen keys:
1. "narrative": A string containing your description. Ensure any special characters like quotes (") or backslashes (\\) are properly escaped.
2. "image_prompt": A string for a DALL-E prompt to generate a pixel art image of the current scene. Null if no significant visual change.
3. "location_type": A string describing the current environment. Null if no change. Valid options: "tavern", "village", "town", "forest", "mountain", "farm", "cabin", "cave", "dungeon", "evil_lair", "battle", "sci_fi_base", "cyber_city", "ancient_ruins", "castle".
4. "new_items": An array of objects for any items the player acquires in this turn. Each object must have "name" (string), "quantity" (number), "description" (string, a short in-game description of the item), and "icon_prompt" (a simple DALL-E prompt for a pixel art icon of the item). If no items are acquired, this should be an empty array [].
5. "new_party_members": An array of objects for any characters who join the party. Each object must have "name" (string), "hp" (number, their starting and maximum health), "description" (string, a short title like "Wise Wizard"), "full_description" (string, a more detailed paragraph), "stats" (string, a list of RPG-style stats like "Strength: 18, Agility: 12"), "moveset" (string, a comma-separated list of 2-3 thematic abilities), "icon_prompt" (a DALL-E prompt for a pixel art avatar), "level" (number, starting level, usually 1), "skill_points" (number, starting points, usually 1), "skill_tree" (array of 3-5 skill objects, each with "name", "description", and "level" requirement), and "is_summon" (boolean, optional, set to true for temporary combat summons). If no one joins, this should be an empty array [].
6. "items_used": An array of objects for any items the player consumes, uses, gives to an NPC or party member, or otherwise loses. Each object must have "name" (string), "quantity" (number), and "icon_prompt" (a simple DALL-E prompt for the item's pixel art icon). If no items are used/lost, this should be an empty array [].
7. "party_members_left": An array of objects for any characters who leave the party. Each object must have "name" (string). If no one leaves, this should be an empty array [].
8. "new_weapons": An array of objects for any equippable weapons or tools the player finds. Each object must have "name" (string), "stats" (string, e.g., "1d6 slashing", "Utility"), "description" (string, a short in-game description of the weapon), and "icon_prompt" (a DALL-E prompt for a pixel art icon). If no weapons are found, this should be an empty array [].
9. "new_armor": An array of objects for equippable armor. Each must have "name" (string), "stats" (string, e.g., "+5 Armor"), "description" (string, a short in-game description), and "icon_prompt" (a DALL-E prompt for a pixel art icon). Empty array [] if none.
10. "new_rings": An array of objects for equippable rings. Each must have "name" (string), "stats" (string, e.g., "+1 Strength"), "description" (string, a short in-game description), and "icon_prompt" (a DALL-E prompt for a pixel art icon). Empty array [] if none.
11. "new_encounters": An array of objects for new enemies appearing. Each must have "name" (string), "hp" (number), and "icon_prompt" (string). Empty array [] if none.
12. "encounter_updates": An array of objects for changes to existing enemies. Each must have "name" (string) to identify the target and can include "damage_taken" (number), "status_applied" (string, e.g., "poisoned", "stunned"), or "status_removed" (string). Empty array [] if no changes.
13. "player_updates": An object for changes to the player. Can include "damage_taken" (number), "healing_received" (number), "status_applied" (string), "status_removed" (string), or "xp_gained" (number). Use an empty object {} if no changes.
14. "encounters_defeated": An array of strings, with the names of any enemies defeated this turn. Empty array [] if none.
15. "suggested_actions": An array of three short, distinct strings (max 5-6 words each) representing the next possible actions for the player. These should be written from the player's perspective (e.g., "Inspect the chest", "Talk to the bartender", "Leave the room"). If the situation is conclusive (e.g., game over), this can be an empty array [].
16. "sound_effect": A string representing a sound to be played. Null if no specific sound is needed. Valid options: "purchase". Use "purchase" when the narrative describes buying, selling, paying for something, or an exchange of money.
17. "party_member_updates": An array of objects for changes to party members. Each object must have "name" (string) to identify the target and can include "damage_taken" (number), "healing_received" (number), or "xp_gained" (number). Empty array [] if none.

Example of a combat response:
{
    "narrative": "You swing your sword, landing a solid blow on the Goblin Scout! It shrieks and retaliates with a rusty dagger, scratching your arm.",
    "image_prompt": null,
    "location_type": "battle",
    "new_items": [],
    "new_party_members": [],
    "items_used": [],
    "party_members_left": [],
    "new_weapons": [],
    "new_armor": [],
    "new_rings": [],
    "new_encounters": [],
    "encounter_updates": [
        { "name": "Goblin Scout", "damage_taken": 15, "status_applied": null }
    ],
    "player_updates": { "damage_taken": 4, "healing_received": 0, "status_applied": null, "status_removed": null, "xp_gained": 0 },
    "encounters_defeated": [],
    "suggested_actions": ["Attack the goblin again", "Try to dodge", "Use a healing potion"],
    "sound_effect": null
}`

};

function updateControlButtons() {
    const canUndo = conversationHistory.length >= 2 &&
                    conversationHistory[conversationHistory.length - 1].role === 'assistant' &&
                    conversationHistory[conversationHistory.length - 2].role === 'user';
    undoButton.disabled = !canUndo;
}

// Music Management - Genre-based system
const genreTracks = {
    medieval: [
        '/rpgadventuremusic/mediaval.mp3',
        '/rpgadventuremusic/medival.mp3',
        '/rpgadventuremusic/medival (2).mp3',
        '/rpgadventuremusic/medival (3).mp3',
        '/rpgadventuremusic/medival (4).mp3',
        '/rpgadventuremusic/medival (5).mp3'
    ],
    scifi: [
        '/rpgadventuremusic/scifi.mp3',
        '/rpgadventuremusic/scifi (2).mp3',
        '/rpgadventuremusic/scifi (3).mp3',
        '/rpgadventuremusic/scifi (4).mp3',
        '/rpgadventuremusic/scifi (5).mp3',
        '/rpgadventuremusic/scifi (6).mp3',
        '/rpgadventuremusic/scifi (7).mp3',
        '/rpgadventuremusic/scifi (8).mp3',
        '/rpgadventuremusic/scifi (9).mp3',
        '/rpgadventuremusic/scifi (10).mp3'
    ],
    classical: [
        '/rpgadventuremusic/classical.mp3',
        '/rpgadventuremusic/classical (2).mp3',
        '/rpgadventuremusic/classical (3).mp3'
    ],
    country: [
        '/rpgadventuremusic/country.mp3',
        '/rpgadventuremusic/country (1).mp3',
        '/rpgadventuremusic/country (2).mp3',
        '/rpgadventuremusic/country (3).mp3',
        '/rpgadventuremusic/country (4).mp3',
        '/rpgadventuremusic/country (5).mp3'
    ],
    modern: [
        '/rpgadventuremusic/modern (1).mp3',
        '/rpgadventuremusic/modern (2).mp3'
    ]
};

// Map location types to genres
const locationToGenre = {
    'tavern': 'medieval',
    'village': 'medieval',
    'town': 'medieval',
    'castle': 'medieval',
    'ancient_ruins': 'medieval',
    'forest': 'medieval',
    'farm': 'country',
    'cabin': 'country',
    'mountain': 'classical',
    'cave': 'classical',
    'dungeon': 'classical',
    'evil_lair': 'classical',
    'battle': 'classical', // Use classical for battle - dramatic and intense
    'sci_fi_base': 'scifi',
    'cyber_city': 'scifi',
    'club': 'modern',
    'shop': 'modern'
};

let musicFadeInterval;
let currentGenre = null;
let currentTrackIndex = -1;

// Get random track from genre, avoiding current track if possible
function getRandomTrackFromGenre(genre) {
    const tracks = genreTracks[genre];
    if (!tracks || tracks.length === 0) return null;

    // If only one track, return it
    if (tracks.length === 1) return tracks[0];

    // Pick random track different from current if possible
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * tracks.length);
    } while (randomIndex === currentTrackIndex && tracks.length > 1);

    currentTrackIndex = randomIndex;
    return tracks[randomIndex];
}

async function changeBackgroundMusic(locationType) {
    const genre = locationToGenre[locationType];
    if (!genre || !genreTracks[genre]) return;

    const wasPlaying = !backgroundMusic.paused;

    // If same genre, don't change (let current track finish and auto-select next)
    if (genre === currentGenre && wasPlaying) return;

    currentGenre = genre;
    currentMusicType = locationType;
    const newMusicSrc = getRandomTrackFromGenre(genre);

    if (!newMusicSrc) return;

    if (musicFadeInterval) clearInterval(musicFadeInterval);

    if (wasPlaying) {
        musicFadeInterval = setInterval(() => {
            if (backgroundMusic.volume > 0.05) {
                backgroundMusic.volume -= 0.05;
            } else {
                clearInterval(musicFadeInterval);
                backgroundMusic.pause();
                backgroundMusic.src = newMusicSrc;
                backgroundMusic.load();
                backgroundMusic.volume = 0;
                const playPromise = backgroundMusic.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        const targetVolume = 0.3;
                        musicFadeInterval = setInterval(() => {
                            if (backgroundMusic.volume < targetVolume) {
                                backgroundMusic.volume = Math.min(backgroundMusic.volume + 0.05, targetVolume);
                            } else { clearInterval(musicFadeInterval); musicFadeInterval = null; }
                        }, 100);
                    }).catch(err => console.error("Could not play new music:", err));
                }
            }
        }, 100);
    } else {
        backgroundMusic.pause();
        backgroundMusic.src = newMusicSrc;
        backgroundMusic.load();
        backgroundMusic.volume = 0;
        // Do not play when muted/paused
    }
}

// Auto-play next random track from same genre when current track ends
backgroundMusic.addEventListener('ended', () => {
    if (currentGenre && !backgroundMusic.paused) {
        const nextTrack = getRandomTrackFromGenre(currentGenre);
        if (nextTrack) {
            backgroundMusic.src = nextTrack;
            backgroundMusic.load();
            backgroundMusic.volume = 0.3;
            backgroundMusic.play().catch(err => console.error("Could not play next track:", err));
        }
    }
});

// Generate location image
async function generateLocationImage(prompt) {
    if (!prompt) return;
    const styleTag = getStyleTag('scene');
    try {
        if (showLoaderForNextImage) imageLoader.classList.remove('hidden');
        const result = await websim.imageGen({
            prompt: `${prompt}, ${styleTag}${characterPhotoDataUrl ? ', keep main hero face consistent' : ''}`,
            aspect_ratio: "16:9",
            image_inputs: characterPhotoDataUrl ? [{ url: characterPhotoDataUrl }] : undefined
        });
        const preloader = new Image();
        preloader.onload = () => {
            const fadeOut = () => { locationImage.style.opacity = '0'; };
            const swapIn = () => {
                locationImage.src = result.url; locationImage.style.opacity = '1';
                // Update fullscreen view if active, with a smooth crossfade
                if (fullscreenOverlay.classList.contains('active')) {
                    fullscreenImage.style.opacity = '0';
                    requestAnimationFrame(() => {
                        fullscreenImage.src = result.url;
                        requestAnimationFrame(() => { fullscreenImage.style.opacity = '1'; });
                    });
                }
                if (showLoaderForNextImage) { imageLoader.classList.add('hidden'); showLoaderForNextImage = false; }
            };
            fadeOut(); setTimeout(swapIn, 50);
        };
        preloader.src = result.url;
        generatedImages.push({ url: result.url, ts: Date.now(), index: generatedImages.length + 1 });

        // SFX disabled - Groq doesn't support sound effects generation
        // Stop any playing SFX when scene changes
        if (currentSfxAudio) {
            currentSfxAudio.pause();
            currentSfxAudio = null;
        }
    } catch (error) {
        console.error("Error generating image:", error);
        if (showLoaderForNextImage) { imageLoader.classList.add('hidden'); showLoaderForNextImage = false; }
    }
}

// Try to play music on load
window.addEventListener('load', async () => {
    await initAudioContext();
    // Load pixel click sound
    pixelClickBuffer = await loadSound('/pixel_click.mp3');
    // Load walking sound
    walkingSoundBuffer = await loadSound('/walking_sound.mp3');
    // Load coin sound
    coinSoundBuffer = await loadSound('/coin_sound.mp3');
    // New: Load dice roll sound
    diceRollBuffer = await loadSound('/dice_roll.mp3');

    // Show start menu, hide app container
    appContainer.style.display = 'none';
    startScreenContainer.style.display = 'flex';
    
    // Music does not autoplay until game starts
    backgroundMusic.volume = 0.3; // Set default volume, but keep paused
    musicButton.innerHTML = `<i class="fas fa-volume-mute"></i>`;
    ttsButton.innerHTML = `<i class="fas fa-microphone"></i>`;

    updateControlButtons();
});

// Add global click listener for button sound effects
document.body.addEventListener('click', async (event) => {
    // Initialize AudioContext on first user interaction (browser requirement)
    await initAudioContext();

    const targetButton = event.target.closest('button');
    if (targetButton && !targetButton.disabled && targetButton !== musicButton) { // Exclude music button from general click sound
        playSound(pixelClickBuffer);
    }
});

// New: Event delegation for AI message clicks to show context menu
messagesContainer.addEventListener('click', (e) => {
    // Hide any open textareas if clicking away
    const activeTextarea = messagesContainer.querySelector('textarea');
    if (activeTextarea && !e.target.contains(activeTextarea)) {
        const messageDiv = activeTextarea.closest('.ai-message');
        if (messageDiv) {
            // Revert to paragraph
            messageDiv.innerHTML = messageDiv.dataset.originalText;
        }
    }
    
    // Reset context menu state
    messageContextMenu.classList.add('hidden');
    activeContextMenuMessage = null;
    activeContextMenuMessageIndex = -1;
    
    const aiMessage = e.target.closest('.ai-message');
    // Don't show menu if the click is on an input field inside the message
    if (aiMessage && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();

        const messageIndex = parseInt(aiMessage.dataset.historyIndex, 10);
        
        // A valid target for regeneration is an assistant message with a user message before it.
        if (isNaN(messageIndex) || messageIndex < 1 || conversationHistory[messageIndex].role !== 'assistant' || conversationHistory[messageIndex - 1].role !== 'user') {
            return; 
        }

        activeContextMenuMessage = aiMessage;
        activeContextMenuMessageIndex = messageIndex;

        // Position and show menu
        const rect = aiMessage.getBoundingClientRect();
        messageContextMenu.style.top = `${e.clientY}px`;
        messageContextMenu.style.left = `${e.clientX}px`;
        messageContextMenu.classList.remove('hidden');
    }
});

// New: Global click listener to hide the context menu when clicking elsewhere
window.addEventListener('click', (e) => {
    if (!e.target.closest('.ai-message') && !e.target.closest('.context-menu')) {
        messageContextMenu.classList.add('hidden');
    }
}, true); // Use capture phase to ensure it runs before other clicks

async function getAIResponse(userPrompt) {
    // Add user message to UI and history
    if (userPrompt) {
        addMessage(userPrompt, 'user');
        conversationHistory.push({ role: 'user', content: userPrompt });
        updateControlButtons(); // Update buttons after user message
    }

    // New: Check if we were in battle before this turn's updates
    wasInBattle = activeEncounters.length > 0;

    // Clear input and show typing indicator
    input.value = '';
    suggestionButtonsContainer.innerHTML = ''; // Clear suggestions
    typingIndicator.classList.remove('hidden');
    scrollToBottom();

    try {
        // Limit history to the last 10 messages to manage token size
        const messagesToSend = [systemMessage, ...conversationHistory.slice(-10)];

        // DEBUG: Log conversation history
        console.log('🔍 Conversation History Length:', conversationHistory.length);
        console.log('🔍 Messages to send:', messagesToSend.map(m => ({ role: m.role, preview: m.content.substring(0, 50) + '...' })));

        let completion;
        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let rawContent = '';

        while (attempt < maxRetries && !success) {
            try {
                attempt++;
                completion = await websim.chat.completions.create({
                    messages: messagesToSend,
                });
                rawContent = completion.content;
                success = true; // If we get here, the request was successful
            } catch (error) {
                console.error(`AI request attempt ${attempt} failed:`, error);
                if (attempt >= maxRetries) {
                    // Last attempt failed, throw error to be caught by the outer catch block
                    throw error;
                }
                // Wait before retrying (e.g., 1s, 2s)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }

        // The response content should be a JSON string.
        let responseData;
        try {
            // New Robust JSON Parsing: Find the JSON block in the response.
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON object found in the AI response.");
            }
            responseData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
             console.error("Error parsing AI response JSON:", parseError);
             console.error("Received content:", rawContent);
            
             // Fallback: Ask the AI to fix the broken JSON
             try {
                console.log("Attempting to ask AI to fix its own JSON...");
                const fixCompletion = await websim.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are a helpful assistant that corrects invalid JSON. The user will provide a broken JSON string. You must respond ONLY with the corrected, valid JSON object, and no other text or explanation." },
                        { role: "user", content: rawContent }
                    ],
                    json: true // We can be stricter here, as the task is simpler.
                });
                responseData = JSON.parse(fixCompletion.content);
                console.log("AI successfully corrected the JSON.");
             } catch (fixError) {
                console.error("AI failed to correct the JSON:", fixError);
                addMessage("The Dungeon Master's thoughts are scrambled. Please try again.", 'ai');
                return; // Exit early if JSON is invalid and could not be fixed
             }
        }
        
        const aiResponse = responseData.narrative;
        const imagePrompt = responseData.image_prompt;
        const locationType = responseData.location_type;
        const newItems = responseData.new_items;
        const newPartyMembers = responseData.new_party_members;
        const itemsUsed = responseData.items_used; // Extract items used from AI response
        const partyMembersLeft = responseData.party_members_left;
        const newWeapons = responseData.new_weapons; // New: extract weapons
        const newArmor = responseData.new_armor;
        const newRings = responseData.new_rings;
        const suggestedActions = responseData.suggested_actions; // New: extract suggested actions
        const soundEffect = responseData.sound_effect; // New: extract sound effect
        const partyMemberUpdates = responseData.party_member_updates; // New: extract party member updates

        // New combat-related data
        const newEncounters = responseData.new_encounters;
        const encounterUpdates = responseData.encounter_updates;
        const playerUpdates = responseData.player_updates;
        const encountersDefeated = responseData.encounters_defeated;

        // Play sound effect if provided
        if (soundEffect === 'purchase') {
            playSound(coinSoundBuffer);
        }

        // Only add a message if the narrative is a non-empty string
        if (typeof aiResponse === 'string' && aiResponse.trim().length > 0) {
            // Store the entire JSON response in history. addMessage will parse it for display.
            const contentToStore = JSON.stringify(responseData);
            addMessage(contentToStore, 'ai');
            conversationHistory.push({ role: 'assistant', content: contentToStore });
        } else {
             // If narrative is empty, but we got an image prompt, we don't push to history.
             // If both are empty, this logs it. The user sees nothing, which is better than a blank message.
            console.log("Received a response with an empty narrative.");
        }

        // Generate new image if prompt is provided
        if (imagePrompt) {
            await generateLocationImage(imagePrompt);
        }

        // Change music if location type is provided
        if (locationType) {
            await changeBackgroundMusic(locationType);
        }

        // Add new items to inventory
        if (newItems && Array.isArray(newItems) && newItems.length > 0) {
            for (const item of newItems) {
                if (item.name && item.quantity && item.icon_prompt && item.description) {
                    await addItemToInventory(item.name, item.quantity, item.description, item.icon_prompt);
                } else {
                    console.warn("Received incomplete item data:", item);
                }
            }
        }
        
        // Add new party members
        if (newPartyMembers && Array.isArray(newPartyMembers) && newPartyMembers.length > 0) {
            for (const member of newPartyMembers) {
                if (member.name && member.description && member.full_description && member.stats && member.moveset && member.icon_prompt && member.hp) {
                    await addPartyMember(member.name, member.description, member.full_description, member.stats, member.moveset, member.icon_prompt, member.hp, member.is_summon);
                } else {
                    console.warn("Received incomplete party member data:", member);
                }
            }
        }

        // Add new weapons
        if (newWeapons && Array.isArray(newWeapons) && newWeapons.length > 0) {
            for (const weapon of newWeapons) {
                if (weapon.name && weapon.stats && weapon.icon_prompt && weapon.description) {
                    await addWeapon(weapon.name, weapon.stats, weapon.description, weapon.icon_prompt);
                } else {
                    console.warn("Received incomplete weapon data:", weapon);
                }
            }
        }

        // Add new armor
        if (newArmor && Array.isArray(newArmor) && newArmor.length > 0) {
            for (const armor of newArmor) {
                if (armor.name && armor.stats && armor.icon_prompt && armor.description) {
                    await addArmor(armor.name, armor.stats, armor.description, armor.icon_prompt);
                } else {
                    console.warn("Received incomplete armor data:", armor);
                }
            }
        }

        // Add new rings
        if (newRings && Array.isArray(newRings) && newRings.length > 0) {
            for (const ring of newRings) {
                if (ring.name && ring.stats && ring.icon_prompt && ring.description) {
                    await addRing(ring.name, ring.stats, ring.description, ring.icon_prompt);
                } else {
                    console.warn("Received incomplete ring data:", ring);
                }
            }
        }

        // Add new encounters
        if (newEncounters && Array.isArray(newEncounters) && newEncounters.length > 0) {
            for (const encounter of newEncounters) {
                if (encounter.name && encounter.hp && encounter.icon_prompt) {
                    await addEncounter(encounter.name, encounter.hp, encounter.icon_prompt);
                } else {
                    console.warn("Received incomplete encounter data:", encounter);
                }
            }
        }
        
        // Process player updates
        if (playerUpdates) {
            if (playerUpdates.damage_taken) {
                updatePlayerHP(player.hp - playerUpdates.damage_taken);
            }
            if (playerUpdates.healing_received) {
                updatePlayerHP(player.hp + playerUpdates.healing_received);
            }
            if (playerUpdates.xp_gained) {
                addPlayerXP(playerUpdates.xp_gained);
            }
            if (playerUpdates.status_applied) {
                addStatusEffect(player, playerStatusEffectsContainer, playerUpdates.status_applied);
            }
            if (playerUpdates.status_removed) {
                removeStatusEffect(player, playerStatusEffectsContainer, playerUpdates.status_removed);
            }
        }

        // Process party member updates
        if (partyMemberUpdates && Array.isArray(partyMemberUpdates) && partyMemberUpdates.length > 0) {
            for (const update of partyMemberUpdates) {
                const member = partyMembers.find(m => m.name === update.name);
                if (member) {
                    let newHp = member.hp;
                    if (update.damage_taken) {
                        newHp -= update.damage_taken;
                    }
                    if (update.healing_received) {
                        newHp += update.healing_received;
                    }
                    updatePartyMemberHP(member.name, newHp);

                    if (update.xp_gained) {
                        addPartyMemberXP(member.name, update.xp_gained);
                    }
                }
            }
        }

        // Process encounter updates
        if (encounterUpdates && Array.isArray(encounterUpdates) && encounterUpdates.length > 0) {
            for (const update of encounterUpdates) {
                const encounter = activeEncounters.find(e => e.name === update.name);
                if (encounter) {
                    if (update.damage_taken) {
                        updateEncounterHP(encounter.name, encounter.hp - update.damage_taken);
                    }
                    if (update.status_applied) {
                        const encounterElement = document.getElementById(`encounter-${encounter.id}`);
                        const statusContainer = encounterElement.querySelector('.status-effects-container');
                        addStatusEffect(encounter, statusContainer, update.status_applied);
                    }
                     if (update.status_removed) {
                        const encounterElement = document.getElementById(`encounter-${encounter.id}`);
                        const statusContainer = encounterElement.querySelector('.status-effects-container');
                        removeStatusEffect(encounter, statusContainer, update.status_removed);
                    }
                }
            }
        }

        // Process defeated encounters
        if (encountersDefeated && Array.isArray(encountersDefeated) && encountersDefeated.length > 0) {
            for (const name of encountersDefeated) {
                removeEncounter(name);
            }
        }

        // New: Check for battle end and handle summons
        const isCurrentlyInBattle = activeEncounters.length > 0;
        if (wasInBattle && !isCurrentlyInBattle) {
            handleBattleEnd();
        }

        // Process items used
        if (itemsUsed && Array.isArray(itemsUsed) && itemsUsed.length > 0) {
            for (const item of itemsUsed) {
                if (item.name && item.quantity) {
                    removeItemFromInventory(item.name, item.quantity); // Reusing existing function for decrement/removal
                } else {
                    console.warn("Received incomplete item used data:", item);
                }
            }
        }

        // Process party members leaving
        if (partyMembersLeft && Array.isArray(partyMembersLeft) && partyMembersLeft.length > 0) {
            for (const member of partyMembersLeft) {
                if (member.name) {
                    removePartyMember(member.name);
                } else {
                    console.warn("Received incomplete party member left data:", member);
                }
            }
        }
        
        // Display suggested actions
        suggestionButtonsContainer.innerHTML = ''; // Clear previous
        if (isCurrentlyInBattle && selectedClass && selectedClass.moveset) {
            // In battle: show player moveset
            const moves = selectedClass.moveset.split(',').map(move => move.trim());
            moves.forEach(move => {
                const button = document.createElement('button');
                button.classList.add('suggestion-button');
                button.textContent = move;
                button.addEventListener('click', () => {
                    const attackPrompt = `I use my ${move} attack.`;
                    // Don't add to input, just execute directly with dice roll
                    // This makes the UI feel more responsive
                    executeWithDiceRoll(attackPrompt);
                });
                suggestionButtonsContainer.appendChild(button);
            });
        } else if (suggestedActions && Array.isArray(suggestedActions) && suggestedActions.length > 0) {
            // Out of battle: show AI suggestions
            suggestedActions.forEach(action => {
                const button = document.createElement('button');
                button.classList.add('suggestion-button');
                button.textContent = action;
                button.addEventListener('click', () => {
                    input.value = action;
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                });
                suggestionButtonsContainer.appendChild(button);
            });
        }

    } catch (error) {
        console.error("Error fetching AI response after multiple retries:", error);
        addMessage("Sorry, I'm still having trouble connecting after a few tries. Please check your connection and try again later.", 'ai');
        // Stop autoplay on error
        if (isAutoPlaying) {
            toggleAutoplay(); 
        }
    } finally {
        // Hide typing indicator
        typingIndicator.classList.add('hidden');
        scrollToBottom();
        updateControlButtons(); // Update buttons after AI response

        // If autoplay is still on, schedule the next step
        if (isAutoPlaying) {
            scheduleAutoplayNext();
        }
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Stop autoplay if the user sends a message
    if (isAutoPlaying) {
        toggleAutoplay();
    }

    // Play writing sound effect
    if (writingSound) {
        writingSound.currentTime = 0; // Rewind to start
        writingSound.play().catch(error => console.error("Could not play writing sound:", error));
    }

    // On first user interaction, try to play music if it hasn't started
    if (!musicStarted) {
        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                musicStarted = true;
                musicButton.innerHTML = `<i class="fas fa-volume-up"></i>`;
            }).catch(error => {
                console.error("Could not play music on interaction:", error);
            });
        }
    }

    const userInput = input.value.trim();
    if (!userInput) return;

    // Check if the message is related to walking
    const walkingKeywords = ['walk', 'go', 'move', 'travel', 'explore', 'proceed', 'advance', 'head to'];
    const lowerCaseInput = userInput.toLowerCase();
    const isWalkingRelated = walkingKeywords.some(keyword => lowerCaseInput.includes(keyword));

    if (isWalkingRelated) {
        playSound(walkingSoundBuffer);
    }
    
    // New: Check for combat to trigger dice roll
    const isAttack = activeEncounters.length > 0 && (lowerCaseInput.includes('attack') || lowerCaseInput.includes('use my'));
    if (isAttack) {
        await executeWithDiceRoll(userInput);
    } else {
        await getAIResponse(userInput);
    }

    // Reset textarea after sending
    input.value = '';
    input.style.height = 'auto';
});

// Allow Enter to send and Shift+Enter for a new line in textarea
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
});

// Auto-resize textarea
input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
});

function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    
    let messageText = text;
    // For AI messages, the 'text' might be a JSON string. We parse it to display the narrative.
    if (sender === 'ai') {
        let ttsNarrative = null;
        try {
            const parsedData = JSON.parse(text);
            if (parsedData && parsedData.narrative) {
                messageText = parsedData.narrative;
                ttsNarrative = parsedData.narrative;
            }
        } catch (e) {
            // Not a JSON string, probably from an old save file or an error message.
            // We can just display the text as is.
        }
        // Add a data attribute with its index in the conversation history
        messageElement.dataset.historyIndex = conversationHistory.length;

        // New: Regex to find and style dice rolls
        const diceRollRegex = /\((rolling[^)]+)\)/gi;
        messageText = messageText.replace(diceRollRegex, (match, p1) => {
            return `<span class="dice-roll"><i class="fas fa-dice-d20"></i> ${p1.trim()}</span>`;
        });
        messageElement.innerHTML = messageText;

        // Add audio button for AI messages
        let audioBtn = null;
        if (ttsNarrative && ttsEnabled) {
            audioBtn = document.createElement('button');
            audioBtn.className = 'message-audio-btn';
            audioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            audioBtn.title = 'Play/Stop Audio';
            audioBtn.onclick = (e) => {
                e.stopPropagation();
                toggleMessageAudio(messageElement, ttsNarrative, audioBtn);
            };
            messageElement.appendChild(audioBtn);
        }

        // Auto-play TTS - button allows stopping
        if (!suppressTTS && ttsNarrative && ttsEnabled && audioBtn) {
            // Auto-play after a short delay to ensure button is rendered
            setTimeout(() => {
                toggleMessageAudio(messageElement, ttsNarrative, audioBtn);
            }, 100);
        }
    } else {
        messageElement.textContent = text;
    }

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- Player & Encounter Management ---

function updatePlayerHP(newHp) {
    player.hp = Math.max(0, Math.min(player.maxHp, newHp));
    const percentage = (player.hp / player.maxHp) * 100;
    playerHpBar.style.width = `${percentage}%`;
    playerHpText.textContent = `${player.hp} / ${player.maxHp}`;
}

// New: Function to update party member HP
function updatePartyMemberHP(name, newHp) {
    const member = partyMembers.find(m => m.name === name);
    if (member) {
        member.hp = Math.max(0, Math.min(member.maxHp, newHp));
        const memberElement = document.getElementById(member.id);
        if (memberElement) {
            const hpBar = memberElement.querySelector('.hp-bar-fill');
            const hpText = memberElement.querySelector('.hp-bar-text');
            const percentage = (member.hp / member.maxHp) * 100;
            hpBar.style.width = `${percentage}%`;
            hpText.textContent = `${member.hp} / ${member.maxHp}`;
        }
    }
}

// New: Function to add XP and handle leveling up
function addPlayerXP(amount) {
    player.xp += amount;
    if (player.xp >= player.xpToNextLevel) {
        player.level++;
        player.xp -= player.xpToNextLevel;
        player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.5); // Increase XP for next level
        player.skillPoints++;
        player.upgradePoints += 3; // New: Gain upgrade points on level up
        addMessage(`LEVEL UP! You are now level ${player.level}. You have gained a skill point and 3 upgrade points!`, 'ai');
        // Future: could also heal player on level up, etc.
    }
    updatePlayerXPBar();
    updateAllSkillPointDisplays(); // New: update all skill point displays
    updateEvolutionMenuUI(); // New: Check if evolution is available
}

// New: Function to add XP to a party member and handle their leveling up
function addPartyMemberXP(name, amount) {
    const member = partyMembers.find(m => m.name === name);
    if (!member || member.is_summon) return; // Summons don't level up

    member.xp += amount;
    if (member.xp >= member.xpToNextLevel) {
        member.level++;
        member.xp -= member.xpToNextLevel;
        member.xpToNextLevel = Math.floor(member.xpToNextLevel * 1.5);
        member.skill_points++;
        addMessage(`${member.name} has reached level ${member.level} and gained a skill point!`, 'ai');
        
        // Refresh upgrade modal if it's open for this member
        if (partyUpgradeModal.classList.contains('active') && partyUpgradeModal.dataset.memberName === name) {
            showPartyMovesModal(name);
        }
    }
    // Note: We don't have a UI for party member XP bars yet, but the data is tracking.
}

// New: Helper function to parse stat strings from AI
function parseStatsString(statsString) {
    const stats = {};
    if (statsString && typeof statsString === 'string') {
        statsString.split(',').forEach(stat => {
            const [key, value] = stat.split(':');
            if (key && value) {
                stats[key.trim()] = parseInt(value.trim(), 10);
            }
        });
    }
    return stats;
}

// New: Helper function to format stat objects back to strings for display
function formatStatsObject(statsObject) {
    if (!statsObject || typeof statsObject !== 'object') return "";
    return Object.entries(statsObject).map(([key, value]) => `${key}: ${value}`).join(', ');
}

// New: Function to update all displays showing skill points
function updateAllSkillPointDisplays() {
    updateSkillTreeUI();
    updateRaceMenuUI();
    updateEvolutionMenuUI(); // New
    updatePlayerStatsUI(); // New: Also refresh player stats UI to update button states
    // This function will be called whenever points are spent,
    // so we can also refresh the upgrade modal if it's open.
    const memberName = partyUpgradeModal.dataset.memberName;
    if (partyUpgradeModal.classList.contains('active') && memberName) {
        showPartyMovesModal(memberName);
    }
}

// New: Function to parse stat strings and apply them
function calculateCurrentStats() {
    // Start with a copy of base stats
    player.stats = { ...player.baseStats };

    // Regex to parse stats like "+1 Strength" or "-2 Dexterity"
    const statRegex = /([+-]\d+)\s+(.+)/;

    // Iterate over all equipped items
    for (const slot in equipment) {
        const item = equipment[slot];
        if (item && item.stats) {
            // Handle multiple stats, e.g., "+1 Str, +1 Con"
            const statsBonuses = item.stats.split(',');
            statsBonuses.forEach(bonusStr => {
                const match = bonusStr.trim().match(statRegex);
                if (match) {
                    const value = parseInt(match[1], 10);
                    const statName = match[2].trim();
                    
                    // Find the stat in player.stats (case-insensitive) to apply the bonus
                    const playerStatKey = Object.keys(player.stats).find(key => key.toLowerCase() === statName.toLowerCase());

                    if (playerStatKey) {
                        player.stats[playerStatKey] += value;
                    }
                    // If the stat doesn't exist on the player (e.g. "Fire Resistance"), we don't add it for now.
                    // This could be expanded later.
                }
            });
        }
    }
    
    // New: Iterate over unlocked racial skills
    if (player.racialSkills) {
        player.racialSkills.forEach(skill => {
            if (skill.unlocked && skill.bonus) {
                 const match = skill.bonus.trim().match(statRegex);
                 if (match) {
                    const value = parseInt(match[1], 10);
                    const statName = match[2].trim();
                    const playerStatKey = Object.keys(player.stats).find(key => key.toLowerCase() === statName.toLowerCase());
                    if (playerStatKey) {
                        player.stats[playerStatKey] += value;
                    }
                 }
                 // Note: Non-stat bonuses like "10% Fire Resistance" are not handled here yet.
            }
        });
    }

    // After all bonuses are applied, update the UI
    updatePlayerStatsUI();
}

// New: Function to update the player stats UI
function updatePlayerStatsUI() {
    const statsContainer = document.getElementById('player-stats-display');
    statsContainer.innerHTML = ''; // Clear old stats

    if (player.stats && Object.keys(player.stats).length > 0) {
        // Create a header for the stats section
        const statsHeader = document.createElement('div');
        statsHeader.classList.add('stats-header');
        statsHeader.innerHTML = `<h3>Your Stats</h3><span id="upgrade-points-display">(${player.upgradePoints} points)</span>`;
        statsContainer.appendChild(statsHeader);

        const statsList = document.createElement('ul');
        statsList.classList.add('stats-list');
        for (const [stat, value] of Object.entries(player.stats)) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="stat-name">${stat}</span><span class="stat-value">${value}</span>`;

            // Add upgrade button
            const upgradeButton = document.createElement('button');
            upgradeButton.classList.add('upgrade-stat-button');
            upgradeButton.innerHTML = '<i class="fas fa-plus"></i>';
            upgradeButton.disabled = player.upgradePoints < 1;
            upgradeButton.addEventListener('click', () => upgradePlayerStat(stat));
            
            li.appendChild(upgradeButton);
            statsList.appendChild(li);
        }
        statsContainer.appendChild(statsList);
    }
}

// New: Function for the player to spend an upgrade point on a stat
function upgradePlayerStat(statName) {
    if (player.upgradePoints < 1) return;

    player.upgradePoints--;

    // Increase the base stat. calculateCurrentStats will handle the rest.
    if (player.baseStats && player.baseStats[statName] !== undefined) {
        player.baseStats[statName]++;
    }

    // Recalculate and update UI
    calculateCurrentStats();
    updatePlayerStatsUI();
    playSound(pixelClickBuffer); // Give audio feedback
}

// New: Function to update the XP bar UI
function updatePlayerXPBar() {
    playerLevelDisplay.textContent = `Level ${player.level}`;
    const percentage = (player.xp / player.xpToNextLevel) * 100;
    playerXpBar.style.width = `${percentage}%`;
    playerXpText.textContent = `${player.xp} / ${player.xpToNextLevel} XP`;
}

// New: Function to handle the end of a battle
function handleBattleEnd() {
    console.log("Battle has ended. Removing summons.");
    const summons = partyMembers.filter(member => member.is_summon);
    if (summons.length > 0) {
        addMessage("As the last foe falls, your summoned allies fade away...", 'ai');
        // We create a copy of the names to avoid issues while iterating and modifying the original array
        const summonNames = summons.map(s => s.name); 
        summonNames.forEach(name => {
            removePartyMember(name);
        });
    }
}

function removeEncounter(name) {
    const encounterIndex = activeEncounters.findIndex(e => e.name === name);
    if (encounterIndex > -1) {
        const encounter = activeEncounters[encounterIndex];
        // Ensure XP is granted for defeating the enemy
        const xpGained = Math.floor(encounter.maxHp / 2) + 10; // Example: 100hp monster = 60xp
        addPlayerXP(xpGained);
        addMessage(`You defeated the ${name} and gained ${xpGained} XP!`, 'ai');

        const encounterElement = document.getElementById(`encounter-${encounter.id}`);
        if (encounterElement) {
            encounterElement.style.opacity = '0';
            setTimeout(() => encounterElement.remove(), 500);
        }
        activeEncounters.splice(encounterIndex, 1);
    }
}

function addStatusEffect(target, container, effectName) {
    const effectLower = effectName.toLowerCase();
    if (target.statusEffects.includes(effectLower)) return; // Already has it

    target.statusEffects.push(effectLower);
    const effectElement = document.createElement('span');
    effectElement.classList.add('status-effect', effectLower);
    effectElement.textContent = effectName;
    effectElement.id = `status-${target.id || 'player'}-${effectLower}`;
    container.appendChild(effectElement);
}

function removeStatusEffect(target, container, effectName) {
    const effectLower = effectName.toLowerCase();
    const index = target.statusEffects.indexOf(effectLower);
    if (index > -1) {
        target.statusEffects.splice(index, 1);
        const effectElement = container.querySelector(`#status-${target.id || 'player'}-${effectLower}`);
        if (effectElement) {
            effectElement.remove();
        }
    }
}

// --- Item Management ---
async function addItemToInventory(name, quantity, description, iconPrompt) {
    // Check if item already exists in our in-memory array
    const existingItem = inventoryItems.find(item => item.name.toLowerCase() === name.toLowerCase());

    if (existingItem) {
        existingItem.quantity += quantity;
        // Update UI for existing item
        const existingLi = Array.from(itemList.children).find(li => {
            const itemNameEl = li.querySelector('.item-name');
            return itemNameEl && itemNameEl.textContent.toLowerCase() === name.toLowerCase();
        });
        if (existingLi) {
            existingLi.querySelector('.item-quantity').textContent = `x${existingItem.quantity}`;
        }
    } else {
        // Create new item in UI
        const li = document.createElement('li');
        li.classList.add('item');

        const img = document.createElement('img');
        img.alt = name;
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent placeholder

        let itemIconUrl = "https://img.icons8.com/dotty/80/000000/box-important.png"; // Fallback icon
        try {
            const result = await websim.imageGen({
                prompt: `${iconPrompt}, ${getStyleTag('icon')}, simple, white background`,
                aspect_ratio: "1:1"
            });
            itemIconUrl = result.url;
            img.src = itemIconUrl;
        } catch (error) {
            console.error(`Error generating icon for ${name}:`, error);
        }

        const itemInfo = document.createElement('div');
        itemInfo.classList.add('item-info');

        const itemName = document.createElement('span');
        itemName.classList.add('item-name');
        itemName.textContent = name;

        const itemQuantity = document.createElement('span');
        itemQuantity.classList.add('item-quantity');
        itemQuantity.textContent = `x${quantity}`;

        itemInfo.appendChild(itemName);
        itemInfo.appendChild(itemQuantity);

        li.appendChild(img);
        li.appendChild(itemInfo);

        itemList.appendChild(li); // Add the new item element to the list in the UI.

        // Add to the in-memory array
        const newItemData = { name, quantity, description, iconUrl: itemIconUrl, iconPrompt: iconPrompt }; // Store iconPrompt as well
        inventoryItems.push(newItemData);

        li.addEventListener('click', () => showDetailsModal({
            name: newItemData.name,
            description: newItemData.description,
            iconUrl: newItemData.iconUrl,
            type: "Item",
            info: { header: 'Quantity', value: newItemData.quantity }
        }));
    }
}

// --- Weapon Management ---
async function addWeapon(name, stats, description, iconPrompt) {
    // For now, we assume each weapon is unique. If duplicates are possible, this logic would need to change.
    const uniqueId = `weapon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newWeapon = { id: uniqueId, name, stats, description, iconUrl: null, iconPrompt };
    
    const li = document.createElement('li');
    li.classList.add('weapon');
    li.id = uniqueId;

    // Will attach click handlers after icon loads
    const img = document.createElement('img');
    img.alt = name;
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let weaponIconUrl = "https://img.icons8.com/dotty/80/000000/sword.png"; // Fallback icon
    try {
        const result = await websim.imageGen({
            prompt: `${iconPrompt}, ${getStyleTag('icon')}, simple, white background`,
            aspect_ratio: "1:1"
        });
        weaponIconUrl = result.url;
        img.src = weaponIconUrl;
        newWeapon.iconUrl = weaponIconUrl; // Update object with URL
    } catch (error) {
        console.error(`Error generating icon for ${name}:`, error);
    }

    const weaponInfo = document.createElement('div');
    weaponInfo.classList.add('weapon-info');

    const weaponName = document.createElement('span');
    weaponName.classList.add('weapon-name');
    weaponName.textContent = name;

    const weaponStats = document.createElement('span');
    weaponStats.classList.add('weapon-stats');
    weaponStats.textContent = stats;

    weaponInfo.appendChild(weaponName);
    weaponInfo.appendChild(weaponStats);

    li.appendChild(img);
    li.appendChild(weaponInfo);
    
    weaponList.appendChild(li);

    // Add to the in-memory array
    weapons.push(newWeapon);

    // Attach click handlers - consistent with armor/rings
    // Click to view details, double-click to equip
    li.addEventListener('click', () => showDetailsModal({
        name: newWeapon.name,
        description: newWeapon.description,
        iconUrl: newWeapon.iconUrl,
        type: "Weapon",
        info: { header: 'Stats', value: newWeapon.stats }
    }));
    li.addEventListener('dblclick', () => {
        equipItem(uniqueId, 'weapon');
        hideDetailsModal();
    });
}

// --- Armor Management ---
async function addArmor(name, stats, description, iconPrompt) {
    const uniqueId = `armor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newArmor = { id: uniqueId, name, stats, description, iconUrl: null, iconPrompt };

    const li = document.createElement('li');
    li.classList.add('armor');
    li.id = uniqueId;

    // Click to view details, double-click to equip
    li.addEventListener('click', () => {
        showDetailsModal({
            name: newArmor.name,
            description: newArmor.description,
            iconUrl: newArmor.iconUrl,
            type: "Armor",
            info: { header: 'Stats', value: newArmor.stats }
        });
    });
    li.addEventListener('dblclick', () => {
        equipItem(uniqueId, 'armor');
        hideDetailsModal();
    });

    const img = document.createElement('img');
    img.alt = name;
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let armorIconUrl = "https://img.icons8.com/dotty/80/000000/body-armor.png";
    try {
        const result = await websim.imageGen({
            prompt: `${iconPrompt}, ${getStyleTag('icon')}, simple, white background`,
            aspect_ratio: "1:1"
        });
        armorIconUrl = result.url;
        img.src = armorIconUrl;
        newArmor.iconUrl = armorIconUrl;
    } catch (error) {
        console.error(`Error generating icon for ${name}:`, error);
    }

    const armorInfo = document.createElement('div');
    armorInfo.classList.add('armor-info');
    const armorName = document.createElement('span');
    armorName.classList.add('armor-name');
    armorName.textContent = name;
    const armorStats = document.createElement('span');
    armorStats.classList.add('armor-stats');
    armorStats.textContent = stats;
    armorInfo.appendChild(armorName);
    armorInfo.appendChild(armorStats);
    li.appendChild(img);
    li.appendChild(armorInfo);
    armorList.appendChild(li);
    armors.push(newArmor);
}

// --- Ring Management ---
async function addRing(name, stats, description, iconPrompt) {
    const uniqueId = `ring-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRing = { id: uniqueId, name, stats, description, iconUrl: null, iconPrompt };

    const li = document.createElement('li');
    li.classList.add('ring');
    li.id = uniqueId;

    // Click to view details, double-click to equip
    li.addEventListener('click', () => {
        showDetailsModal({
            name: newRing.name,
            description: newRing.description,
            iconUrl: newRing.iconUrl,
            type: "Ring",
            info: { header: 'Stats', value: newRing.stats }
        });
    });
    li.addEventListener('dblclick', () => {
        equipItem(uniqueId, 'ring');
        hideDetailsModal();
    });

    const img = document.createElement('img');
    img.alt = name;
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    let ringIconUrl = "https://img.icons8.com/dotty/80/000000/ring.png";
    try {
        const result = await websim.imageGen({
            prompt: `${iconPrompt}, ${getStyleTag('icon')}, simple, white background`,
            aspect_ratio: "1:1"
        });
        ringIconUrl = result.url;
        img.src = ringIconUrl;
        newRing.iconUrl = ringIconUrl;
    } catch (error) {
        console.error(`Error generating icon for ${name}:`, error);
    }

    const ringInfo = document.createElement('div');
    ringInfo.classList.add('ring-info');
    const ringName = document.createElement('span');
    ringName.classList.add('ring-name');
    ringName.textContent = name;
    const ringStats = document.createElement('span');
    ringStats.classList.add('ring-stats');
    ringStats.textContent = stats;
    ringInfo.appendChild(ringName);
    ringInfo.appendChild(ringStats);
    li.appendChild(img);
    li.appendChild(ringInfo);
    ringList.appendChild(li);
    rings.push(newRing);
}

// --- Party Management ---
async function addPartyMember(name, description, fullDescription, stats, moveset, iconPrompt, hp, is_summon = false, level = 1, skill_points = 1, skill_tree = []) {
    const uniqueId = `party-member-${name.replace(/\s+/g, '-')}-${Date.now()}`;
    const li = document.createElement('li');
    li.classList.add('party-member');
    li.id = uniqueId;

    const img = document.createElement('img');
    img.alt = name;
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // Transparent placeholder

    let memberIconUrl = "https://img.icons8.com/ios-glyphs/90/ffffff/user-male-circle.png"; // Fallback icon
    try {
        const result = await websim.imageGen({
            prompt: `${iconPrompt}, ${getStyleTag('avatar')}`,
            transparent: true,
            aspect_ratio: "1:1"
        });
        memberIconUrl = result.url;
        img.src = memberIconUrl;
    } catch (error) {
        console.error(`Error generating icon for ${name}:`, error);
    }

    const memberInfo = document.createElement('div');
    memberInfo.classList.add('member-info');
    const memberName = document.createElement('span');
    memberName.classList.add('member-name');
    memberName.textContent = name;
    const memberStatus = document.createElement('span');
    memberStatus.classList.add('member-status', 'online'); // 'online' gives a nice green dot
    memberStatus.textContent = description;

    // Create HP Bar for party member
    const hpBarContainer = document.createElement('div');
    hpBarContainer.classList.add('hp-bar-container');
    const hpBarFill = document.createElement('div');
    hpBarFill.classList.add('hp-bar-fill', 'ally');
    const hpBarText = document.createElement('span');
    hpBarText.classList.add('hp-bar-text');
    
    hpBarFill.style.width = `100%`;
    hpBarText.textContent = `${hp} / ${hp}`;

    hpBarContainer.appendChild(hpBarFill);
    hpBarContainer.appendChild(hpBarText);

    memberInfo.appendChild(memberName);
    memberInfo.appendChild(memberStatus);
    memberInfo.appendChild(hpBarContainer);
    li.appendChild(img);
    li.appendChild(memberInfo);
    partyList.appendChild(li);

    // Add to the in-memory array
    const statsObject = parseStatsString(stats);
    partyMembers.push({ 
        id: uniqueId,
        name, 
        description, 
        full_description: fullDescription, 
        hp: hp,
        maxHp: hp,
        stats: statsObject, // Store as object
        baseStats: { ...statsObject }, // Store a copy for reference
        moveset, 
        iconUrl: memberIconUrl, 
        is_summon: is_summon,
        level: level,
        xp: 0,
        xpToNextLevel: 100,
        skill_points: skill_points,
        skill_tree: skill_tree.map(skill => ({ ...skill, unlocked: false })) // Ensure unlocked property exists
    });

    // Add click listener to show details
    li.addEventListener('click', () => showCharacterDetails(name));
}

// --- Item Removal (used for both undo and item usage) ---
function removeItemFromInventory(name, quantity) {
    const itemIndex = inventoryItems.findIndex(item => item.name.toLowerCase() === name.toLowerCase());

    if (itemIndex !== -1) {
        inventoryItems[itemIndex].quantity -= quantity;
        const itemToRemove = Array.from(itemList.children).find(li => {
            const itemNameEl = li.querySelector('.item-name');
            return itemNameEl && itemNameEl.textContent.toLowerCase() === name.toLowerCase();
        });

        if (inventoryItems[itemIndex].quantity > 0) {
            // Update UI
            if (itemToRemove) {
                const quantityEl = itemToRemove.querySelector('.item-quantity');
                quantityEl.textContent = `x${inventoryItems[itemIndex].quantity}`;
            }
        } else {
            // Remove from array and UI
            inventoryItems.splice(itemIndex, 1);
            if (itemToRemove) {
                itemList.removeChild(itemToRemove);
            }
        }
    } else {
        console.warn(`Attempted to remove item "${name}" that does not exist in inventory.`);
    }
}

// --- Undo Party Management ---
function removePartyMember(name) {
    const memberIndex = partyMembers.findIndex(member => member.name.toLowerCase() === name.toLowerCase());

    if (memberIndex !== -1) {
        const member = partyMembers[memberIndex];
        partyMembers.splice(memberIndex, 1);
        const memberToRemove = document.getElementById(member.id);
        
        if (memberToRemove) {
            partyList.removeChild(memberToRemove);
        }
    } else {
        console.warn(`Attempted to remove party member "${name}" who is not in the party.`);
    }
}

// --- Racial Skills Management ---
function updateRaceMenuUI() {
    raceSkillsList.innerHTML = '';
    raceSkillPointsDisplay.textContent = `(${player.skillPoints} points)`;
    
    if (!player.racialSkills || player.racialSkills.length === 0) {
        raceMenuContainer.classList.add('hidden');
        return;
    }
    raceMenuContainer.classList.remove('hidden');

    player.racialSkills.forEach(skill => {
        const li = document.createElement('li');
        li.classList.add('skill-item');
        if (player.level < skill.level) {
            li.classList.add('locked');
        }

        const header = document.createElement('div');
        header.classList.add('skill-header');

        const name = document.createElement('span');
        name.classList.add('skill-name');
        name.textContent = skill.name;

        const levelReq = document.createElement('span');
        levelReq.classList.add('skill-level-req');
        levelReq.textContent = skill.unlocked ? 'Learned' : `Lvl ${skill.level}`;

        header.appendChild(name);
        header.appendChild(levelReq);

        const description = document.createElement('p');
        description.classList.add('skill-description');
        description.textContent = `${skill.description} (${skill.bonus})`;

        li.appendChild(header);
        li.appendChild(description);
        
        if (!skill.unlocked && player.level >= skill.level) {
            const unlockButton = document.createElement('button');
            unlockButton.classList.add('unlock-skill-button');
            unlockButton.textContent = 'Unlock (1)';
            unlockButton.disabled = player.skillPoints < 1;
            unlockButton.addEventListener('click', () => unlockRacialSkill(skill.name));
            li.appendChild(unlockButton);
        }
        
        raceSkillsList.appendChild(li);
    });
}

function unlockRacialSkill(skillName) {
    if (player.skillPoints < 1) return;

    const skill = player.racialSkills.find(s => s.name === skillName);
    if (skill && !skill.unlocked && player.level >= skill.level) {
        player.skillPoints--;
        skill.unlocked = true;
        
        addMessage(`You have unlocked the racial trait: ${skill.name}!`, 'ai');

        updateRaceMenuUI();
        updateSkillTreeUI(); // To update skill point display
        calculateCurrentStats(); // Recalculate stats with the new bonus
    }
}

// --- Skill Tree Management ---
function updateSkillTreeUI() {
    skillTreeList.innerHTML = '';
    skillPointsDisplay.textContent = `(${player.skillPoints} points)`;
    
    if (!player.skillTree || player.skillTree.length === 0) {
        skillTreeContainer.classList.add('hidden');
        return;
    }
    skillTreeContainer.classList.remove('hidden');

    player.skillTree.forEach(skill => {
        const li = document.createElement('li');
        li.classList.add('skill-item');
        if (player.level < skill.level) {
            li.classList.add('locked');
        }

        const header = document.createElement('div');
        header.classList.add('skill-header');

        const name = document.createElement('span');
        name.classList.add('skill-name');
        name.textContent = skill.name;

        const levelReq = document.createElement('span');
        levelReq.classList.add('skill-level-req');
        levelReq.textContent = skill.unlocked ? 'Learned' : `Lvl ${skill.level}`;

        header.appendChild(name);
        header.appendChild(levelReq);

        const description = document.createElement('p');
        description.classList.add('skill-description');
        description.textContent = skill.description;

        li.appendChild(header);
        li.appendChild(description);
        
        if (!skill.unlocked && player.level >= skill.level) {
            const unlockButton = document.createElement('button');
            unlockButton.classList.add('unlock-skill-button');
            unlockButton.textContent = 'Unlock (1)';
            unlockButton.disabled = player.skillPoints < 1;
            unlockButton.addEventListener('click', () => unlockSkill(skill.name));
            li.appendChild(unlockButton);
        }
        
        skillTreeList.appendChild(li);
    });
}

function unlockSkill(skillName) {
    if (player.skillPoints < 1) return;

    const skill = player.skillTree.find(s => s.name === skillName);
    if (skill && !skill.unlocked && player.level >= skill.level) {
        player.skillPoints--;
        skill.unlocked = true;
        
        // Add the new skill to the player's active moveset
        if (selectedClass && selectedClass.moveset) {
            selectedClass.moveset += `, ${skill.name}`;
        }
        addMessage(`You have learned the skill: ${skill.name}!`, 'ai');

        updateSkillTreeUI();
        updateRaceMenuUI(); // To update skill point display
        updateAllSkillPointDisplays();
    }
}

// --- Evolution Menu Management ---

async function updateEvolutionMenuUI() {
    if (!selectedClass) {
        evolutionContainer.classList.add('hidden');
        return;
    }
    evolutionContainer.classList.remove('hidden');
    evolutionOptionsList.innerHTML = '';
    evolutionInfoText.innerHTML = '';

    if (player.evolution) {
        // Player has already evolved
        evolutionInfoText.innerHTML = `You have evolved into a <span class="evolved-class-name">${player.evolution}</span>.`;
        return;
    }

    if (player.level < EVOLUTION_LEVEL_REQ) {
        // Player is not high enough level
        evolutionInfoText.textContent = `Further paths will reveal themselves at Level ${EVOLUTION_LEVEL_REQ}.`;
        return;
    }

    // Player is eligible, generate options if they don't exist
    if (player.availableEvolutions.length === 0) {
        evolutionInfoText.textContent = 'Generating your evolutionary paths...';
        try {
            const completion = await websim.chat.completions.create({
                messages: [{
                    role: "system",
                    content: `You are a game designer. The player's current class is "${selectedClass.name}". They have reached level 10 and can now evolve. Generate 2 distinct and thematic evolution options for this class. Respond directly with a JSON object. The JSON object must have a single key "evolutions", which is an array of 2 evolution objects. Each evolution object must have three keys: "name" (string, the name of the new class), "description" (string, a short, cool description), and "bonuses" (an array of strings, each describing a specific mechanical bonus like "+5 Intelligence", "+10% Fire Damage", or "Unlocks new skill: Meteor Swarm").`
                }, {
                    role: "user",
                    content: `Generate evolutions for ${selectedClass.name}.`
                }],
                json: true,
            });
            const data = JSON.parse(cleanJSON(completion.content));
            player.availableEvolutions = data.evolutions || [];
        } catch (error) {
            console.error("Error generating evolutions:", error);
            evolutionInfoText.textContent = 'Could not generate evolution paths. Please try again later.';
            return;
        }
    }

    // Display available evolutions
    evolutionInfoText.textContent = 'Choose your path. This decision is permanent.';
    player.availableEvolutions.forEach(evo => {
        const li = document.createElement('li');
        li.classList.add('evolution-option');
        
        li.innerHTML = `
            <div class="evolution-header">
                <span class="evolution-name">${evo.name}</span>
            </div>
            <p class="evolution-description">${evo.description}</p>
            <ul class="evolution-bonuses">
                ${evo.bonuses.map(bonus => `<li>${bonus}</li>`).join('')}
            </ul>
        `;

        const evolveButton = document.createElement('button');
        evolveButton.classList.add('evolve-button');
        evolveButton.textContent = 'Evolve';
        evolveButton.onclick = () => chooseEvolution(evo);
        li.appendChild(evolveButton);
        
        evolutionOptionsList.appendChild(li);
    });
}

function chooseEvolution(evolution) {
    if (confirm(`Are you sure you want to evolve into a ${evolution.name}? This choice is permanent.`)) {
        player.evolution = evolution.name;
        
        // Apply bonuses
        const statRegex = /([+-]\d+)\s+(.+)/;
        evolution.bonuses.forEach(bonus => {
            const match = bonus.trim().match(statRegex);
            if (match) {
                const value = parseInt(match[1], 10);
                const statName = match[2].trim();
                const playerStatKey = Object.keys(player.baseStats).find(key => key.toLowerCase() === statName.toLowerCase());
                if (playerStatKey) {
                    player.baseStats[playerStatKey] += value;
                }
            } else if (bonus.toLowerCase().includes('unlocks new skill:')) {
                const skillName = bonus.split(':')[1].trim();
                selectedClass.moveset += `, ${skillName}`;
            }
        });

        addMessage(`You have evolved! You are now a ${player.evolution}!`, 'ai');
        calculateCurrentStats();
        updateEvolutionMenuUI();
    }
}

// --- Autoplay Controls ---

function autoplayStep() {
    if (!isAutoPlaying) return;

    // Use a generic prompt to continue the story
    const prompt = "Continue the story.";
    
    // Add a silent user message to history to guide the AI
    conversationHistory.push({ role: 'user', content: prompt });
    
    // Visually, we just want to see the AI response, so we don't call addMessage for the prompt.
    // The main logic is now in getAIResponse, but we pass null so no user message is shown.
    getAIResponse(null); 
}

function scheduleAutoplayNext() {
    if (!isAutoPlaying) return;
    if (ttsEnabled) {
        waitForTTSComplete().then(() => { if (isAutoPlaying) autoplayStep(); });
    } else {
        clearTimeout(autoplayTimeout);
        autoplayTimeout = setTimeout(autoplayStep, 3000);
    }
}

function waitForTTSComplete() {
    return new Promise(resolve => {
        const check = () => {
            if (!ttsEnabled || (!isSpeaking && ttsQueue.length === 0)) return resolve();
            setTimeout(check, 300);
        };
        check();
    });
}

function toggleAutoplay() {
    isAutoPlaying = !isAutoPlaying;
    const submitButton = form.querySelector('button');

    if (isAutoPlaying) {
        autoplayButton.innerHTML = `<i class="fas fa-pause"></i>`;
        autoplayButton.title = "Pause story";
        input.disabled = true;
        submitButton.disabled = true;
        autoplayStep(); // Start the loop
    } else {
        clearTimeout(autoplayTimeout);
        autoplayButton.innerHTML = `<i class="fas fa-play"></i>`;
        autoplayButton.title = "Auto-play story";
        input.disabled = false;
        submitButton.disabled = false;
        // If typing indicator was left on, hide it
        typingIndicator.classList.add('hidden');
    }
}

autoplayButton.addEventListener('click', toggleAutoplay);

// --- Music Controls ---
function toggleMusic() {
    if (backgroundMusic.paused) {
        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                musicStarted = true;
                musicButton.innerHTML = `<i class="fas fa-volume-up"></i>`;
            }).catch(error => console.error("Could not play music:", error));
        }
    } else {
        backgroundMusic.pause();
        musicButton.innerHTML = `<i class="fas fa-volume-mute"></i>`;
    }
}

musicButton.addEventListener('click', toggleMusic);

// --- Game State Controls ---

// New: Character photo upload
characterPhotoInput?.addEventListener('change', () => {
    const file = characterPhotoInput.files?.[0];
    characterPhotoFilename.textContent = file ? file.name : 'No file chosen';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
        characterPhotoDataUrl = reader.result;
        characterPhotoPreview.src = characterPhotoDataUrl;
        characterPhotoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

// New Game button (in-game)
newGameButton.addEventListener('click', () => {
    confirmModal.classList.add('active');
});

confirmNoBtn.addEventListener('click', () => confirmModal.classList.remove('active'));
confirmCloseBtn.addEventListener('click', () => confirmModal.classList.remove('active'));

confirmYesBtn.addEventListener('click', () => {
    console.error('⚠️⚠️⚠️ CONFIRM YES BUTTON CLICKED - About to reset game!');
    console.error('⚠️ Stack trace:', new Error().stack);
    confirmModal.classList.remove('active');
    startNewGameReset();
});

// Save Button - Downloads a file
saveButton.addEventListener('click', () => {
    const gameState = {
        conversation: conversationHistory,
        partyMembers: partyMembers.map(member => ({
            ...member,
            // Ensure stats are saved, not the original string
            stats: member.stats, 
            baseStats: member.baseStats
        })),
        inventoryItems: inventoryItems, // Save inventory items state
        weapons: weapons, // New: save weapons state
        armors: armors,
        rings: rings,
        equipment: equipment,
        player: { ...player, stats: player.stats, baseStats: player.baseStats, racialSkills: player.racialSkills, evolution: player.evolution, availableEvolutions: player.availableEvolutions, upgradePoints: player.upgradePoints }, // Save evolution state and upgrade points
        activeEncounters: activeEncounters // New: save encounters state
    };
    const dataStr = JSON.stringify(gameState, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `rpg-save-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Simple feedback
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = `<i class="fas fa-check"></i> Saved!`;
    saveButton.disabled = true;
    setTimeout(() => {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
        updateControlButtons();
    }, 1500);
});

// Undo Button - Removes last user/AI exchange from history and UI
undoButton.addEventListener('click', () => {
    console.log('🔄 Undo button clicked');

    // Check if we can undo (need at least 2 messages: user + assistant)
    if (conversationHistory.length < 2) {
        console.warn('❌ Not enough messages to undo');
        return;
    }

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const secondLastMessage = conversationHistory[conversationHistory.length - 2];

    // Only undo if last two messages are assistant then user (in that order from oldest to newest)
    if (lastMessage.role !== 'assistant' || secondLastMessage.role !== 'user') {
        console.warn('❌ Cannot undo: Last messages are not user->assistant pair');
        return;
    }

    console.log('✅ Undoing last exchange...');

    // Remove last 2 messages from history (user message + AI response)
    conversationHistory.pop(); // Remove AI response
    conversationHistory.pop(); // Remove user message

    // Remove last 2 messages from UI
    const messages = messagesContainer.querySelectorAll('.message');
    if (messages.length >= 2) {
        messages[messages.length - 1].remove(); // Remove AI message
        messages[messages.length - 2].remove(); // Remove user message
    }

    // Update control buttons state
    updateControlButtons();

    // Visual feedback
    const originalText = undoButton.innerHTML;
    undoButton.innerHTML = `<i class="fas fa-check"></i>`;
    undoButton.disabled = true;
    setTimeout(() => {
        undoButton.innerHTML = originalText;
        updateControlButtons(); // Re-enable if still possible to undo
    }, 1000);

    console.log('✅ Undo complete. Messages remaining:', conversationHistory.length);
});

// Load Button (in-game) - Opens file picker
loadButton.addEventListener('click', () => {
    fileLoader.click();
});

// Load Game Button (from start menu)
loadGameMenuButton.addEventListener('click', () => {
    fileLoader.click();
});

// Start Game Button (from start menu)
startGameButton.addEventListener('click', async () => {
    playSound(pixelClickBuffer); // Play sound on click
    const universe = universeInput.value.trim();
    if (!universe) {
        alert("Please enter a universe or crossover theme to start your adventure!");
        return;
    }

    if (!selectedClass) {
        alert("Please select or generate a class before starting!");
        return;
    }

    if (!selectedRace) {
        alert("Please select or generate a race before starting!");
        return;
    }

    // Hide start menu, show game container
    startScreenContainer.style.display = 'none';
    appContainer.style.display = 'flex';

    // Start background music with lower volume
    if (!musicStarted) {
        // Set initial music track for medieval genre (default)
        currentGenre = 'medieval';
        backgroundMusic.src = getRandomTrackFromGenre('medieval');
        backgroundMusic.volume = 0.15; // Lower volume (was 0.3)
        backgroundMusic.load();

        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                musicStarted = true;
                musicButton.innerHTML = `<i class="fas fa-volume-up"></i>`;
            }).catch(error => {
                console.error("Could not play music on start game:", error);
            });
        }
    }

    // Clear previous chat messages
    messagesContainer.innerHTML = '';
    // Clear inventory and party as it's a new game
    conversationHistory = []; // Reset conversation history for new game
    inventoryItems = [];
    partyMembers = [];
    weapons = []; // New: clear weapons
    armors = [];
    rings = [];
    equipment = { weapon: null, armor: null, ring1: null, ring2: null };
    activeEncounters = []; // New: clear encounters
    player = { 
        hp: 100, 
        maxHp: 100, 
        statusEffects: [], 
        level: 1, 
        xp: 0, 
        xpToNextLevel: 100, 
        skillPoints: 1, 
        upgradePoints: 0,
        stats: {}, 
        baseStats: {}, 
        skillTree: [], 
        racialSkills: [],
        evolution: null,
        availableEvolutions: [],
    }; // Reset player
    
    // Parse stats string from the selected race into an object
    if (selectedRace.stats) {
        selectedRace.stats.split(',').forEach(stat => {
            const [key, value] = stat.split(':');
            if (key && value) {
                player.baseStats[key.trim()] = parseInt(value.trim(), 10);
            }
        });
    }

    // Set skill tree and racial skills from selection
    player.skillTree = selectedClass.skill_tree;
    player.racialSkills = selectedRace.racial_skills;

    itemList.innerHTML = '';
    partyList.innerHTML = '';
    weaponList.innerHTML = ''; // New: clear weapon UI
    armorList.innerHTML = '';
    ringList.innerHTML = '';
    encounterList.innerHTML = ''; // New: clear encounter UI
    playerStatusEffectsContainer.innerHTML = '';
    updateEquipmentUI();
    calculateCurrentStats(); // New: calculate initial stats
    updatePlayerXPBar(); // New
    updateSkillTreeUI(); // New
    updateRaceMenuUI(); // New
    updateEvolutionMenuUI(); // New

    // Initialize the game with the chosen universe and class as the first user prompt
    const initialPrompt = `Start a new adventure in a ${universe} setting. I am a ${selectedRace.name} ${selectedClass.name}. My racial traits are: "${selectedRace.traits_description}". My base stats are ${selectedRace.stats} and my starting moveset is ${selectedClass.moveset}.`;
    showLoaderForNextImage = true; // Show loader for the very first scene image only
    await getAIResponse(initialPrompt);
});


// File Loader - Handles the selected file
fileLoader.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const savedStateJSON = e.target.result;
            const savedState = JSON.parse(savedStateJSON);
            
            if (!savedState.conversation) {
                throw new Error("Invalid save file format.");
            }

            conversationHistory = savedState.conversation || [];
            partyMembers = savedState.partyMembers || []; // Load party members
            inventoryItems = savedState.inventoryItems || []; // Load inventory items
            weapons = savedState.weapons || []; // New: load weapons
            armors = savedState.armors || [];
            rings = savedState.rings || [];
            equipment = savedState.equipment || { weapon: null, armor: null, ring1: null, ring2: null };
            player = savedState.player || { 
                hp: 100, 
                maxHp: 100, 
                statusEffects: [], 
                level: 1, 
                xp: 0, 
                xpToNextLevel: 100, 
                skillPoints: 1, 
                upgradePoints: 0,
                stats: {}, 
                baseStats: {}, 
                skillTree: [], 
                racialSkills: [],
                evolution: null,
                availableEvolutions: [],
            }; // Load player state
            // Ensure baseStats exists for older saves
            if (!player.baseStats) {
                player.baseStats = { ...player.stats }; // Fallback for old save files
            }
            // Ensure upgradePoints exists for older saves
            if (player.upgradePoints === undefined) {
                player.upgradePoints = 0;
            }
            // Compatibility for old saves where party member stats were strings
            partyMembers = partyMembers.map(member => {
                if(typeof member.stats === 'string') {
                    const statsObject = parseStatsString(member.stats);
                    return { ...member, stats: statsObject, baseStats: { ...statsObject } };
                }
                return member;
            });

            selectedClass = savedState.player.class || null; // This might not exist in old saves, which is fine
            selectedRace = savedState.player.race || null; // Load race, will be null in old saves
            activeEncounters = savedState.activeEncounters || []; // Load encounters
            
            // Clear existing UI elements before repopulating
            messagesContainer.innerHTML = '';
            partyList.innerHTML = '';
            itemList.innerHTML = '';
            weaponList.innerHTML = ''; // New: clear weapon UI
            armorList.innerHTML = '';
            ringList.innerHTML = '';
            encounterList.innerHTML = ''; // New: clear encounter UI
            playerStatusEffectsContainer.innerHTML = '';
            updateEquipmentUI();
            calculateCurrentStats(); // Recalculate stats based on loaded equipment
            updatePlayerXPBar(); // New
            updateSkillTreeUI(); // New
            updateRaceMenuUI(); // New
            updateEvolutionMenuUI(); // New

            // Repopulate chat messages (narrative only from AI responses for display)
            // No need to regenerate images for every past message, just the latest relevant one.
            let lastImagePrompt = null;
            let lastLocationType = null;

            conversationHistory.forEach(message => {
                if (message.role === 'user') {
                    addMessage(message.content, 'user');
                } else if (message.role === 'assistant') {
                    try {
                        const parsedData = JSON.parse(message.content);
                        addMessage(parsedData.narrative, 'ai');
                        if (parsedData.image_prompt) {
                            lastImagePrompt = parsedData.image_prompt;
                        }
                        if (parsedData.location_type) {
                            lastLocationType = parsedData.location_type;
                        }
                    } catch (e) {
                        addMessage(message.content, 'ai'); // Fallback for old formats or non-JSON content
                    }
                }
            });
            
            // Re-generate the image for the last known location
            if (lastImagePrompt) {
                await generateLocationImage(lastImagePrompt);
            }

            // Re-apply the last known music
            if (lastLocationType) {
                await changeBackgroundMusic(lastLocationType);
                if (!backgroundMusic.paused && !musicStarted) { // If music was playing in save and not started yet
                    musicStarted = true;
                    musicButton.innerHTML = `<i class="fas fa-volume-up"></i>`;
                } else if (backgroundMusic.paused && musicStarted) { // If music was paused in save but thought to be playing
                    musicStarted = false;
                    musicButton.innerHTML = `<i class="fas fa-volume-mute"></i>`;
                }
            } else if (!musicStarted) { // If no specific location music, default to tavern if not started
                await changeBackgroundMusic('tavern');
                musicStarted = true;
                musicButton.innerHTML = `<i class="fas fa-volume-up"></i>`;
            }

            // Repopulate Player Status
            updatePlayerHP(player.hp);
            updatePlayerXPBar(); // New
            calculateCurrentStats(); // Recalculate stats to ensure UI is correct
            for (const effect of player.statusEffects) {
                addStatusEffect(player, playerStatusEffectsContainer, effect);
            }
            
            // Repopulate Equipment UI
            updateEquipmentUI();

            // Repopulate Skill Tree UI
            updateSkillTreeUI(); // New
            updateRaceMenuUI(); // New
            updateEvolutionMenuUI(); // New

            // Repopulate party members (ensures click listeners are attached)
            for (const member of partyMembers) {
                const li = document.createElement('li');
                li.classList.add('party-member');
                li.id = member.id;

                const img = document.createElement('img');
                img.alt = member.name;
                img.src = member.iconUrl; // Use stored URL
                img.onerror = () => img.src = "https://img.icons8.com/dotty/80/000000/monster-face.png"; // Fallback

                const memberInfo = document.createElement('div');
                memberInfo.classList.add('member-info');
                const memberName = document.createElement('span');
                memberName.classList.add('member-name');
                memberName.textContent = member.name;
                const memberStatus = document.createElement('span');
                memberStatus.classList.add('member-status', 'online');
                memberStatus.textContent = member.description;

                // Add HP bar for loaded party member
                if (member.hp !== undefined && member.maxHp !== undefined) {
                    const hpBarContainer = document.createElement('div');
                    hpBarContainer.classList.add('hp-bar-container');
                    const hpBarFill = document.createElement('div');
                    hpBarFill.classList.add('hp-bar-fill', 'ally');
                    const hpBarText = document.createElement('span');
                    hpBarText.classList.add('hp-bar-text');
                    
                    const percentage = (member.hp / member.maxHp) * 100;
                    hpBarFill.style.width = `${percentage}%`;
                    hpBarText.textContent = `${member.hp} / ${member.maxHp}`;

                    hpBarContainer.appendChild(hpBarFill);
                    hpBarContainer.appendChild(hpBarText);
                    memberInfo.appendChild(hpBarContainer);
                }

                memberInfo.appendChild(memberName);
                memberInfo.appendChild(memberStatus);

                li.appendChild(img);
                li.appendChild(memberInfo);
                partyList.appendChild(li);

                // Re-attach event listener with stored data
                li.addEventListener('click', () => showCharacterDetails(member.name));
            }

            // Repopulate encounters
            for (const encounter of activeEncounters) {
                 const li = document.createElement('li');
                li.classList.add('encounter');
                li.id = `encounter-${encounter.id}`;

                const img = document.createElement('img');
                img.alt = encounter.name;
                img.src = encounter.iconUrl;

                try {
                    const result = await websim.imageGen({
                        prompt: `${encounter.icon_prompt}, ${getStyleTag('icon')}, simple, white background`,
                        aspect_ratio: "1:1"
                    });
                    encounter.iconUrl = result.url;
                    img.src = result.url;
                } catch (error) {
                    console.error(`Error generating icon for encounter ${encounter.name}:`, error);
                }

                const encounterDetails = document.createElement('div');
                encounterDetails.style.flexGrow = '1';

                const encounterName = document.createElement('span');
                encounterName.classList.add('encounter-name');
                encounterName.textContent = encounter.name;

                const hpBarContainer = document.createElement('div');
                hpBarContainer.classList.add('hp-bar-container');

                const hpBarFill = document.createElement('div');
                hpBarFill.classList.add('hp-bar-fill', 'enemy');
                hpBarFill.style.width = '100%';

                const hpBarText = document.createElement('span');
                hpBarText.classList.add('hp-bar-text');
                hpBarText.textContent = `${encounter.hp} / ${encounter.maxHp}`;

                hpBarContainer.appendChild(hpBarFill);
                hpBarContainer.appendChild(hpBarText);

                const statusEffectsContainer = document.createElement('div');
                statusEffectsContainer.classList.add('status-effects-container');

                encounterDetails.appendChild(encounterName);
                encounterDetails.appendChild(hpBarContainer);

                li.appendChild(img);
                li.appendChild(encounterDetails);
                li.appendChild(statusEffectsContainer);
                encounterList.appendChild(li);
            }

            // Repopulate weapons (unequipped)
            for (const weapon of weapons) {
                const li = document.createElement('li');
                li.classList.add('weapon');
                li.id = weapon.id;

                // Click to view details, double-click to equip
                li.addEventListener('click', () => showDetailsModal({
                    name: weapon.name,
                    description: weapon.description,
                    iconUrl: weapon.iconUrl,
                    type: "Weapon",
                    info: { header: 'Stats', value: weapon.stats }
                }));
                li.addEventListener('dblclick', () => {
                    equipItem(weapon.id, 'weapon');
                    hideDetailsModal();
                });
                const img = document.createElement('img');
                img.alt = weapon.name;
                img.src = weapon.iconUrl;
                img.onerror = () => img.src = "https://img.icons8.com/dotty/80/000000/sword.png"; // Fallback

                const weaponInfo = document.createElement('div');
                weaponInfo.classList.add('weapon-info');
                const weaponName = document.createElement('span');
                weaponName.classList.add('weapon-name');
                weaponName.textContent = weapon.name;
                const weaponStats = document.createElement('span');
                weaponStats.classList.add('weapon-stats');
                weaponStats.textContent = weapon.stats;

                weaponInfo.appendChild(weaponName);
                weaponInfo.appendChild(weaponStats);
                li.appendChild(img);
                li.appendChild(weaponInfo);
                weaponList.appendChild(li);
            }
            
            // Repopulate armor (unequipped)
            for (const armor of armors) {
                const li = document.createElement('li');
                li.classList.add('armor');
                li.id = armor.id;
                li.addEventListener('click', () => equipItem(armor.id, 'armor'));
                li.addEventListener('click', () => showDetailsModal({
                    name: armor.name,
                    description: armor.description,
                    iconUrl: armor.iconUrl,
                    type: "Armor",
                    info: { header: 'Stats', value: armor.stats }
                }));
                const img = document.createElement('img');
                img.alt = armor.name;
                img.src = armor.iconUrl;
                img.onerror = () => img.src = "https://img.icons8.com/dotty/80/000000/body-armor.png";

                const armorInfo = document.createElement('div');
                armorInfo.classList.add('armor-info');
                const armorName = document.createElement('span');
                armorName.classList.add('armor-name');
                armorName.textContent = armor.name;
                const armorStats = document.createElement('span');
                armorStats.classList.add('armor-stats');
                armorStats.textContent = armor.stats;

                armorInfo.appendChild(armorName);
                armorInfo.appendChild(armorStats);
                li.appendChild(img);
                li.appendChild(armorInfo);
                armorList.appendChild(li);
            }

            // Repopulate rings (unequipped)
            for (const ring of rings) {
                const li = document.createElement('li');
                li.classList.add('ring');
                li.id = ring.id;
                li.addEventListener('click', () => equipItem(ring.id, 'ring'));
                li.addEventListener('click', () => showDetailsModal({
                    name: ring.name,
                    description: ring.description,
                    iconUrl: ring.iconUrl,
                    type: "Ring",
                    info: { header: 'Stats', value: ring.stats }
                }));
                const img = document.createElement('img');
                img.alt = ring.name;
                img.src = ring.iconUrl;
                img.onerror = () => img.src = "https://img.icons8.com/dotty/80/000000/ring.png";

                const ringInfo = document.createElement('div');
                ringInfo.classList.add('ring-info');
                const ringName = document.createElement('span');
                ringName.classList.add('ring-name');
                ringName.textContent = ring.name;
                const ringStats = document.createElement('span');
                ringStats.classList.add('ring-stats');
                ringStats.textContent = ring.stats;

                ringInfo.appendChild(ringName);
                ringInfo.appendChild(ringStats);
                li.appendChild(img);
                li.appendChild(ringInfo);
                ringList.appendChild(li);
            }

            // Repopulate items
            for (const item of inventoryItems) {
                const li = document.createElement('li');
                li.classList.add('item');
                li.addEventListener('click', () => showDetailsModal({
                    name: item.name,
                    description: item.description,
                    iconUrl: item.iconUrl,
                    type: "Item",
                    info: { header: 'Quantity', value: item.quantity }
                }));
                const img = document.createElement('img');
                img.alt = item.name;
                img.src = item.iconUrl; // Use stored URL
                img.onerror = () => img.src = "https://img.icons8.com/dotty/80/000000/box-important.png"; // Fallback

                const itemInfo = document.createElement('div');
                itemInfo.classList.add('item-info');
                const itemName = document.createElement('span');
                itemName.classList.add('item-name');
                itemName.textContent = item.name;
                const itemQuantity = document.createElement('span');
                itemQuantity.classList.add('item-quantity');
                itemQuantity.textContent = `x${item.quantity}`;

                itemInfo.appendChild(itemName);
                itemInfo.appendChild(itemQuantity);
                li.appendChild(img);
                li.appendChild(itemInfo);
                itemList.appendChild(li);
            }

            // Hide start menu, show game container
            startScreenContainer.style.display = 'none';
            appContainer.style.display = 'flex';

            updateControlButtons();
            scrollToBottom();
            
        } catch (error) {
            console.error("Failed to load or parse save file:", error);
            alert("Could not load save file. It might be corrupted or in the wrong format.");
            // If load fails, return to start menu
            appContainer.style.display = 'none';
            startScreenContainer.style.display = 'flex';
        } finally {
             // Reset the input value to allow loading the same file again
            event.target.value = null;
        }
    };
    reader.onerror = () => {
        alert("Error reading the file.");
        event.target.value = null;
    };
    reader.readAsText(file);
});

// --- Character Details Modal Functions ---
function showCharacterDetails(name) {
    const member = partyMembers.find(m => m.name === name);
    if (!member) return;

    modalCharacterName.textContent = member.name;
    modalCharacterDescription.textContent = member.full_description;
    const statsText = `HP: ${member.hp}/${member.maxHp}, ${formatStatsObject(member.stats)}`;
    modalCharacterStats.textContent = statsText; // Format stats object for display
    modalCharacterMoveset.textContent = member.moveset;
    modalCharacterIcon.src = member.iconUrl;
    modalCharacterIcon.onerror = () => modalCharacterIcon.src = "https://img.icons8.com/ios-glyphs/90/ffffff/user-male-circle.png";

    // Show or hide upgrade button based on if they are a summon
    if (member.is_summon) {
        modalUpgradeButton.style.display = 'none';
    } else {
        modalUpgradeButton.style.display = 'flex';
        // Remove previous listener and add a new one for the current character
        modalUpgradeButton.replaceWith(modalUpgradeButton.cloneNode(true));
        document.getElementById('modal-upgrade-button').addEventListener('click', () => {
            hideCharacterDetails(); // Hide current modal
            showPartyMovesModal(member.name); // Show upgrade modal
        });
    }

    characterModal.classList.add('active');
}

function hideCharacterDetails() {
    characterModal.classList.remove('active'); // Hide modal
}

// --- Party Upgrade Modal Functions ---
function showPartyMovesModal(memberName) {
    const member = partyMembers.find(m => m.name === memberName);
    if (!member) return;

    partyUpgradeModal.dataset.memberName = memberName; // Store name for reference

    modalUpgradeCharacterName.textContent = member.name;
    modalUpgradeCharacterIcon.src = member.iconUrl;

    // Update both skill point displays
    const skillPointText = `(${member.skill_points} points available)`;
    partyUpgradeSkillPointsDisplayStats.textContent = skillPointText;
    partyUpgradeSkillPointsDisplayMoves.textContent = skillPointText;

    // --- Populate Stats ---
    partyUpgradeStatsList.innerHTML = '';
    if (member.stats) {
        for (const [stat, value] of Object.entries(member.stats)) {
            const li = document.createElement('li');
            li.classList.add('upgrade-stat-item');

            li.innerHTML = `
                <div>
                    <span class="upgrade-stat-name">${stat}</span>: 
                    <span class="upgrade-stat-value">${value}</span>
                </div>
            `;

            const upgradeButton = document.createElement('button');
            upgradeButton.classList.add('upgrade-stat-button');
            upgradeButton.innerHTML = '<i class="fas fa-plus"></i>';
            upgradeButton.disabled = member.skill_points < 1;
            upgradeButton.addEventListener('click', () => upgradePartyMemberStat(memberName, stat));

            li.appendChild(upgradeButton);
            partyUpgradeStatsList.appendChild(li);
        }
    }


    // --- Populate Moves ---
    partyUpgradeMovesList.innerHTML = '';
    if (member.skill_tree) {
        member.skill_tree.forEach(skill => {
            const li = document.createElement('li');
            li.classList.add('skill-item'); // Reuse player skill tree style
            if (member.level < skill.level) {
                li.classList.add('locked');
            }

            const header = document.createElement('div');
            header.classList.add('skill-header');
            const name = document.createElement('span');
            name.classList.add('skill-name');
            name.textContent = skill.name;
            const levelReq = document.createElement('span');
            levelReq.classList.add('skill-level-req');
            levelReq.textContent = skill.unlocked ? 'Learned' : `Lvl ${skill.level}`;
            header.appendChild(name);
            header.appendChild(levelReq);

            const description = document.createElement('p');
            description.classList.add('skill-description');
            description.textContent = skill.description;
            
            li.appendChild(header);
            li.appendChild(description);

            if (!skill.unlocked && member.level >= skill.level) {
                const unlockButton = document.createElement('button');
                unlockButton.classList.add('unlock-skill-button');
                unlockButton.textContent = 'Unlock (1)';
                unlockButton.disabled = member.skill_points < 1;
                unlockButton.addEventListener('click', () => unlockPartyMemberSkill(memberName, skill.name));
                li.appendChild(unlockButton);
            }

            partyUpgradeMovesList.appendChild(li);
        });
    }

    partyUpgradeModal.classList.add('active');
}

function hidePartyUpgradeModal() {
    partyUpgradeModal.classList.remove('active');
    partyUpgradeModal.removeAttribute('data-member-name'); // Clean up
}

function upgradePartyMemberStat(memberName, statName) {
    const member = partyMembers.find(m => m.name === memberName);
    if (!member || member.skill_points < 1) return;

    member.skill_points--;
    // Upgrade base stat, which will reflect in current stats
    if (member.baseStats && member.baseStats[statName] !== undefined) {
        member.baseStats[statName]++;
    }
    if (member.stats && member.stats[statName] !== undefined) {
        member.stats[statName]++;
    }

    // Refresh the modal to show updated points and stats
    showPartyMovesModal(memberName);
}

function unlockPartyMemberSkill(memberName, skillName) {
    const member = partyMembers.find(m => m.name === memberName);
    if (!member || member.skill_points < 1) return;

    const skill = member.skill_tree.find(s => s.name === skillName);
    if (skill && !skill.unlocked && member.level >= skill.level) {
        member.skill_points--;
        skill.unlocked = true;
        
        member.moveset += `, ${skill.name}`;
        addMessage(`${member.name} has learned the skill: ${skill.name}!`, 'ai');
        
        // Refresh the modal to show updated points and skill status
        showPartyMovesModal(memberName);
    }
}

// New: Details Modal Functions
function showDetailsModal(data) {
    modalDetailsName.textContent = data.name;
    modalDetailsType.textContent = data.type;
    modalDetailsDescription.textContent = data.description || "A mysterious object with no discernible description.";
    modalDetailsIcon.src = data.iconUrl;
    modalDetailsIcon.onerror = () => modalDetailsIcon.src = "https://img.icons8.com/dotty/80/000000/box-important.png"; // Fallback

    if (data.info && data.info.value) {
        modalDetailsInfoContainer.style.display = 'block';
        modalDetailsInfoHeader.textContent = data.info.header;
        modalDetailsInfo.textContent = data.info.value;
    } else {
        modalDetailsInfoContainer.style.display = 'none';
    }

    detailsModal.classList.add('active');
}

function hideDetailsModal() {
    detailsModal.classList.remove('active');
}

window.addEventListener('click', (event) => {
    if (event.target === characterModal) {
        hideCharacterDetails();
    }
    if (event.target === detailsModal) {
        hideDetailsModal();
    }
    if (event.target === partyUpgradeModal) {
        hidePartyUpgradeModal();
    }
});
closeDetailsModalButton.addEventListener('click', hideDetailsModal);
closePartyUpgradeModalButton.addEventListener('click', hidePartyUpgradeModal);

// --- New: Message Context Menu Functions ---

function handleEditMessage() {
    if (!activeContextMenuMessage || activeContextMenuMessageIndex === -1) return;

    const messageDiv = activeContextMenuMessage;
    const historyIndex = activeContextMenuMessageIndex;
    const currentText = messageDiv.textContent;
    messageDiv.dataset.originalText = messageDiv.innerHTML; // Store original state

    messageDiv.innerHTML = ''; // Clear the div

    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.style.width = '100%';
    textarea.style.height = `${messageDiv.scrollHeight + 20}px`;
    textarea.style.fontFamily = 'inherit';
    textarea.style.fontSize = 'inherit';
    textarea.style.backgroundColor = 'var(--user-message-bg)';
    textarea.style.color = 'var(--text-light)';
    textarea.style.border = '1px solid var(--primary-color)';
    textarea.style.borderRadius = '4px';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.marginTop = '5px';
    saveButton.style.alignSelf = 'flex-end';
    saveButton.classList.add('control-button'); // Reuse existing style
    saveButton.style.padding = '4px 8px';
    saveButton.style.fontSize = '0.8em';

    saveButton.onclick = () => {
        const newText = textarea.value;
        messageDiv.textContent = newText; // Update UI

        // Update conversation history
        try {
            const historyEntry = JSON.parse(conversationHistory[historyIndex].content);
            historyEntry.narrative = newText;
            conversationHistory[historyIndex].content = JSON.stringify(historyEntry);
        } catch(e) {
            console.error("Could not parse history entry to update. Saving as plain text.");
            conversationHistory[historyIndex].content = newText;
        }
    };

    messageDiv.style.display = 'flex';
    messageDiv.style.flexDirection = 'column';
    messageDiv.appendChild(textarea);
    messageDiv.appendChild(saveButton);
    textarea.focus();

    // Hide the context menu
    messageContextMenu.classList.add('hidden');
}

async function handleRegenerateMessage() {
    if (activeContextMenuMessageIndex < 1) return;

    console.log('🔄 Regenerate button clicked, activeContextMenuMessageIndex:', activeContextMenuMessageIndex);

    // The user prompt is the one right before the AI message
    const userPromptIndex = activeContextMenuMessageIndex - 1;
    const userPromptMessage = conversationHistory[userPromptIndex];

    console.log('🔄 User prompt to regenerate:', userPromptMessage.content.substring(0, 100));

    // Remove the old user prompt and AI response from the history for regeneration
    const previousHistory = conversationHistory.slice(0, userPromptIndex);
    // Remove the old AI message and its user prompt from the DOM
    const messagesToRemove = Array.from(messagesContainer.querySelectorAll(`[data-history-index]`)).filter(el => parseInt(el.dataset.historyIndex, 10) >= userPromptIndex);
    messagesToRemove.forEach(el => el.remove());
    if (activeContextMenuMessage.previousElementSibling && activeContextMenuMessage.previousElementSibling.classList.contains('user-message')) {
        activeContextMenuMessage.previousElementSibling.remove();
    }
    activeContextMenuMessage.remove();

    // Restore the history and re-send the prompt
    conversationHistory = previousHistory;

    console.log('🔄 Calling AI to regenerate response...');

    // Check if it's a combat move that needs a dice roll
    const lowerCaseContent = userPromptMessage.content.toLowerCase();
    const isAttack = activeEncounters.length > 0 && (lowerCaseContent.includes('attack') || lowerCaseContent.includes('use my'));
    if(isAttack){
        await executeWithDiceRoll(userPromptMessage.content);
    } else {
        await getAIResponse(userPromptMessage.content);
    }

    console.log('🔄 Regeneration complete!');

    // Hide the context menu
    messageContextMenu.classList.add('hidden');
}

editMessageButton.addEventListener('click', handleEditMessage);
regenerateMessageButton.addEventListener('click', handleRegenerateMessage);

// --- Equipment Management ---

function updateEquipmentUI() {
    equipmentList.innerHTML = '';
    const slots = [
        { type: 'weapon', label: 'Weapon', item: equipment.weapon, slotName: 'weapon' },
        { type: 'armor', label: 'Armor', item: equipment.armor, slotName: 'armor' },
        { type: 'ring', label: 'Ring 1', item: equipment.ring1, slotName: 'ring1' },
        { type: 'ring', label: 'Ring 2', item: equipment.ring2, slotName: 'ring2' }
    ];

    slots.forEach(slot => {
        const li = document.createElement('li');
        li.classList.add('equip-slot');
        if (slot.item) {
            li.classList.add('clickable');
            li.addEventListener('click', () => unequipItem(slot.slotName));
        }

        const label = document.createElement('span');
        label.classList.add('equip-slot-label');
        label.textContent = slot.label;
        li.appendChild(label);

        const content = document.createElement('div');
        content.classList.add('equip-slot-content');

        if (slot.item) {
            const img = document.createElement('img');
            img.src = slot.item.iconUrl || '';
            img.alt = slot.item.name;
            content.appendChild(img);

            const info = document.createElement('div');
            info.classList.add('equip-slot-info');
            
            const name = document.createElement('span');
            name.classList.add('equip-slot-name');
            name.textContent = slot.item.name;
            info.appendChild(name);

            const stats = document.createElement('span');
            stats.classList.add('equip-slot-stats');
            stats.textContent = slot.item.stats;
            info.appendChild(stats);

            content.appendChild(info);
        } else {
            content.classList.add('empty');
            content.textContent = '— Empty —';
        }

        li.appendChild(content);
        equipmentList.appendChild(li);
    });
}

function equipItem(itemId, itemType) {
    let itemToEquip;
    let itemIndex;
    let inventoryArray;
    let inventoryListElement;

    if (itemType === 'weapon') {
        inventoryArray = weapons;
        inventoryListElement = weaponList;
    } else if (itemType === 'armor') {
        inventoryArray = armors;
        inventoryListElement = armorList;
    } else if (itemType === 'ring') {
        inventoryArray = rings;
        inventoryListElement = ringList;
    }

    itemIndex = inventoryArray.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    itemToEquip = inventoryArray[itemIndex];

    if (itemType === 'weapon') {
        if (equipment.weapon) unequipItem('weapon');
        equipment.weapon = itemToEquip;
    } else if (itemType === 'armor') {
        if (equipment.armor) unequipItem('armor');
        equipment.armor = itemToEquip;
    } else if (itemType === 'ring') {
        if (!equipment.ring1) {
            equipment.ring1 = itemToEquip;
        } else if (!equipment.ring2) {
            equipment.ring2 = itemToEquip;
        } else {
            unequipItem('ring1'); // Unequip first ring to make space
            equipment.ring1 = itemToEquip;
        }
    }

    inventoryArray.splice(itemIndex, 1);
    const itemElement = document.getElementById(itemId);
    if (itemElement) inventoryListElement.removeChild(itemElement);

    updateEquipmentUI();
    calculateCurrentStats(); // Recalculate stats after equipping
}

function unequipItem(slotName) {
    let itemToUnequip;
    if (slotName.startsWith('ring')) {
        itemToUnequip = equipment[slotName];
        if (!itemToUnequip) return;
        addRing(itemToUnequip.name, itemToUnequip.stats, itemToUnequip.description, itemToUnequip.iconPrompt);
    } else if (slotName === 'weapon') {
        itemToUnequip = equipment.weapon;
        if (!itemToUnequip) return;
        addWeapon(itemToUnequip.name, itemToUnequip.stats, itemToUnequip.description, itemToUnequip.iconPrompt);
    } else if (slotName === 'armor') {
        itemToUnequip = equipment.armor;
        if (!itemToUnequip) return;
        addArmor(itemToUnequip.name, itemToUnequip.stats, itemToUnequip.description, itemToUnequip.iconPrompt);
    }
    
    equipment[slotName] = null;
    updateEquipmentUI();
    calculateCurrentStats(); // Recalculate stats after unequipping
}

async function addEncounter(name, hp, iconPrompt) {
    const uniqueId = `${name.replace(/\s+/g, '-')}-${Date.now()}`;
    const newEncounter = {
        id: uniqueId,
        name,
        hp,
        maxHp: hp,
        statusEffects: [],
        iconUrl: "https://img.icons8.com/dotty/80/000000/monster-face.png" // Fallback
    };
    activeEncounters.push(newEncounter);

    const li = document.createElement('li');
    li.classList.add('encounter');
    li.id = `encounter-${uniqueId}`;

    const img = document.createElement('img');
    img.alt = name;
    img.src = newEncounter.iconUrl;

    try {
        const result = await websim.imageGen({
            prompt: `${iconPrompt}, ${getStyleTag('icon')}, simple, white background`,
            transparent: true,
            aspect_ratio: "1:1"
        });
        newEncounter.iconUrl = result.url;
        img.src = result.url;
    } catch (error) {
        console.error(`Error generating icon for encounter ${name}:`, error);
    }

    const encounterDetails = document.createElement('div');
    encounterDetails.style.flexGrow = '1';

    const encounterName = document.createElement('span');
    encounterName.classList.add('encounter-name');
    encounterName.textContent = name;

    const hpBarContainer = document.createElement('div');
    hpBarContainer.classList.add('hp-bar-container');

    const hpBarFill = document.createElement('div');
    hpBarFill.classList.add('hp-bar-fill', 'enemy');
    hpBarFill.style.width = '100%';

    const hpBarText = document.createElement('span');
    hpBarText.classList.add('hp-bar-text');
    hpBarText.textContent = `${hp} / ${hp}`;

    hpBarContainer.appendChild(hpBarFill);
    hpBarContainer.appendChild(hpBarText);

    const statusEffectsContainer = document.createElement('div');
    statusEffectsContainer.classList.add('status-effects-container');

    encounterDetails.appendChild(encounterName);
    encounterDetails.appendChild(hpBarContainer);

    li.appendChild(img);
    li.appendChild(encounterDetails);
    li.appendChild(statusEffectsContainer);
    encounterList.appendChild(li);
}

function updateEncounterHP(name, newHp) {
    const encounter = activeEncounters.find(e => e.name === name);
    if (encounter) {
        encounter.hp = Math.max(0, Math.min(encounter.maxHp, newHp));
        const encounterElement = document.getElementById(`encounter-${encounter.id}`);
        if (encounterElement) {
            const hpBar = encounterElement.querySelector('.hp-bar-fill');
            const hpText = encounterElement.querySelector('.hp-bar-text');
            const percentage = (encounter.hp / encounter.maxHp) * 100;
            hpBar.style.width = `${percentage}%`;
            hpText.textContent = `${encounter.hp} / ${encounter.maxHp}`;
        }
    }
}

// New: Function to handle the dice roll animation and execution
async function executeWithDiceRoll(prompt) {
    diceResultText.classList.remove('visible');
    diceRollOverlay.classList.remove('hidden');
    
    // Animate the die
    const animation = diceAnimationContainer.animate(
        [
            { transform: 'translate(-50vw, -50vh) rotate(0deg) scale(0.5)' },
            { transform: 'translate(30vw, -40vh) rotate(360deg) scale(1)' },
            { transform: 'translate(-40vw, 20vh) rotate(720deg) scale(1)' },
            { transform: 'translate(20vw, 30vh) rotate(1080deg) scale(1)' },
            { transform: 'translate(-10vw, -10vh) rotate(1440deg) scale(1)' },
            { transform: 'translate(-50%, -50%) rotate(1800deg) scale(1.2)' }
        ], {
            duration: 2000,
            easing: 'ease-in-out'
        }
    );
    
    playSound(diceRollBuffer, 0.5);

    // After animation finishes
    animation.onfinish = async () => {
        const roll = Math.floor(Math.random() * 20) + 1;
        diceResultText.textContent = roll;
        diceResultText.classList.add('visible');
        
        // Wait a moment to show the result
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide the overlay
        diceRollOverlay.classList.add('hidden');
        
        // Now, get the AI response
        const promptWithRoll = `${prompt} (I rolled a ${roll} on my d20).`;
        await getAIResponse(promptWithRoll);
    };
}

// New: extracted reset logic for starting a new game
function startNewGameReset() {
    console.error('⚠️⚠️⚠️ startNewGameReset() CALLED - CLEARING ALL GAME STATE!');
    console.error('⚠️ Stack trace:', new Error().stack);

    // Reset to start menu
    appContainer.style.display = 'none';
    startScreenContainer.style.display = 'flex';

    // Reset game state variables
    console.error('⚠️ Clearing conversation history from:', conversationHistory.length, 'messages');
    conversationHistory = [];
    partyMembers = [];
    inventoryItems = [];
    weapons = [];
    armors = [];
    rings = [];
    equipment = { weapon: null, armor: null, ring1: null, ring2: null };
    activeEncounters = [];
    player = {
        hp: 100, maxHp: 100, statusEffects: [],
        level: 1, xp: 0, xpToNextLevel: 100,
        skillPoints: 1, upgradePoints: 0,
        stats: {}, baseStats: {}, skillTree: [],
        racialSkills: [], evolution: null, availableEvolutions: [],
    };
    selectedClass = null;
    selectedRace = null;

    // Clear UI
    messagesContainer.innerHTML = '';
    itemList.innerHTML = '';
    partyList.innerHTML = '';
    weaponList.innerHTML = '';
    armorList.innerHTML = '';
    ringList.innerHTML = '';
    encounterList.innerHTML = '';
    playerStatusEffectsContainer.innerHTML = '';
    updateEquipmentUI();
    updatePlayerStatsUI();
    updatePlayerXPBar();
    skillTreeContainer.classList.add('hidden');
    raceMenuContainer.classList.add('hidden');
    evolutionContainer.classList.add('hidden');

    // Reset start menu inputs
    universeInput.value = '';
    customRaceInput.value = '';
    customClassInput.value = '';
    raceButtons.forEach(btn => btn.classList.remove('selected'));
    classButtons.forEach(btn => btn.classList.remove('selected'));
    raceDetailsDisplay.classList.add('hidden');
    classDetailsDisplay.classList.add('hidden');
    startGameButton.disabled = true;

    // Reset character photo
    if (characterPhotoInput) characterPhotoInput.value = '';
    characterPhotoDataUrl = null;
    if (characterPhotoPreview) {
        characterPhotoPreview.src = '';
        characterPhotoPreview.style.display = 'none';
    }

    // Stop music
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    musicStarted = false;
    musicButton.innerHTML = `<i class="fas fa-volume-mute"></i>`;
    ttsButton.innerHTML = `<i class="fas fa-microphone"></i>`;
    ttsEnabled = true;
    ttsQueue = [];
    isSpeaking = false;
    currentTtsAudio = null;
    suppressTTS = false;

    // Stop autoplay if it's running
    if (isAutoPlaying) toggleAutoplay();
    updateControlButtons();
}

// New: Image style select
const imageStyleSelect = document.getElementById('image-style-select');
const imageStyleSelectInGame = document.getElementById('image-style-select-in-game');
let imageStyle = 'pixel';

// New: Voice select
const voiceSelect = document.getElementById('voice-select');
let selectedVoice = 'AALIYAH'; // Default voice (Female, clear)

// Track generated assets for export
const generatedImages = []; // { url, ts, index }
const ttsAudioUrls = [];    // { url, ts, index }
const sfxAudioUrls = [];    // { url, ts, index } - ambient SFX for each scene
const narrativeTexts = [];  // { text, ts, index } - for video subtitles

imageStyleSelectInGame?.addEventListener('change', () => {
    imageStyle = imageStyleSelectInGame.value;
    if (imageStyleSelect) imageStyleSelect.value = imageStyle;
});

imageStyleSelect?.addEventListener('change', () => {
    imageStyle = imageStyleSelect.value;
    if (imageStyleSelectInGame) imageStyleSelectInGame.value = imageStyle;
});

// Voice select event listener
voiceSelect?.addEventListener('change', () => {
    console.log('🎤 Voice changed to:', voiceSelect.value);
    console.log('🎤 Conversation history length:', conversationHistory.length);
    selectedVoice = voiceSelect.value;
    console.log('🎤 Voice change complete - history still intact:', conversationHistory.length);
});

// Model tier select
const modelTierSelect = document.getElementById('model-tier-select');
const modelTierSelectMenu = document.getElementById('model-tier-select-menu');

// Initialize model tier selects from localStorage
const savedTier = getModelTier();
if (modelTierSelect) {
    modelTierSelect.value = savedTier;
}
if (modelTierSelectMenu) {
    modelTierSelectMenu.value = savedTier;
}
console.log(`🤖 Loaded model tier: ${savedTier}`);

// Model tier select event listeners - sync both selectors
modelTierSelect?.addEventListener('change', () => {
    const newTier = modelTierSelect.value;
    setModelTier(newTier);
    if (modelTierSelectMenu) modelTierSelectMenu.value = newTier;
    console.log(`🤖 Model tier changed to: ${newTier}`);
});

modelTierSelectMenu?.addEventListener('change', () => {
    const newTier = modelTierSelectMenu.value;
    setModelTier(newTier);
    if (modelTierSelect) modelTierSelect.value = newTier;
    console.log(`🤖 Model tier changed to: ${newTier}`);
});

// Unified style helper for scenes, icons, and avatars
function getStyleTag(kind = 'scene') {
    const key = imageStyle || 'pixel';
    const base = {
        pixel: '8-bit pixel art',
        isometric: 'isometric pixel art',
        watercolor: 'watercolor illustration',
        oil: 'oil painting',
        photo: 'photorealistic',
        anime: 'anime style illustration',
        sketch: 'pencil sketch'
    }[key];
    if (kind === 'icon') return `${base} icon`;
    if (kind === 'avatar') return `${base} character avatar`;
    return base;
}

// New: Function to enqueue text-to-speech
function enqueueTTS(text) {
    if (!ttsEnabled || !text) return;
    const parts = text.split(/(?<=[.!?])\s+/).reduce((chunks, s) => {
        const last = chunks[chunks.length - 1];
        if (last && (last + ' ' + s).length <= 450) chunks[chunks.length - 1] = last + ' ' + s;
        else chunks.push(s);
        return chunks;
    }, []);
    ttsQueue.push(...parts);
    // Don't auto-play anymore - let user click button per message
}

// Cache for TTS audio per message (avoid regenerating)
const ttsAudioCache = new Map(); // key: messageText, value: { url, audio }

// New: Function to generate and cache TTS for a message
async function generateTTSForMessage(text, messageElement) {
    // Check cache first
    if (ttsAudioCache.has(text)) {
        return ttsAudioCache.get(text);
    }

    try {
        const result = await websim.textToSpeech({ text, voice: selectedVoice });
        if (!result || !result.url) {
            return null;
        }

        const audioData = {
            url: result.url,
            audio: new Audio(result.url)
        };

        // Cache it
        ttsAudioCache.set(text, audioData);
        ttsAudioUrls.push({ url: result.url, ts: Date.now(), index: ttsAudioUrls.length + 1 });
        // Also track the text for video subtitles
        narrativeTexts.push({ text: text, ts: Date.now(), index: narrativeTexts.length + 1 });

        return audioData;
    } catch (error) {
        console.error('TTS generation error:', error);
        return null;
    }
}

// New: Play/stop audio for a specific message
async function toggleMessageAudio(messageElement, text, button) {
    const audioData = messageElement._audioData || await generateTTSForMessage(text, messageElement);

    if (!audioData) {
        console.error('Failed to generate TTS');
        return;
    }

    messageElement._audioData = audioData;
    const audio = audioData.audio;

    // If this audio is playing, stop it
    if (currentTtsAudio === audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        currentTtsAudio = null;
        button.innerHTML = '<i class="fas fa-volume-up"></i>';
        button.classList.remove('playing');
        return;
    }

    // Stop any other playing audio
    if (currentTtsAudio && !currentTtsAudio.paused) {
        currentTtsAudio.pause();
        currentTtsAudio.currentTime = 0;
        // Update other button states
        document.querySelectorAll('.message-audio-btn.playing').forEach(btn => {
            btn.innerHTML = '<i class="fas fa-volume-up"></i>';
            btn.classList.remove('playing');
        });
    }

    // Play this audio
    currentTtsAudio = audio;
    button.innerHTML = '<i class="fas fa-stop"></i>';
    button.classList.add('playing');

    audio.onended = () => {
        button.innerHTML = '<i class="fas fa-volume-up"></i>';
        button.classList.remove('playing');
        if (currentTtsAudio === audio) {
            currentTtsAudio = null;
        }
    };

    try {
        await audio.play();
    } catch (error) {
        console.error('Audio play error:', error);
        button.innerHTML = '<i class="fas fa-volume-up"></i>';
        button.classList.remove('playing');
    }
}

// New: Function to process text-to-speech (simplified - now just for legacy support)
async function processTTS() {
    if (ttsQueue.length === 0) { isSpeaking = false; return; }
    isSpeaking = true;
    const text = ttsQueue.shift();
    try {
        const result = await websim.textToSpeech({ text, voice: selectedVoice });
        // Skip if TTS not available (returns null)
        if (!result || !result.url) {
            processTTS();
            return;
        }
        // Handle any currently playing audio before starting new one
        await handleAudioInterruption();

        const audio = new Audio(result.url);
        currentTtsAudio = audio;
        ttsAudioUrls.push({ url: result.url, ts: Date.now(), index: ttsAudioUrls.length + 1 });

        // Robust play with retries; if failing, requeue the same chunk
        const tryPlay = (retries = 3) => new Promise((resolve) => {
            const start = () => {
                audio.play().then(() => {
                    audio.onended = resolve;
                    audio.onerror = () => retries > 0 ? setTimeout(() => start(--retries), 300) : resolve('failed');
                    audio.onstalled = () => retries > 0 ? setTimeout(() => start(--retries), 300) : resolve('failed');
                }).catch(() => {
                    if (retries > 0) setTimeout(() => start(--retries), 300);
                    else resolve('failed');
                });
            };
            start();
        });

        const outcome = await tryPlay(3);
        if (outcome === 'failed') {
            // Requeue this chunk at the front to avoid losing content
            ttsQueue.unshift(text);
        }
    } catch {
        // On network or generation failure, requeue and try next time
        ttsQueue.unshift(text);
    } finally {
        processTTS();
    }
}

// New: Voice toggle button
ttsButton.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsButton.innerHTML = ttsEnabled
        ? `<i class="fas fa-microphone"></i>`
        : `<i class="fas fa-microphone-slash"></i>`;
    if (!ttsEnabled && currentTtsAudio) { currentTtsAudio.pause(); currentTtsAudio = null; ttsQueue = []; isSpeaking = false; }
});

// SFX toggle button
sfxButton.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    sfxButton.innerHTML = sfxEnabled
        ? `<i class="fas fa-water"></i>`
        : `<i class="fas fa-water" style="opacity: 0.4;"></i>`;
    if (!sfxEnabled && currentSfxAudio) { currentSfxAudio.pause(); currentSfxAudio = null; }
});

// New: Voice read button
voiceReadButton.addEventListener('click', async () => {
    if (activeContextMenuMessageIndex < 0) return;
    const entry = conversationHistory[activeContextMenuMessageIndex];
    let text = '';
    try { text = JSON.parse(entry.content)?.narrative || ''; } catch { text = entry.content || ''; }
    if (!text) return;
    if (!ttsEnabled) { ttsEnabled = true; ttsButton.innerHTML = `<i class="fas fa-headphones"></i>`; }
    enqueueTTS(text);
    messageContextMenu.classList.add('hidden');
});

// Initialize button event listeners (called after DOM is ready)
function initializeButtonListeners() {
    try {
        console.log('🔥🔥🔥 ===== initializeButtonListeners() STARTING ===== 🔥🔥🔥');

        // Query elements directly here (in case top-level queries were too early)
        const expandBtn = document.getElementById('expand-image-button');
        const exportBtn = document.getElementById('export-media-button');
        const overlay = document.getElementById('fullscreen-overlay');
        const fullscreenImg = document.getElementById('fullscreen-image');
        const locImg = document.getElementById('location-image');

        console.log('🔧 Elements found:', {
            expandImageButton: !!expandBtn,
            exportMediaButton: !!exportBtn,
            exportMediaButtonElement: exportBtn,
            fullscreenOverlay: !!overlay,
            fullscreenImage: !!fullscreenImg,
            locationImage: !!locImg
        });

        // Fullscreen image button
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                try {
                    console.log('🖼️ Fullscreen button clicked!', {
                        target: e.target,
                        currentTarget: e.currentTarget,
                        hasImage: !!locImg.src,
                        imageSrc: locImg.src
                    });

                    if (!locImg.src) {
                        console.warn('No image to display in fullscreen');
                        alert('No image to display. Play the game to generate images!');
                        return;
                    }
                    fullscreenImg.style.opacity = '0';
                    fullscreenImg.src = locImg.src;
                    overlay.classList.add('active');
                    requestAnimationFrame(() => { fullscreenImg.style.opacity = '1'; });
                } catch (err) {
                    console.error('❌ Error in fullscreen click handler:', err);
                }
            }, true); // Use capture to catch clicks on child elements too
            console.log('✅ Fullscreen button listener attached');
        } else {
            console.error('❌ expandImageButton not found in DOM!');
        }

        // Fullscreen overlay close handlers
        if (overlay) {
            overlay.addEventListener('click', () => overlay.classList.remove('active'));
            window.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.classList.remove('active'); });
        }

        // Export media button
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                try {
                    console.log('🔥🔥🔥 ===== MAIN EXPORT HANDLER FIRED ===== 🔥🔥🔥');
                    console.log('📦 Export button clicked!', {
                        target: e.target,
                        currentTarget: e.currentTarget,
                        images: typeof generatedImages !== 'undefined' ? generatedImages.length : 'undefined',
                        audio: typeof ttsAudioUrls !== 'undefined' ? ttsAudioUrls.length : 'undefined'
                    });

                    if (typeof generatedImages === 'undefined' || typeof ttsAudioUrls === 'undefined') {
                        console.error('generatedImages or ttsAudioUrls not defined yet!');
                        alert('App not fully loaded. Please refresh the page.');
                        return;
                    }

                    if ((!generatedImages.length) && (!ttsAudioUrls.length)) {
                        alert('No images or audio to export yet. Play the game first to generate content!');
                        return;
                    }

                    const modal = document.getElementById('export-modal');
                    if (modal) {
                        modal.style.display = 'block';
                        const status = document.getElementById('export-status');
                        if (status) status.innerHTML = '';
                    } else {
                        console.error('Export modal not found!');
                    }
                } catch (err) {
                    console.error('❌ Error in export click handler:', err);
                }
            }, true); // Use capture to catch clicks on child elements too
            console.log('🔥🔥🔥 ===== Export button listener ATTACHED SUCCESSFULLY ===== 🔥🔥🔥');
        } else {
            console.error('❌❌❌ ===== exportMediaButton NOT FOUND in DOM ===== ❌❌❌');
        }

        console.log('🔧 initializeButtonListeners() COMPLETE!');
    } catch (error) {
        console.error('❌ FATAL ERROR in initializeButtonListeners():', error);
    }
}

/* Export media as ZIP */
async function exportMediaZip() {
    console.log('📦 ==================== ZIP EXPORT STARTED ====================');
    console.log('📦 Function called at:', new Date().toISOString());
    console.log('📦 Call stack:', new Error().stack);

    // Check if arrays exist
    console.log('📊 Checking data availability...');
    console.log('  generatedImages exists?', typeof generatedImages !== 'undefined');
    console.log('  ttsAudioUrls exists?', typeof ttsAudioUrls !== 'undefined');

    if (typeof generatedImages === 'undefined' || typeof ttsAudioUrls === 'undefined') {
        console.error('❌ CRITICAL: Arrays not defined!');
        alert('Export system not initialized. Please refresh the page.');
        return;
    }

    console.log('📊 Available data:', {
        images: generatedImages.length,
        audio: ttsAudioUrls.length,
        imagesArray: generatedImages,
        audioArray: ttsAudioUrls
    });

    if ((!generatedImages.length) && (!ttsAudioUrls.length)) {
        console.error('❌ No data to export');
        alert('No images or audio to export yet. Play the game to generate content!');
        return;
    }

    try {
        // Disable button and show loading
        console.log('🔒 Attempting to disable export button...');
        const exportBtn = document.getElementById('export-media-button');
        console.log('  Export button found?', !!exportBtn);

        if (exportBtn) {
            exportBtn.disabled = true;
            const original = exportBtn.innerHTML;
            exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Preparing ZIP...`;
            console.log('✅ Export button updated with loading indicator');
        } else {
            console.warn('⚠️ Export button not found, continuing anyway...');
        }

        // Initialize JSZip
        console.log('📦 Checking JSZip library...');
        console.log('  JSZip type:', typeof JSZip);
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Check internet connection.');
        }
        console.log('✅ JSZip library available');

        const zip = new JSZip();
        const imgFolder = zip.folder('images');
        const audioFolder = zip.folder('audio');
        console.log('✅ ZIP folders created');

        const toBlob = async (url) => {
            console.log(`  📥 Fetching: ${url.substring(0, 50)}...`);
            const res = await fetch(url, { mode: 'cors' });
            if (!res.ok) {
                throw new Error(`Failed to fetch ${url}: ${res.status}`);
            }
            const blob = await res.blob();
            console.log(`  ✅ Fetched: ${blob.size} bytes`);
            return blob;
        };

        const extFromUrl = (url, fallback) => {
            try {
                const u = new URL(url, location.href);
                const m = u.pathname.match(/\.(\w+)(?:$|\?)/);
                return m ? m[1].toLowerCase() : fallback;
            } catch { return fallback; }
        };

        // Export images
        console.log(`📷 Exporting ${generatedImages.length} images...`);
        if (exportBtn) exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporting images...`;

        for (let i = 0; i < generatedImages.length; i++) {
            const item = generatedImages[i];
            console.log(`  Image ${i + 1}/${generatedImages.length}:`, item);
            const blob = await toBlob(item.url);
            console.log(`    Blob size: ${blob.size} bytes`);
            const ext = extFromUrl(item.url, 'png');
            const name = `scene-${String(item.index).padStart(3,'0')}.${ext}`;
            imgFolder.file(name, blob);
            console.log(`  ✅ Added: ${name}`);
        }

        // Export audio
        console.log(`🎤 Exporting ${ttsAudioUrls.length} audio files...`);
        if (exportBtn) exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Exporting audio...`;

        for (let i = 0; i < ttsAudioUrls.length; i++) {
            const item = ttsAudioUrls[i];
            console.log(`  Audio ${i + 1}/${ttsAudioUrls.length}:`, item);
            const blob = await toBlob(item.url);
            console.log(`    Blob size: ${blob.size} bytes`);
            const ext = extFromUrl(item.url, 'mp3');
            const name = `tts-${String(item.index).padStart(3,'0')}.${ext}`;
            audioFolder.file(name, blob);
            console.log(`  ✅ Added: ${name}`);
        }

        // Generate ZIP
        console.log('🗜️ Generating ZIP file...');
        if (exportBtn) exportBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Creating ZIP...`;

        const outBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log(`✅ ZIP created: ${outBlob.size} bytes (${(outBlob.size / (1024 * 1024)).toFixed(2)} MB)`);

        // Download
        console.log('💾 Creating download link...');
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        const filename = `rpg-media-${ts}.zip`;
        console.log(`  Filename: ${filename}`);

        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(outBlob);
        console.log(`  Blob URL created: ${blobUrl}`);
        a.href = blobUrl;
        a.download = filename;
        console.log(`  Download link created:`, a);

        document.body.appendChild(a);
        console.log('  Link added to DOM');

        a.click();
        console.log('  Link clicked - download should start!');

        document.body.removeChild(a);
        console.log('  Link removed from DOM');

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            console.log('  Blob URL revoked');
        }, 1000);

        console.log('✅ ==================== ZIP EXPORT COMPLETE ====================');
        if (exportBtn) {
            exportBtn.innerHTML = `<i class="fas fa-check"></i> Downloaded!`;
            exportBtn.disabled = false;
            setTimeout(() => {
                exportBtn.innerHTML = `<i class="fas fa-file-archive"></i>`;
            }, 2000);
        }

    } catch (error) {
        console.error('❌ ==================== ZIP EXPORT FAILED ====================');
        console.error('❌ Error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack:', error.stack);
        alert(`Export failed: ${error.message}\n\nCheck console (F12) for details.`);

        const exportBtn2 = document.getElementById('export-media-button');
        if (exportBtn2) {
            exportBtn2.innerHTML = `<i class="fas fa-times"></i> Failed`;
            setTimeout(() => {
                exportBtn2.innerHTML = `<i class="fas fa-file-archive"></i>`;
            }, 2000);
        }
    } finally {
        const exportBtn3 = document.getElementById('export-media-button');
        if (exportBtn3) {
            exportBtn3.disabled = false;
            console.log('🔓 Export button re-enabled');
        }
    }
}

// Export modal logic - Initialize after DOM is ready
function initializeExportModal() {
    console.log('🔧 Initializing export modal...');

    const exportModal = document.getElementById('export-modal');
    const exportModalClose = document.getElementById('export-modal-close');
    const exportFilesButton = document.getElementById('export-files-button');
    const exportVideoButton = document.getElementById('export-video-button');
    const exportSubtitlesCheckbox = document.getElementById('export-subtitles-checkbox');
    const exportStatus = document.getElementById('export-status');

    console.log('🔧 Export modal elements:', {
        exportModal: !!exportModal,
        exportModalClose: !!exportModalClose,
        exportFilesButton: !!exportFilesButton,
        exportVideoButton: !!exportVideoButton,
        exportMediaButton: !!exportMediaButton
    });

    // Export media button already initialized in initializeButtonListeners()
    // No need to attach listener here - would create duplicate
    console.log('ℹ️ Export media button listener handled by initializeButtonListeners()');

    // Close modal
    if (exportModalClose) {
        exportModalClose.addEventListener('click', () => {
            console.log('❌ Closing export modal (main handler)');
            exportModal.style.display = 'none';
        });
        console.log('✅ Export modal close button listener attached');
    } else {
        console.error('❌ exportModalClose not found!');
    }

    // Export files (existing ZIP functionality)
    if (exportFilesButton) {
        exportFilesButton.addEventListener('click', async () => {
            console.log('📦 ===== Export Files button clicked (main handler) =====');
            exportModal.style.display = 'none';
            try {
                await exportMediaZip();
                console.log('✅ ===== exportMediaZip() completed successfully =====');
            } catch (error) {
                console.error('❌ ===== exportMediaZip() failed =====', error);
                alert(`ZIP export failed: ${error.message}`);
            }
        });
        console.log('✅ Export files button listener attached');
    } else {
        console.error('❌ exportFilesButton not found!');
    }

    // Export video button handler
    if (exportVideoButton) {
        exportVideoButton.addEventListener('click', async () => {
            console.log('🎬 ==================== VIDEO EXPORT STARTED ====================');
            console.log('🎬 Button clicked at:', new Date().toISOString());

            const includeSubtitles = exportSubtitlesCheckbox.checked;
            console.log('🎬 Include subtitles:', includeSubtitles);

            exportVideoButton.disabled = true;
            exportFilesButton.disabled = true;
            exportStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating video... This may take a few minutes.';

            try {
                console.log('🎬 Checking data availability...');
                console.log('  generatedImages:', generatedImages ? generatedImages.length : 'undefined');
                console.log('  ttsAudioUrls:', ttsAudioUrls ? ttsAudioUrls.length : 'undefined');
                console.log('  narrativeTexts:', narrativeTexts ? narrativeTexts.length : 'undefined');

                // Prepare scenes data
                const scenes = [];
                const maxScenes = Math.max(generatedImages.length, ttsAudioUrls.length);
                console.log('🎬 Max scenes to prepare:', maxScenes);

                for (let i = 0; i < maxScenes; i++) {
                    const scene = {};

                    // Get image (use last available if not enough)
                    if (generatedImages.length > 0) {
                        const imgIndex = Math.min(i, generatedImages.length - 1);
                        scene.imageUrl = generatedImages[imgIndex].url;
                        console.log(`  Scene ${i + 1}: Image URL = ${scene.imageUrl.substring(0, 50)}...`);
                    }

                    // Get audio duration if available
                    if (ttsAudioUrls.length > i && ttsAudioUrls[i].duration) {
                        scene.audioDuration = ttsAudioUrls[i].duration;
                        console.log(`  Scene ${i + 1}: Audio duration = ${scene.audioDuration}ms`);
                    }

                    // Get text (optional, for subtitles)
                    if (narrativeTexts.length > i) {
                        scene.text = narrativeTexts[i].text;
                        console.log(`  Scene ${i + 1}: Text length = ${scene.text.length} chars`);
                    }

                    // Skip scene if no image
                    if (!scene.imageUrl) {
                        console.warn(`  Scene ${i + 1}: Skipped (no image)`);
                        continue;
                    }

                    scenes.push(scene);
                }

                if (scenes.length === 0) {
                    throw new Error('No scenes to export. Play the game to generate images first!');
                }

                console.log('✅ Prepared', scenes.length, 'scenes successfully');
                console.log('🎬 Calling generateVideoClientSide()...');

                // Generate video client-side with FFmpeg.js
                const videoBlob = await generateVideoClientSide(scenes, includeSubtitles);
                console.log('✅ generateVideoClientSide() returned blob:', videoBlob.size, 'bytes');

                // Download the video with correct extension
                const isWebM = videoBlob.type.includes('webm');
                const extension = isWebM ? 'webm' : 'mp4';
                const filename = `adventure-${Date.now()}.${extension}`;
                const format = isWebM ? 'WebM' : 'MP4';

                console.log('📹 Video format:', format, '(', videoBlob.type, ')');

                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Cleanup
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                exportStatus.innerHTML = `<i class="fas fa-check" style="color: green;"></i> Video generated successfully! (${format} format)`;
                console.log('✅ Video export complete:', filename);

                setTimeout(() => {
                    exportModal.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error('❌ Video export error:', error);
                exportStatus.innerHTML = `<i class="fas fa-times" style="color: red;"></i> Error: ${error.message}`;
            } finally {
                exportVideoButton.disabled = false;
                exportFilesButton.disabled = false;
            }
        });
        console.log('✅ Export video button listener attached');
    } else {
        console.error('❌ exportVideoButton not found!');
    }

    console.log('✅ Export modal initialization complete');
}

// CLIENT-SIDE VIDEO EXPORT using FFmpeg.js (MP4 format)
// Use var instead of let to avoid temporal dead zone issues in ES6 modules
var ffmpegInstance = null;

async function initFFmpeg() {
    console.log('🔧 ==================== INIT FFMPEG STARTED ====================');

    if (ffmpegInstance) {
        console.log('✅ FFmpeg already initialized, returning cached instance');
        return ffmpegInstance;
    }

    const statusEl = document.getElementById('export-status');
    if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading FFmpeg (first time only)...';
    }

    try {
        console.log('🔍 Checking window.FFmpegWASM...');
        console.log('  window.FFmpegWASM exists?', typeof window.FFmpegWASM !== 'undefined');
        console.log('  window.FFmpegWASM:', window.FFmpegWASM);

        if (typeof window.FFmpegWASM === 'undefined') {
            throw new Error('FFmpegWASM library not loaded. Check script tags in index.html');
        }

        console.log('🔍 Checking window.FFmpegUtil...');
        console.log('  window.FFmpegUtil exists?', typeof window.FFmpegUtil !== 'undefined');
        console.log('  window.FFmpegUtil:', window.FFmpegUtil);

        if (typeof window.FFmpegUtil === 'undefined') {
            throw new Error('FFmpegUtil library not loaded. Check script tags in index.html');
        }

        const { FFmpeg } = window.FFmpegWASM;
        const { fetchFile, toBlobURL } = window.FFmpegUtil;

        console.log('✅ FFmpeg libraries loaded');
        console.log('  FFmpeg constructor:', typeof FFmpeg);
        console.log('  fetchFile function:', typeof fetchFile);
        console.log('  toBlobURL function:', typeof toBlobURL);

        console.log('🔧 Creating FFmpeg instance...');
        ffmpegInstance = new FFmpeg();
        console.log('✅ FFmpeg instance created:', ffmpegInstance);

        // Add logging
        ffmpegInstance.on('log', ({ message }) => {
            console.log('📹 FFmpeg:', message);
        });

        ffmpegInstance.on('progress', ({ progress, time }) => {
            console.log(`📹 FFmpeg progress: ${(progress * 100).toFixed(2)}% (time: ${time})`);
        });

        // Load FFmpeg core
        console.log('📦 Loading FFmpeg WASM core...');
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        console.log('  Base URL:', baseURL);

        console.log('📦 Converting URLs to blob URLs...');
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        console.log('  Core URL:', coreURL);

        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        console.log('  WASM URL:', wasmURL);

        console.log('📦 Calling ffmpeg.load()...');
        await ffmpegInstance.load({
            coreURL: coreURL,
            wasmURL: wasmURL
        });

        console.log('✅ ==================== FFMPEG LOADED SUCCESSFULLY ====================');
        return ffmpegInstance;
    } catch (error) {
        console.error('❌ ==================== FFMPEG INIT FAILED ====================');
        console.error('❌ Error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Stack:', error.stack);
        throw new Error(`FFmpeg initialization failed: ${error.message}`);
    }
}

async function generateVideoClientSide(scenes, includeSubtitles) {
    console.log('🎬 ==================== GENERATE VIDEO STARTED ====================');
    console.log('🎬 Scenes to render:', scenes.length);
    console.log('🎬 Include subtitles:', includeSubtitles);

    // Try FFmpeg first, but fall back to MediaRecorder if CORS issues
    let useFFmpeg = true;
    let ffmpeg = null;
    let fetchFile = null;

    try {
        // Initialize FFmpeg
        console.log('🎬 Step 1: Try initialize FFmpeg...');
        ffmpeg = await initFFmpeg();
        console.log('✅ FFmpeg initialized - using MP4 export');
        fetchFile = window.FFmpegUtil.fetchFile;
    } catch (ffmpegError) {
        console.warn('⚠️ FFmpeg initialization failed (likely CORS on Vercel)');
        console.warn('⚠️ Falling back to MediaRecorder (WebM format)');
        console.warn('⚠️ Error was:', ffmpegError.message);
        useFFmpeg = false;
    }

    try {
        const statusEl = document.getElementById('export-status');

        if (useFFmpeg) {
            // FFmpeg Method - MP4 Output
            console.log('🎬 Step 2: Using FFmpeg method...');
            console.log('  fetchFile:', typeof fetchFile);
            console.log('  Status element found:', !!statusEl);

        // Create canvas for rendering frames
        console.log('🎬 Step 3: Create canvas...');
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        console.log('✅ Canvas created: 1280x720');

        // Render each scene as PNG frames
        const frameFiles = [];
        console.log('🎬 Step 4: Render frames...');

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const progress = Math.round(((i + 1) / scenes.length) * 50); // 0-50% for rendering
            console.log(`🎬 ===== Rendering frame ${i + 1}/${scenes.length} (${progress}%) =====`);
            console.log(`  Scene imageUrl: ${scene.imageUrl ? scene.imageUrl.substring(0, 60) + '...' : 'N/A'}`);
            console.log(`  Scene text length: ${scene.text ? scene.text.length : 0} chars`);

            if (statusEl) {
                statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Rendering frames ${i + 1}/${scenes.length} (${progress}%)`;
            }

            // Clear canvas to black
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 1280, 720);

            // Load and draw image
            try {
                const img = await loadImageFromUrl(scene.imageUrl);

                // Calculate aspect ratio fit
                const imgAspect = img.width / img.height;
                const canvasAspect = 1280 / 720;

                let drawWidth, drawHeight, drawX, drawY;

                if (imgAspect > canvasAspect) {
                    drawWidth = 1280;
                    drawHeight = 1280 / imgAspect;
                    drawX = 0;
                    drawY = (720 - drawHeight) / 2;
                } else {
                    drawHeight = 720;
                    drawWidth = 720 * imgAspect;
                    drawX = (1280 - drawWidth) / 2;
                    drawY = 0;
                }

                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            } catch (error) {
                console.error('Error loading scene image:', error);
                ctx.fillStyle = 'white';
                ctx.font = '32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Image loading failed', 640, 360);
            }

            // Add subtitles if enabled
            if (includeSubtitles && scene.text) {
                const maxWidth = 1100;
                const lines = wrapText(ctx, scene.text, maxWidth, '28px Arial');

                const lineHeight = 35;
                const totalHeight = lines.length * lineHeight + 20;
                const bgY = 720 - totalHeight - 40;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(90, bgY, 1100, totalHeight);

                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3;
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                lines.forEach((line, index) => {
                    const y = bgY + 10 + (index * lineHeight);
                    ctx.strokeText(line, 640, y);
                    ctx.fillText(line, 640, y);
                });
            }

            // Convert canvas to blob
            console.log(`  Converting canvas to PNG blob...`);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            console.log(`  ✅ Canvas converted to blob: ${blob.size} bytes`);

            const frameName = `frame${String(i).padStart(4, '0')}.png`;
            console.log(`  Frame filename: ${frameName}`);

            // Write frame to FFmpeg virtual filesystem
            console.log(`  Converting blob to buffer for FFmpeg...`);
            const fileData = await fetchFile(blob);
            console.log(`  ✅ File data ready: ${fileData.byteLength} bytes`);

            console.log(`  Writing to FFmpeg filesystem...`);
            await ffmpeg.writeFile(frameName, fileData);
            frameFiles.push(frameName);

            console.log(`✅ Frame ${i + 1} written successfully: ${frameName} (${blob.size} bytes)`);
        }

        // Generate video with FFmpeg
        console.log('🎬 ==================== FFMPEG ENCODING STARTED ====================');
        console.log('🎬 Total frames written:', frameFiles.length);
        console.log('🎬 Frame files:', frameFiles);

        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Encoding video (50-100%)...';
        }

        // Calculate framerate (3 seconds per scene = 1/3 fps, but min 0.5 fps)
        const fps = Math.max(0.5, 1 / 3); // 3 seconds per frame
        console.log('🎬 Framerate:', fps, 'fps');

        // FFmpeg command
        const ffmpegArgs = [
            '-framerate', fps.toString(),
            '-pattern_type', 'glob',
            '-i', 'frame*.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            'output.mp4'
        ];
        console.log('🎬 FFmpeg command:', ffmpegArgs.join(' '));
        console.log('🎬 Calling ffmpeg.exec()...');

        await ffmpeg.exec(ffmpegArgs);

        console.log('✅ ==================== FFMPEG ENCODING COMPLETE ====================');

        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing video...';
        }

        // Read the output video
        console.log('📦 Reading output.mp4 from FFmpeg filesystem...');
        const data = await ffmpeg.readFile('output.mp4');
        console.log('✅ Output file read:', data.byteLength, 'bytes');

        console.log('📦 Creating video blob...');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        console.log('✅ Video blob created:', videoBlob.size, 'bytes (', (videoBlob.size / 1024 / 1024).toFixed(2), 'MB )');

        // Cleanup FFmpeg filesystem
        console.log('🧹 Cleaning up FFmpeg filesystem...');
        let deletedCount = 0;
        for (const frameName of frameFiles) {
            try {
                await ffmpeg.deleteFile(frameName);
                deletedCount++;
            } catch (e) {
                console.warn('  ⚠️ Could not delete frame:', frameName, e.message);
            }
        }
        console.log(`✅ Deleted ${deletedCount}/${frameFiles.length} frames`);

        try {
            await ffmpeg.deleteFile('output.mp4');
            console.log('✅ Deleted output.mp4');
        } catch (e) {
            console.warn('  ⚠️ Could not delete output.mp4:', e.message);
        }

        console.log('✅ ==================== VIDEO GENERATION COMPLETE ====================');
        return videoBlob;

        } else {
            // MediaRecorder Method - WebM Output (Fallback for Vercel/CORS issues)
            console.log('🎬 Step 2: Using MediaRecorder method (WebM format)...');
            console.log('  This is used when FFmpeg is blocked by CORS (Vercel deployment)');

            // Create canvas for rendering
            console.log('🎬 Step 3: Create canvas...');
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            console.log('✅ Canvas created: 1280x720');

            // Draw initial black frame
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 1280, 720);

            // Get canvas stream with manual frame request mode
            console.log('🎬 Step 4: Capture canvas stream...');
            const stream = canvas.captureStream(0); // 0 = manual mode, use requestFrame()
            console.log('✅ Canvas stream captured in manual mode');

            // Setup MediaRecorder with better codec settings
            console.log('🎬 Step 5: Initialize MediaRecorder...');
            let mimeType;
            let codecOptions;

            // Try different codecs in order of preference
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
                codecOptions = { videoBitsPerSecond: 5000000 }; // 5 Mbps for VP9
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                mimeType = 'video/webm;codecs=vp8';
                codecOptions = { videoBitsPerSecond: 8000000 }; // 8 Mbps for VP8 (less efficient)
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
                codecOptions = { videoBitsPerSecond: 5000000 };
            } else {
                throw new Error('WebM video recording not supported in this browser');
            }

            console.log('  MIME type:', mimeType);
            console.log('  Bitrate:', codecOptions.videoBitsPerSecond, 'bps');

            const chunks = [];
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                ...codecOptions
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                    console.log('  📹 Recorded chunk:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder error during recording:', event.error);
            };

            // Start recording
            console.log('🎬 Step 6: Start recording...');
            mediaRecorder.start();
            console.log('✅ MediaRecorder started');

            // Render each scene with timing
            console.log('🎬 Step 7: Render scenes...');
            const sceneDuration = 3000; // 3 seconds per scene
            const framesPerSecond = 10; // 10 fps for smooth playback
            const frameInterval = 1000 / framesPerSecond; // 100ms per frame

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const progress = Math.round(((i + 1) / scenes.length) * 100);
                console.log(`🎬 ===== Rendering scene ${i + 1}/${scenes.length} (${progress}%) =====`);

                if (statusEl) {
                    statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Recording scene ${i + 1}/${scenes.length} (${progress}%)`;
                }

                // Load and prepare the image
                let img = null;
                try {
                    img = await loadImageFromUrl(scene.imageUrl);
                    console.log(`  ✅ Image loaded: ${img.width}x${img.height}`);
                } catch (error) {
                    console.error('  ❌ Error loading scene image:', error);
                }

                // Render this scene for the full duration
                const framesForScene = Math.ceil(sceneDuration / frameInterval);
                console.log(`  📹 Recording ${framesForScene} frames over ${sceneDuration}ms`);

                for (let frameNum = 0; frameNum < framesForScene; frameNum++) {
                    // Clear canvas to black
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, 1280, 720);

                    // Draw image if loaded
                    if (img) {
                        // Calculate aspect ratio fit
                        const imgAspect = img.width / img.height;
                        const canvasAspect = 1280 / 720;

                        let drawWidth, drawHeight, drawX, drawY;

                        if (imgAspect > canvasAspect) {
                            drawWidth = 1280;
                            drawHeight = 1280 / imgAspect;
                            drawX = 0;
                            drawY = (720 - drawHeight) / 2;
                        } else {
                            drawHeight = 720;
                            drawWidth = 720 * imgAspect;
                            drawX = (1280 - drawWidth) / 2;
                            drawY = 0;
                        }

                        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                    } else {
                        // Error placeholder
                        ctx.fillStyle = 'white';
                        ctx.font = '32px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('Image loading failed', 640, 360);
                    }

                    // Add subtitles if enabled
                    if (includeSubtitles && scene.text) {
                        const maxWidth = 1100;
                        const lines = wrapText(ctx, scene.text, maxWidth, '28px Arial');

                        const lineHeight = 35;
                        const totalHeight = lines.length * lineHeight + 20;
                        const bgY = 720 - totalHeight - 40;

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(90, bgY, 1100, totalHeight);

                        ctx.fillStyle = 'white';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3;
                        ctx.font = '28px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';

                        lines.forEach((line, index) => {
                            const y = bgY + 10 + (index * lineHeight);
                            ctx.strokeText(line, 640, y);
                            ctx.fillText(line, 640, y);
                        });
                    }

                    // Request frame capture (critical for manual mode!)
                    stream.getVideoTracks()[0].requestFrame();

                    // Wait for next frame interval
                    await new Promise(resolve => setTimeout(resolve, frameInterval));
                }

                console.log(`  ✅ Scene ${i + 1} recorded (${framesForScene} frames)`);
            }

            // Stop recording
            console.log('🎬 Step 8: Stop recording...');
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing video...';
            }

            const videoBlob = await new Promise((resolve, reject) => {
                mediaRecorder.onstop = () => {
                    console.log('✅ MediaRecorder stopped');
                    console.log('📦 Creating video blob from', chunks.length, 'chunks');

                    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log('  Total size:', totalSize, 'bytes');

                    const blob = new Blob(chunks, { type: mimeType });
                    console.log('✅ Video blob created:', blob.size, 'bytes (', (blob.size / 1024 / 1024).toFixed(2), 'MB )');
                    resolve(blob);
                };

                mediaRecorder.onerror = (event) => {
                    console.error('❌ MediaRecorder error on stop:', event.error);
                    reject(event.error);
                };

                mediaRecorder.stop();
            });

            // Stop all tracks
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('  ✅ Track stopped:', track.kind);
            });

            console.log('✅ ==================== VIDEO GENERATION COMPLETE (WebM) ====================');
            return videoBlob;
        }

    } catch (error) {
        console.error('❌ ==================== VIDEO GENERATION FAILED ====================');
        console.error('❌ Error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);

        if (error.message && error.message.includes('FFmpegWASM')) {
            console.error('❌ DIAGNOSIS: FFmpeg library not loaded properly');
            console.error('   Check that index.html has the script tags for @ffmpeg/ffmpeg and @ffmpeg/util');
        }

        throw error;
    }
}

// Helper function to load image from URL
function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// Helper function to wrap text to multiple lines
function wrapText(ctx, text, maxWidth, font) {
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

// Helper function to sleep/wait
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize buttons immediately (script loads as module at end of HTML, so DOM is ready)
console.log('🔥🔥🔥 ===== INITIALIZATION STARTING ===== 🔥🔥🔥');
console.log('📌 Calling initializeButtonListeners() at end of script');
console.log('📌 document.readyState:', document.readyState);
initializeButtonListeners();
console.log('✅ initializeButtonListeners() call completed');

// Initialize export modal
console.log('📌 Calling initializeExportModal() at end of script');
initializeExportModal();
console.log('✅ initializeExportModal() call completed');
console.log('🔥🔥🔥 ===== INITIALIZATION COMPLETE ===== 🔥🔥🔥');