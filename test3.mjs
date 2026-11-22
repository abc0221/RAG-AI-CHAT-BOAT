import "dotenv/config";
const key = process.env.GEMINI_API_KEY;
const base = "https://generativelanguage.googleapis.com/v1beta/";
const list = await (await fetch(base + "models?pageSize=200&key=" + key)).json();
const skip = /tts|lyria|robotics|computer-use|antigravity|deep-research|embedding|image|audio|live|veo|imagen/i;
const names = list.models
  .filter(m => m.supportedGenerationMethods.includes("generateContent") && !skip.test(m.name))
  .map(m => m.name);
for (const name of names) {
  try {
    const r = await fetch(`${base}${name}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Say hello in one word." }] }] })
    });
    console.log(name, "->", r.status);
  } catch (e) { console.log(name, "-> failed"); }
}