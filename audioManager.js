let audioContext;
let masterGainNode;

async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = 1; // Full volume
        masterGainNode.connect(audioContext.destination);
    }
    // Resume audio context if it was suspended (e.g., after user interaction)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

async function loadSound(url) {
    try {
        await initAudioContext();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error("Error loading sound:", url, error);
        return null;
    }
}

function playSound(buffer, volume = 1) {
    if (!audioContext || !buffer || audioContext.state === 'suspended') {
        console.warn("AudioContext not ready or suspended, cannot play sound.");
        return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(masterGainNode); // Connect to master gain

    source.connect(gainNode);
    source.start(0);
}

export {
    initAudioContext,
    loadSound,
    playSound
};