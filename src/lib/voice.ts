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

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * 2 * range;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
  let pitch = jitter(1.0, 0.05);
  let rate = jitter(1.0, 0.05);

  if (turnTotal === 180) {
    scoreCall = pick(["One hundred and EIGHTY!", "One. Eight. Zero!"]);
    pitch = jitter(1.3, 0.1);
    rate = jitter(1.1, 0.08);
  } else if (turnTotal >= 140) {
    scoreCall = `${turnTotal}!`;
    pitch = jitter(1.2, 0.08);
    rate = jitter(1.05, 0.06);
  } else if (turnTotal === 100) {
    scoreCall = pick(["Ton!", "One hundred!"]);
    pitch = jitter(1.1, 0.07);
    rate = jitter(1.0, 0.05);
  } else if (turnTotal >= 100) {
    scoreCall = `Ton ${turnTotal - 100}!`;
    pitch = jitter(1.1, 0.06);
    rate = jitter(1.0, 0.05);
  } else if (turnTotal === 85) {
    scoreCall = pick(["Eighty five!", "Eight. Five."]);
    pitch = jitter(1.05, 0.05);
    rate = jitter(1.0, 0.05);
  } else if (turnTotal === 60) {
    scoreCall = pick(["Sixty!", "Six. Zero."]);
    pitch = jitter(1.05, 0.06);
    rate = jitter(1.0, 0.05);
  } else if (turnTotal === 45) {
    scoreCall = pick(["Forty five.", "Four. Five."]);
    pitch = jitter(0.98, 0.05);
  } else if (turnTotal === 26) {
    scoreCall = pick(["Twenty six.", "Bed and breakfast.", "Two. Six."]);
    pitch = jitter(0.95, 0.05);
    rate = jitter(0.95, 0.05);
  } else if (turnTotal === 0) {
    scoreCall = pick(["No score!", "No shot!", "Missed it!"]);
    pitch = jitter(0.8, 0.05);
    rate = jitter(0.85, 0.05);
  } else if (turnTotal < 20) {
    scoreCall = `${turnTotal}.`;
    pitch = jitter(0.9, 0.06);
    rate = jitter(0.95, 0.05);
  } else {
    scoreCall = `${turnTotal}.`;
    pitch = jitter(1.0, 0.07);
    rate = jitter(1.0, 0.05);
  }

  speak(`${scoreCall} ${playerName} requires ${remaining}.`, { pitch, rate });
}

function announceScorePL(
  playerName: string,
  turnTotal: number,
  remaining: number
): void {
  let scoreCall: string;
  let pitch = jitter(1.0, 0.05);
  let rate = jitter(1.0, 0.05);

  if (turnTotal === 180) {
    scoreCall = pick(["Sto osiemdziesiąt!", "Maksimum!"]);
    pitch = jitter(1.3, 0.1);
    rate = jitter(1.1, 0.08);
  } else if (turnTotal >= 140) {
    scoreCall = `${numberToPolishWords(turnTotal)}!`;
    pitch = jitter(1.2, 0.08);
    rate = jitter(1.05, 0.06);
  } else if (turnTotal >= 100) {
    scoreCall = `${numberToPolishWords(turnTotal)}!`;
    pitch = jitter(1.1, 0.06);
    rate = jitter(1.0, 0.05);
  } else if (turnTotal === 0) {
    scoreCall = pick(["Brak punktów!", "Żadnego!", "Nie trafi!"]);
    pitch = jitter(0.8, 0.05);
    rate = jitter(0.85, 0.05);
  } else if (turnTotal < 20) {
    scoreCall = `${numberToPolishWords(turnTotal)}.`;
    pitch = jitter(0.9, 0.06);
    rate = jitter(0.95, 0.05);
  } else {
    scoreCall = `${numberToPolishWords(turnTotal)}.`;
    pitch = jitter(1.0, 0.07);
    rate = jitter(1.0, 0.05);
  }

  speak(`${scoreCall} ${playerName} potrzebuje ${numberToPolishWords(remaining)}.`, { pitch, rate });
}

/**
 * Announces a bust (no score).
 */
export function announceBust(_playerName: string): void {
  if (language === "pl") {
    speak(pick(["Brak punktów!", "Przebicie!", "Spalony!"]), { pitch: jitter(0.8, 0.05), rate: jitter(0.85, 0.05) });
  } else {
    speak(pick(["No score!", "Bust!", "Busted!"]), { pitch: jitter(0.8, 0.05), rate: jitter(0.85, 0.05) });
  }
}

/**
 * Announces a checkout / match win.
 */
export function announceCheckout(playerName: string): void {
  if (language === "pl") {
    speak(
      pick([`Zamknięcie! ${playerName} wygrywa mecz!`, `${playerName}, strzał meczowy!`]),
      { pitch: jitter(1.3, 0.08), rate: jitter(0.8, 0.05) }
    );
  } else {
    speak(
      pick([`Game shot and the match! ${playerName}!`, `${playerName} wins! Game shot!`]),
      { pitch: jitter(1.3, 0.08), rate: jitter(0.8, 0.05) }
    );
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
