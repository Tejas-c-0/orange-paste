// Page (MAIN) world: finds the editor and inserts text using the best method available.
(function () {
  let cancelled = false;
  let busy = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function deepActive() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }

  // ---- editor detection: returns { kind, api } ----
  function findTarget() {
    // Monaco (global API)
    try {
      const m = window.monaco;
      if (m && m.editor && m.editor.getEditors) {
        const eds = m.editor.getEditors();
        if (eds.length) {
          const ed = eds.find((x) => x.hasTextFocus && x.hasTextFocus()) || eds[0];
          ed.focus();
          return { kind: "monaco", api: ed };
        }
      }
    } catch (e) {}

    let el = deepActive();
    if (!el || el === document.body) {
      const ta = document.querySelector(".monaco-editor textarea, .ace_editor textarea, .CodeMirror textarea");
      if (ta) { ta.focus(); el = ta; }
    }
    if (!el) return null;

    try { // Ace
      const host = el.closest && el.closest(".ace_editor");
      if (host && host.env && host.env.editor) return { kind: "ace", api: host.env.editor };
    } catch (e) {}
    try { // CodeMirror 5
      const host = el.closest && el.closest(".CodeMirror");
      if (host && host.CodeMirror) return { kind: "cm5", api: host.CodeMirror };
    } catch (e) {}
    try { // CodeMirror 6
      const host = el.closest && el.closest(".cm-editor");
      const c = host && host.querySelector(".cm-content");
      if (c && c.cmView && c.cmView.view) return { kind: "cm6", api: c.cmView.view };
    } catch (e) {}

    if ((el.tagName === "TEXTAREA" || el.tagName === "INPUT") && !(el.closest && el.closest(".monaco-editor")))
      return { kind: "input", api: el };

    return { kind: "exec", api: el };
  }

  function insertChunk(t, text) {
    const a = t.api;
    switch (t.kind) {
      case "monaco": {
        const sels = a.getSelections() || [a.getSelection()];
        a.executeEdits("autotyper", sels.map((s) => ({ range: s, text, forceMoveMarkers: true })));
        a.revealPosition && a.revealPosition(a.getPosition());
        return true;
      }
      case "ace": {
        const pos = a.session.replace(a.getSelectionRange(), text);
        a.moveCursorToPosition(pos);
        a.clearSelection();
        return true;
      }
      case "cm5":
        a.replaceSelection(text, "end");
        return true;
      case "cm6":
        a.dispatch(a.state.update(a.state.replaceSelection(text), { scrollIntoView: true }));
        return true;
      case "input": {
        const s = a.selectionStart, e = a.selectionEnd;
        a.setRangeText(text, s, e, "end");
        a.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      default:
        return document.execCommand("insertText", false, text);
    }
  }

  function report(ok, msg, reason) {
    window.postMessage({ source: "autotyper-result", ok, msg, reason }, "*");
  }

  async function run(text, mode, delay) {
    if (busy) return report(false, "", "already typing - press Esc to stop");
    text = text.replace(/\r\n?/g, "\n");
    const t = findTarget();
    if (!t) return report(false, "", "no editor found - click inside the editor first");
    busy = true;
    cancelled = false;
    try {
      if (t.kind === "monaco") t.api.pushUndoStop();
      if (mode === "instant") {
        if (!insertChunk(t, text)) return report(false, "", "editor refused the insert");
        report(true, "inserted (" + t.kind + ")");
      } else {
        const chars = Array.from(text);
        const d = Math.max(0, Number(delay) || 0);
        for (let i = 0; i < chars.length; i++) {
          if (cancelled) return report(true, "stopped at " + i + "/" + chars.length);
          if (!insertChunk(t, chars[i])) return report(false, "", "editor refused the insert");
          if (d) await sleep(d);
          else if (i % 50 === 0) await sleep(0);
        }
        report(true, "typed " + chars.length + " chars (" + t.kind + ")");
      }
      if (t.kind === "monaco") t.api.pushUndoStop();
    } catch (err) {
      report(false, "", String(err));
    } finally {
      busy = false;
    }
  }

  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (ev.source !== window || !d || d.source !== "autotyper") return;
    if (d.type === "cancel") cancelled = true;
    else if (d.type === "insert") run(d.text, d.mode, d.delay);
  });
})();
