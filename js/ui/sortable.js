// Drag-to-reorder for a list of sibling elements. Used by both the engine
// checklist (vertical) and the pin row (horizontal).
//
// onDrop(from, to) receives indexes into the container's item list, already
// adjusted so that `to` is the item's final resting index.

export function sortable(container, selector, onDrop, axis = "y") {
  let dragging = null;

  const items = () => [...container.querySelectorAll(selector)];

  function clearMarks() {
    for (const el of items()) el.classList.remove("drop-before", "drop-after");
  }

  container.addEventListener("dragstart", (e) => {
    const item = e.target.closest(selector);
    if (!item || !container.contains(item)) return;
    dragging = item;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag without payload
    e.dataTransfer.setData("text/plain", "");
  });

  container.addEventListener("dragend", () => {
    dragging?.classList.remove("dragging");
    dragging = null;
    clearMarks();
  });

  container.addEventListener("dragover", (e) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const over = e.target.closest(selector);
    clearMarks();
    if (!over || over === dragging) return;
    const box = over.getBoundingClientRect();
    const before = axis === "y"
      ? e.clientY < box.top + box.height / 2
      : e.clientX < box.left + box.width / 2;
    over.classList.add(before ? "drop-before" : "drop-after");
  });

  container.addEventListener("drop", (e) => {
    if (!dragging) return;
    e.preventDefault();
    const over = e.target.closest(selector);
    clearMarks();
    if (!over || over === dragging) return;

    const list = items();
    const from = list.indexOf(dragging);
    const overIndex = list.indexOf(over);
    const box = over.getBoundingClientRect();
    const before = axis === "y"
      ? e.clientY < box.top + box.height / 2
      : e.clientX < box.left + box.width / 2;

    let to = before ? overIndex : overIndex + 1;
    if (from < to) to -= 1;
    if (from !== to) onDrop(from, to);
  });
}

export function move(list, from, to) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
