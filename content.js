// Isolated world: hotkeys, clipboard read, settings, toasts.
let settings = { delay: 10, toast: true };
try {
  chrome.storage.sync.get(settings, (v) => { if (v) settings = Object.assign(settings, v); });
  chrome.storage.onChanged.addListener((ch) => {
    for (const k in ch) settings[k] = ch[k].newValue;
  });
} catch (e) {}

function toast(msg, bad) {
  if (!bad && !settings.toast) return;
  try {
    const t = document.createElement("div");
    t.textContent = "AutoTyper: " + msg;
    t.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:8px 12px;" +
      "border-radius:6px;font:13px sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);" +
      "background:" + (bad ? "#c62828" : "#2e7d32");
    (document.documentElement || document.body).appendChild(t);
    setTimeout(() => t.remove(), 2500);
  } catch (e) {}
}

async function readClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (t) return t;
  } catch (e) {}
  // Fallback: hidden textarea + execCommand('paste')
  const prev = document.activeElement;
  const ta = document.createElement("textarea");
  ta.style.cssText = "position:fixed;top:-1000px;opacity:0;";
  document.documentElement.appendChild(ta);
  ta.focus();
  let text = "";
  try { if (document.execCommand("paste")) text = ta.value; } catch (e) {}
  ta.remove();
  if (prev && prev.focus) prev.focus();
  return text;
}

window.addEventListener(
  "keydown",
  async (e) => {
    if (e.key === "Escape") {
      window.postMessage({ source: "autotyper", type: "cancel" }, "*");
      return;
    }
    if (e.altKey && !e.ctrlKey && e.code === "KeyV") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const typing = e.shiftKey; // Alt+Shift+V = typing mode
      const text = await readClipboard();
      if (!text) return toast("clipboard empty or blocked", true);
      window.postMessage(
        { source: "autotyper", type: "insert", text, mode: typing ? "type" : "instant", delay: settings.delay },
        "*"
      );
    }
  },
  true
);

window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (ev.source !== window || !d || d.source !== "autotyper-result") return;
  toast(d.ok ? d.msg : "could not insert: " + d.reason, !d.ok);
});
