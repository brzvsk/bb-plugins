// Open a markdown table in the timeline full width in a modal <dialog> from
// its corner expand button; clicks on the table itself do nothing. Fork of
// steveafrost/bb-plugin-table-expand v0.1.1. bb renders markdown tables as
//   [data-markdown-preview] div.my-2.flex > div.overflow-x-auto > table
// We tag each such table, show a small expand button on hover, and open a
// clone of the table in a top-layer dialog from it (Esc/backdrop closes).

const TABLE = "[data-markdown-preview] div.overflow-x-auto > table";
const TAGGED = "data-te-table";
const BUTTON = "data-te-button";

// A cell reads as a number: optional sign/currency, digits, optional unit.
const NUMERIC = /^[-+−]?[$€£¥]?\s?\d[\d,.\s]*\s?(%|[a-zA-Zµ]{1,3}(\/[a-z]{1,3})?|x|×)?$/;

// Right-align columns whose body cells are all numbers, so digits line up.
function markNumericColumns(table: HTMLTableElement): void {
  const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")];
  const columns = Math.max(0, ...rows.map((row) => row.cells.length));
  for (let index = 0; index < columns; index++) {
    const cells = rows.map((row) => row.cells[index]).filter((cell): cell is HTMLTableCellElement => !!cell);
    const values = cells.map((cell) => cell.textContent?.trim() ?? "").filter((text) => text && text !== "-" && text !== "—");
    if (values.length === 0 || !values.every((text) => NUMERIC.test(text))) continue;
    for (const cell of cells) cell.setAttribute("data-te-numeric", "");
    table.querySelectorAll<HTMLTableRowElement>("thead tr").forEach((row) => row.cells[index]?.setAttribute("data-te-numeric", ""));
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function startTableExpand(signal: AbortSignal): () => void {
  let dialog: HTMLDialogElement | null = null;
  let frame: number | null = null;

  const close = () => dialog?.close();

  const open = (table: HTMLTableElement) => {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.setAttribute("data-te-dialog", "");
      dialog.setAttribute("aria-label", "Table");
      dialog.addEventListener("click", (event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === dialog) close();
      });
      dialog.addEventListener("close", () => dialog?.replaceChildren());
      document.body.appendChild(dialog);
    }
    const copy = table.cloneNode(true) as HTMLTableElement;
    copy.removeAttribute(TAGGED);
    copy.querySelectorAll(`[${BUTTON}]`).forEach((el) => el.remove());
    copy.querySelectorAll("[data-te-cell]").forEach((el) => el.removeAttribute("data-te-cell"));
    markNumericColumns(copy);

    const rowCount = copy.querySelectorAll("tbody tr").length;
    const columnCount = Math.max(0, ...[...copy.rows].map((row) => row.cells.length));

    const header = document.createElement("div");
    header.setAttribute("data-te-header", "");
    const label = document.createElement("span");
    label.textContent = `${plural(rowCount, "row")} × ${plural(columnCount, "column")}`;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("data-te-close", "");
    closeButton.setAttribute("aria-label", "Close table");
    closeButton.title = "Close (Esc)";
    closeButton.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeButton.addEventListener("click", close);
    header.append(label, closeButton);

    const scroller = document.createElement("div");
    scroller.setAttribute("data-te-scroller", "");
    // Focusable so arrow keys and Page Up/Down scroll the table.
    scroller.tabIndex = -1;
    scroller.appendChild(copy);

    dialog.replaceChildren(header, scroller);
    dialog.showModal();
    scroller.focus({ preventScroll: true });
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>(`[${BUTTON}]`);
    const table = button?.closest<HTMLTableElement>(`table[${TAGGED}]`);
    if (!table) return;
    event.preventDefault();
    event.stopPropagation();
    open(table);
  };

  const tag = () => {
    frame = null;
    for (const table of document.querySelectorAll<HTMLTableElement>(TABLE)) {
      if (table.hasAttribute(TAGGED) || table.closest("[data-te-dialog]")) continue;
      table.setAttribute(TAGGED, "");
      // The button lives in the last header cell, which reserves padding for
      // it, so it never covers header text.
      const row = table.tHead?.rows[0] ?? table.rows[0];
      const cell = row?.cells[row.cells.length - 1];
      if (!cell || cell.querySelector(`[${BUTTON}]`)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(BUTTON, "");
      button.setAttribute("aria-label", "Expand table");
      button.title = "Expand table";
      button.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
      cell.setAttribute("data-te-cell", "");
      cell.appendChild(button);
    }
  };

  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(tag);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", onClick, true);
  schedule();

  const dispose = () => {
    observer.disconnect();
    document.removeEventListener("click", onClick, true);
    if (frame !== null) cancelAnimationFrame(frame);
    dialog?.close();
    dialog?.remove();
    dialog = null;
    for (const el of document.querySelectorAll(`[${BUTTON}]`)) el.remove();
    for (const el of document.querySelectorAll(`[data-te-cell]`)) el.removeAttribute("data-te-cell");
    for (const el of document.querySelectorAll(`table[${TAGGED}]`)) el.removeAttribute(TAGGED);
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
