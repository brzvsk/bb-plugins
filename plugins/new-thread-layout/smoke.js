// Live smoke check for Project Home, run in a headless bb browser-automation session:
//   S=$(bb browser-automation open --backend local --headless --machine <host> --json | jq -r .id)
//   bb browser-automation run "$S" --timeout 120s --script "$(cat smoke.js)"
//   bb browser-automation close "$S"
// Optional globals before the body: BASE (bb web origin), PROJECT_ID (a project with threads).
// Read-only: it clicks navigation only (Home, a project chip, the Last week tab, Escape).
// Returns { ok, checks: [{ name, ok, detail }] }; each check names the bb hook it depends on.

const base = typeof BASE === "string" ? BASE : "http://127.0.0.1:38886";
const page = await browser.getPage("main");
const wait = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
const q = (sel) => page.evaluate(s => !!document.querySelector(s), sel);

await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await wait(6000);

// Home: bb's personal project selected through the plugin's own Home link.
check("top bar crumb (useComposeTopBar)", await q(".ph-topbar .ph-crumb-row .ph-home"));
await page.evaluate(() => document.querySelector(".ph-topbar .ph-home")?.click());
await wait(3000);
const home = await page.evaluate(() => {
  const picker = document.querySelector('[data-testid="root-compose-compact-composer"] [data-promptbox-project-control]');
  return {
    board: !!document.querySelector("[data-ph-board]"),
    homeLabel: document.querySelector(".ph-topbar .ph-home")?.textContent?.trim() ?? "",
    picker: !!picker,
    pickerHidden: picker ? getComputedStyle(picker).display === "none" : false,
    chips: [...document.querySelectorAll(".ph-projects .ph-project-tab")].map(c => c.textContent.trim()),
    groups: [...document.querySelectorAll(".ph-board .ph-group-title")].map(g => g.textContent.trim()).slice(0, 8),
    tabs: [...document.querySelectorAll(".ph-autos .ph-tab")].map(t => t.textContent.trim()),
  };
});
check("home board (homepageSection)", home.board);
check("home label reads Home", home.homeLabel.startsWith("Home"), home.homeLabel);
check("composer project picker found ([data-promptbox-project-control])", home.picker);
check("picker hidden at home (:has rule)", home.pickerHidden);
check("Home + project chips under the composer", home.chips[0] === "Home" && home.chips.length > 1, home.chips.join(" | "));
check("Scheduled / Last week tabs", home.tabs.length === 2, home.tabs.join(" | "));

// Last week opens over the lists and Escape folds it.
await page.evaluate(() => [...document.querySelectorAll(".ph-autos .ph-tab")].find(b => /Last week/.test(b.textContent))?.click());
await wait(500);
const overlayOpen = await q(".ph-autos[data-ph-overlay]");
await page.keyboard.press("Escape");
await wait(300);
const overlayClosed = !(await q(".ph-autos[data-ph-overlay]"));
check("Last week overlay opens and Escape closes", overlayOpen && overlayClosed, `open=${overlayOpen} closed=${overlayClosed}`);

// Into a project in place: the board stays mounted (no bb skeleton) and bb's own row returns.
const switched = await page.evaluate(async () => {
  const chip = [...document.querySelectorAll(".ph-projects .ph-project-tab")].find(c => !c.hasAttribute("aria-current"));
  if (!chip) return { error: "no project chip" };
  const name = chip.textContent.trim();
  chip.click();
  let lostBoard = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    if (!document.querySelector("[data-ph-board]")) lostBoard = true;
    await new Promise(r => setTimeout(r, 20));
  }
  const picker = document.querySelector('[data-testid="root-compose-compact-composer"] [data-promptbox-project-control]');
  return {
    name,
    lostBoard,
    crumb: document.querySelector(".ph-topbar .ph-crumb-name")?.textContent?.trim() ?? "",
    pickerShown: picker ? getComputedStyle(picker).display !== "none" : false,
    chips: document.querySelectorAll(".ph-projects .ph-project-tab").length,
    rows: document.querySelectorAll("a.ph-row").length,
  };
});
check("project switch in place (composer.setSelection)", !switched.error && !switched.lostBoard, JSON.stringify(switched));
check("project crumb in top bar", !!switched.crumb, switched.crumb);
check("bb's own project row back in a project", switched.pickerShown && switched.chips === 0);

// A thread page: the overlay's header crumb (app-page-header-content-row) leads back without a skeleton.
const threadHref = await page.evaluate(() => document.querySelector("a.ph-row")?.getAttribute("href") ?? null);
if (threadHref) {
  await page.goto(base + threadHref, { waitUntil: "domcontentloaded" });
  await wait(6000);
  const header = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="app-page-header-content-row"] .ph-crumb-row');
    return row ? row.textContent.replace(/\s+/g, " ").trim() : "";
  });
  check("thread header crumb (app-page-header-content-row)", header.startsWith("Home"), header);
  const back = await page.evaluate(async () => {
    document.querySelector('[data-testid="app-page-header-content-row"] a.ph-crumb-link')?.click();
    let skeleton = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) {
      if (document.querySelector("[class*=skeleton i], .animate-pulse")) skeleton = true;
      if (document.querySelector("[data-ph-board]")) break;
      await new Promise(r => setTimeout(r, 20));
    }
    return { board: !!document.querySelector("[data-ph-board]"), skeleton };
  });
  check("thread → project home without skeleton (navigate.toCompose)", back.board && !back.skeleton, JSON.stringify(back));
} else {
  check("thread header crumb (app-page-header-content-row)", false, "no thread row to open");
}

return { ok: checks.every(c => c.ok), checks };
