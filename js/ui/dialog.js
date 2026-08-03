// One <dialog> reused for every "add or edit a thing" flow. Resolves with the
// trimmed field values, or null if the person backed out.

const dlg = document.getElementById("dlg");
const form = document.getElementById("dlg-form");
const titleEl = document.getElementById("dlg-title");
const fieldsEl = document.getElementById("dlg-fields");
const errorEl = document.getElementById("dlg-error");
const okBtn = document.getElementById("dlg-ok");

document.getElementById("dlg-cancel").addEventListener("click", () => dlg.close());

export function ask({ title, fields, submit = "Save", validate }) {
  return new Promise((resolve) => {
    titleEl.textContent = title;
    okBtn.textContent = submit;
    errorEl.hidden = true;
    fieldsEl.replaceChildren();

    const inputs = new Map();
    for (const f of fields) {
      const wrap = document.createElement("div");
      wrap.className = "dlg-field";

      const label = document.createElement("label");
      label.textContent = f.label;
      label.htmlFor = `dlg-${f.key}`;

      const input = document.createElement("input");
      input.id = `dlg-${f.key}`;
      input.type = f.type || "text";
      input.value = f.value || "";
      input.placeholder = f.placeholder || "";
      input.spellcheck = false;
      if (f.mono) input.classList.add("mono");

      wrap.append(label, input);
      if (f.hint) {
        const hint = document.createElement("p");
        hint.className = "dlg-hint";
        hint.textContent = f.hint;
        wrap.append(hint);
      }
      fieldsEl.append(wrap);
      inputs.set(f.key, input);
    }

    let result = null;

    function onSubmit(e) {
      const values = {};
      for (const [k, input] of inputs) values[k] = input.value.trim();
      const message = validate ? validate(values) : null;
      if (message) {
        e.preventDefault();
        errorEl.textContent = message;
        errorEl.hidden = false;
        return;
      }
      result = values;
    }

    function onClose() {
      form.removeEventListener("submit", onSubmit);
      resolve(result);
    }

    form.addEventListener("submit", onSubmit);
    dlg.addEventListener("close", onClose, { once: true });
    dlg.showModal();
    inputs.values().next().value?.focus();
  });
}
