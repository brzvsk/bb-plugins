import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTableExpand } from "../expand";

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

function renderTable(): HTMLTableElement {
  document.body.innerHTML = `
    <div data-markdown-preview>
      <div class="my-2 flex justify-center">
        <div class="w-max max-w-full overflow-x-auto">
          <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>cell</td><td><a href="#x">link</a></td></tr></tbody></table>
        </div>
      </div>
    </div>`;
  return document.querySelector("table")!;
}

describe("startTableExpand", () => {
  let controller: AbortController;

  beforeEach(() => {
    // jsdom lacks the modal dialog API; model just the open state.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
    controller = new AbortController();
  });

  afterEach(() => {
    controller.abort();
    document.body.innerHTML = "";
  });

  it("tags markdown tables and adds one expand button", async () => {
    const table = renderTable();
    startTableExpand(controller.signal);
    await nextFrame();
    await nextFrame();
    expect(table.hasAttribute("data-te-table")).toBe(true);
    expect(document.querySelectorAll("[data-te-button]")).toHaveLength(1);
    const lastHeader = [...table.querySelectorAll("thead th")].at(-1)!;
    expect(lastHeader.querySelector("[data-te-button]")).not.toBeNull();
  });

  it("does nothing when the table itself is clicked", async () => {
    const table = renderTable();
    startTableExpand(controller.signal);
    await nextFrame();
    table.querySelector("td")!.click();
    table.querySelector("a")!.click();
    expect(document.querySelector("dialog[data-te-dialog]")).toBeNull();
    expect(table.hasAttribute("title")).toBe(false);
  });

  it("opens a copy of the table from the expand button", async () => {
    const table = renderTable();
    startTableExpand(controller.signal);
    await nextFrame();
    table.querySelector<HTMLButtonElement>("[data-te-button]")!.click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog[data-te-dialog]");
    expect(dialog?.hasAttribute("open")).toBe(true);
    const copy = dialog!.querySelector("table")!;
    expect(copy).not.toBe(table);
    expect(copy.textContent).toContain("cell");
    expect(copy.hasAttribute("data-te-table")).toBe(false);
  });

  it("labels the size and right-aligns number columns", async () => {
    document.body.innerHTML = `
      <div data-markdown-preview><div class="my-2 flex"><div class="overflow-x-auto">
        <table>
          <thead><tr><th>Region</th><th>p50</th><th>Rate</th></tr></thead>
          <tbody>
            <tr><td>us-east</td><td>42 ms</td><td>0.08%</td></tr>
            <tr><td>eu-west</td><td>1,204 ms</td><td>—</td></tr>
          </tbody>
        </table>
      </div></div></div>`;
    startTableExpand(controller.signal);
    await nextFrame();
    document.querySelector<HTMLButtonElement>("[data-te-button]")!.click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog[data-te-dialog]")!;
    expect(dialog.querySelector("[data-te-header]")?.textContent).toContain("2 rows × 3 columns");
    const numeric = (index: number) =>
      [...dialog.querySelectorAll("tr")].map((row) => (row as HTMLTableRowElement).cells[index].hasAttribute("data-te-numeric"));
    expect(numeric(0)).toEqual([false, false, false]);
    expect(numeric(1)).toEqual([true, true, true]);
    expect(numeric(2)).toEqual([true, true, true]);
  });

  it("closes on backdrop click and empties the dialog", async () => {
    const table = renderTable();
    startTableExpand(controller.signal);
    await nextFrame();
    table.querySelector<HTMLButtonElement>("[data-te-button]")!.click();
    const dialog = document.querySelector<HTMLDialogElement>("dialog[data-te-dialog]")!;
    expect(dialog.querySelector("[data-te-button]")).toBeNull();
    dialog.click();
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(dialog.childElementCount).toBe(0);
  });

  it("removes everything it added when aborted", async () => {
    const table = renderTable();
    startTableExpand(controller.signal);
    await nextFrame();
    table.querySelector<HTMLButtonElement>("[data-te-button]")!.click();
    controller.abort();
    expect(document.querySelector("dialog[data-te-dialog]")).toBeNull();
    expect(document.querySelector("[data-te-button]")).toBeNull();
    expect(document.querySelector("[data-te-cell]")).toBeNull();
    expect(table.hasAttribute("data-te-table")).toBe(false);
  });
});
