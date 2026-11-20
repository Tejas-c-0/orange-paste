const delay = document.getElementById("delay");
const toastBox = document.getElementById("toast");
const saved = document.getElementById("saved");

chrome.storage.sync.get({ delay: 10, toast: true }, (v) => {
  delay.value = v.delay;
  toastBox.checked = v.toast;
});

function save() {
  chrome.storage.sync.set(
    { delay: Math.max(0, Number(delay.value) || 0), toast: toastBox.checked },
    () => {
      saved.textContent = "Saved";
      setTimeout(() => (saved.textContent = ""), 1200);
    }
  );
}
delay.addEventListener("change", save);
toastBox.addEventListener("change", save);
