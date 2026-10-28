// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChildThreadDisplay } from './label';
import {
  childRowThreadIds,
  decorate,
  LABEL_ATTR,
  LABEL_CLASS,
  LEVEL_CLASS,
  NAME_CLASS,
  undecorate,
} from './rows';

const linkRow = (id: string, title: string) => `
  <li class="text-xs">
    <a class="flex w-full min-w-0 items-center gap-2 py-0.5" href="/projects/proj_1/threads/${id}">
      <span class="size-3.5"></span>
      <span class="bb-thread-title flex-1"><span class="truncate">${title}</span></span>
    </a>
  </li>`;

const questionRow = (id: string, title: string, question: string) => `
  <li class="text-xs">
    <button type="button" data-child-question-row="${id}" class="flex w-full min-w-0 items-center gap-2 py-0.5">
      <span class="size-3.5"></span>
      <span class="flex min-w-0 flex-1 items-baseline"><span class="truncate">${title}</span>: <span>${question}</span></span>
    </button>
  </li>`;

const banner = (...rows: string[]) => `
  <section aria-label="Child threads">
    <button>Active child threads</button>
    <section role="region">
      <div class="overflow-hidden">
        <ul class="max-h-40 px-3">${rows.join('')}</ul>
        <div>Collapse</div>
      </div>
    </section>
  </section>`;

const display = (
  model: string,
  modelLabel: string,
  reasoningLevel: string | null,
  reasoningLabel: string | null,
): ChildThreadDisplay => ({ model, modelLabel, reasoningLevel, reasoningLabel });

const labels = new Map([
  ['thr_one', display('opencode-go/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'high', 'High')],
  ['thr_two', display('claude-opus-5', 'Claude Opus 5', 'low', 'Low')],
  ['thr_question', display('gpt-5.6-sol', 'GPT 5.6 Sol', 'xhigh', 'Extra High')],
]);

const labelIn = (selector: string) => document.querySelector(selector)?.querySelector(`.${LABEL_CLASS}`) ?? null;
const partIn = (selector: string, part: string) =>
  document.querySelector(selector)?.querySelector(`.${LABEL_CLASS} > .${part}`) ?? null;

beforeEach(() => {
  document.body.innerHTML = `
    <nav><a href="/projects/proj_1/threads/thr_nav">Sidebar row</a></nav>
    ${banner(linkRow('thr_one', 'First'), linkRow('thr_two', 'Second'), questionRow('thr_question', 'Needs input', 'Which file?'))}`;
});

describe('child thread model labels', () => {
  it('collects banner row ids from links and question buttons only', () => {
    expect(childRowThreadIds(document)).toEqual(['thr_one', 'thr_two', 'thr_question']);
  });

  it('labels every child with its own readable model and a separate visible level', () => {
    decorate(document, labels);
    decorate(document, labels);

    expect(document.querySelectorAll(`.${LABEL_CLASS}`)).toHaveLength(3);
    expect(labelIn('a[href="/projects/proj_1/threads/thr_one"]')?.textContent).toBe('DeepSeek V4.1 Flash·High');
    expect(partIn('a[href="/projects/proj_1/threads/thr_one"]', NAME_CLASS)?.textContent).toBe('DeepSeek V4.1 Flash');
    expect(partIn('a[href="/projects/proj_1/threads/thr_one"]', LEVEL_CLASS)?.textContent).toBe('High');
    expect(labelIn('a[href="/projects/proj_1/threads/thr_two"]')?.textContent).toBe('Claude Opus 5·Low');
    expect(labelIn('button[data-child-question-row="thr_question"]')?.getAttribute('title')).toBe(
      'Model: gpt-5.6-sol · Reasoning: xhigh',
    );
    expect(document.querySelector('a[href="/projects/proj_1/threads/thr_one"]')?.getAttribute('href')).toBe(
      '/projects/proj_1/threads/thr_one',
    );
    expect(document.querySelector('button[data-child-question-row="thr_question"]')?.tagName).toBe('BUTTON');
  });

  it('keeps the level span when the model label is long', () => {
    decorate(
      document,
      new Map([['thr_one', display('very-long-provider/very-long-model-id', 'Very Long Provider Model Name That Should Truncate', 'high', 'High')]]),
    );
    const label = labelIn('a[href="/projects/proj_1/threads/thr_one"]');
    expect(label?.querySelector(`.${NAME_CLASS}`)?.textContent).toBe('Very Long Provider Model Name That Should Truncate');
    expect(label?.querySelector(`.${LEVEL_CLASS}`)?.textContent).toBe('High');
    expect(label?.querySelector(`.${LEVEL_CLASS}`)?.hasAttribute('hidden')).toBe(false);
  });

  it('shows no level separator when only the model is known', () => {
    decorate(document, new Map([['thr_one', display('gpt-5.6-sol', 'GPT 5.6 Sol', null, null)]]));
    const label = labelIn('a[href="/projects/proj_1/threads/thr_one"]');
    expect(label?.textContent).toBe('GPT 5.6 Sol·');
    expect(label?.querySelector(`.${LEVEL_CLASS}`)?.hasAttribute('hidden')).toBe(true);
    expect(label?.querySelector(`.${LEVEL_CLASS}`)?.textContent).toBe('');
  });

  it('shows no label for unknown metadata and removes a label when metadata disappears', () => {
    decorate(document, labels);
    decorate(document, new Map([['thr_two', labels.get('thr_two')!]]));

    expect(labelIn('a[href="/projects/proj_1/threads/thr_one"]')).toBeNull();
    expect(labelIn('button[data-child-question-row="thr_question"]')).toBeNull();
    expect(labelIn('a[href="/projects/proj_1/threads/thr_two"]')?.textContent).toBe('Claude Opus 5·Low');
  });

  it('leaves rows outside the native child banner alone', () => {
    decorate(document, new Map([['thr_nav', display('gpt-5.6-sol', 'GPT 5.6 Sol', 'high', 'High')]]));
    expect(document.querySelector('nav')?.querySelector(`.${LABEL_CLASS}`)).toBeNull();
  });

  it('cleans up added labels without touching navigation', () => {
    decorate(document, labels);
    undecorate(document);
    expect(document.querySelector(`[${LABEL_ATTR}]`)).toBeNull();
    expect(document.querySelector('a[href="/projects/proj_1/threads/thr_one"]')?.getAttribute('href')).toBe(
      '/projects/proj_1/threads/thr_one',
    );
    expect(document.querySelector('button[data-child-question-row="thr_question"]')).not.toBeNull();
  });
});
