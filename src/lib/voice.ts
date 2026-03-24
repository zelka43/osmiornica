let enabled = false;
let selectedVoice: SpeechSynthesisVoice | null = null;
let language: "en" | "pl" = "en";

const VOICE_LANG_KEY = "dart_voice_lang";

/**
 * Initializes the voice system. Should be called from a user gesture handler
 * to satisfy browser autoplay policies.
 */
export function initVoice(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Load saved language preference
  try {
    const saved = localStorage.getItem(VOICE_LANG_KEY);
    if (saved === "pl" || saved === "en") language = saved;
  } catch {}

  pickVoice();

  // Voices may load asynchronously in some browsers
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  enabled = true;
}

function pickVoice(): void {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis.getVoices();
  const targetLang = language === "pl" ? "pl" : "en-GB";
  const fallbackPrefix = language === "pl" ? "pl" : "en";

  selectedVoice =
    voices.find((v) => v.lang === targetLang) ??
    voices.find((v) => v.lang.startsWith(fallbackPrefix)) ??
    voices[0] ??
    null;
}

export function setEnabled(value: boolean): void {
  enabled = value;
}

export function isEnabled(): boolean {
  return enabled;
}

export function setLanguage(lang: "en" | "pl"): void {
  language = lang;
  try {
    localStorage.setItem(VOICE_LANG_KEY, lang);
  } catch {}
  pickVoice();
}

export function getLanguage(): "en" | "pl" {
  return language;
}

/**
 * Speaks the given text using the Web Speech API.
 */
export function speak(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number }
): void {
  if (!enabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = language === "pl" ? "pl-PL" : "en-GB";
  }

  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;

  window.speechSynthesis.speak(utterance);
}

/**
 * Converts a number (0–501) to Polish cardinal words.
 */
function numberToPolishWords(n: number): string {
  if (n === 0) return "zero";

  const ones = [
    "", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć",
    "dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście",
    "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście",
  ];
  const tens = [
    "", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt",
    "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt",
  ];
  const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset"];

  const parts: string[] = [];

  if (n >= 100) {
    parts.push(hundreds[Math.floor(n / 100)]);
    n = n % 100;
  }

  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n = n % 10;
  }

  if (n > 0) {
    parts.push(ones[n]);
  }

  return parts.join(" ");
}

/**
 * Announces the score like a professional dart referee, with emotional intonation.
 */
export function announceScore(
  playerName: string,
  turnTotal: number,
  remaining: number
): void {
  if (language === "pl") {
    announceScorePL(playerName, turnTotal, remaining);
  } else {
    announceScoreEN(playerName, turnTotal, remaining);
  }
}

function announceScoreEN(
  playerName: string,
  turnTotal: number,
  remaining: number
): void {
  let scoreCall: string;
  let pitch = 1;
  let rate = 1;

  if (turnTotal === 180) {
    scoreCall = "One hundred and EIGHTY!";
    pitch = 1.3;
    rate = 1.1;
  } else if (turnTotal >= 140) {
    scoreCall = `${turnTotal}!`;
    pitch = 1.2;
    rate = 1.05;
  } else if (turnTotal >= 100) {
    scoreCall = turnTotal === 100 ? "Ton!" : `Ton ${turnTotal - 100}!`;
    pitch = 1.1;
  } else if (turnTotal === 0) {
    scoreCall = "No score!";
    pitch = 0.8;
    rate = 0.85;
  } else if (turnTotal < 20) {
    scoreCall = `${turnTotal}.`;
    pitch = 0.9;
    rate = 0.95;
  } else if (turnTotal === 26) {
    scoreCall = "Twenty six.";
  } else {
    scoreCall = `${turnTotal}.`;
  }

  speak(`${scoreCall} ${playerName} requires ${remaining}.`, { pitch, rate });
}

function announceScorePL(
  playerName: string,
  turnTotal: number,
  remaining: number
): void {
  let scoreCall: string;
  let pitch = 1;
  let rate = 1;

  if (turnTotal === 180) {
    scoreCall = "Sto osiemdziesiąt!";
    pitch = 1.3;
    rate = 1.1;
  } else if (turnTotal >= 140) {
    scoreCall = `${numberToPolishWords(turnTotal)}!`;
    pitch = 1.2;
    rate = 1.05;
  } else if (turnTotal >= 100) {
    scoreCall = `${numberToPolishWords(turnTotal)}!`;
    pitch = 1.1;
  } else if (turnTotal === 0) {
    scoreCall = "Brak punktów!";
    pitch = 0.8;
    rate = 0.85;
  } else if (turnTotal < 20) {
    scoreCall = `${numberToPolishWords(turnTotal)}.`;
    pitch = 0.9;
    rate = 0.95;
  } else {
    scoreCall = `${numberToPolishWords(turnTotal)}.`;
  }

  speak(`${scoreCall} ${playerName} potrzebuje ${numberToPolishWords(remaining)}.`, { pitch, rate });
}

/**
 * Announces a bust (no score).
 */
export function announceBust(_playerName: string): void {
  if (language === "pl") {
    speak("Brak punktów!", { pitch: 0.8, rate: 0.85 });
  } else {
    speak("No score!", { pitch: 0.8, rate: 0.85 });
  }
}

/**
 * Announces a checkout / match win.
 */
export function announceCheckout(playerName: string): void {
  if (language === "pl") {
    speak(`Zamknięcie! ${playerName} wygrywa mecz!`, { pitch: 1.3, rate: 0.8 });
  } else {
    speak(`Game shot and the match! ${playerName}!`, { pitch: 1.3, rate: 0.8 });
  }
}

/**
 * Announces the start of a game.
 */
export function announceGameOn(): void {
  if (language === "pl") {
    speak("Gra rozpoczęta!", { rate: 0.9, pitch: 1.1 });
  } else {
    speak("Game on!", { rate: 0.9, pitch: 1.1 });
  }
}
