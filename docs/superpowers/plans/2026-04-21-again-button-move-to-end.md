# "Ещё раз" — перенос слова в конец очереди: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить кнопку "Ещё раз" в LearningScreen — перемещать текущее слово в конец массива, показывая следующее слово.

**Architecture:** Заменить no-op `setIndex(index)` на `handleAgain`, которая переупорядочивает `localWords` через slice/concat. Индекс не меняется — следующее слово само оказывается на текущей позиции.

**Tech Stack:** React 18, TypeScript, Vitest

---

### Task 1: Написать тест для логики handleAgain

**Files:**
- Modify: `src/lib/session.test.ts`

- [ ] **Step 1: Добавить тест moveWordToEnd в конец файла `src/lib/session.test.ts`**

```ts
describe('moveWordToEnd', () => {
  function moveWordToEnd(words: string[], index: number): string[] {
    return [...words.slice(0, index), ...words.slice(index + 1), words[index]]
  }

  it('moves word from middle to end', () => {
    const result = moveWordToEnd(['a', 'b', 'c', 'd'], 1)
    expect(result).toEqual(['a', 'c', 'd', 'b'])
  })

  it('moves last word — array stays the same', () => {
    const result = moveWordToEnd(['a', 'b', 'c'], 2)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('moves single word — array stays the same', () => {
    const result = moveWordToEnd(['a'], 0)
    expect(result).toEqual(['a'])
  })

  it('moves first word to end', () => {
    const result = moveWordToEnd(['a', 'b', 'c'], 0)
    expect(result).toEqual(['b', 'c', 'a'])
  })
})
```

- [ ] **Step 2: Запустить тесты — убедиться, что они проходят**

```bash
npm test
```

Ожидаемый результат: все тесты PASS (включая новые — они тестируют встроенную JS-логику, должны пройти сразу).

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.test.ts
git commit -m "test: add moveWordToEnd logic tests"
```

---

### Task 2: Реализовать handleAgain в LearningScreen

**Files:**
- Modify: `src/screens/LearningScreen.tsx`

- [ ] **Step 1: Добавить функцию `handleAgain` после функции `advance` (строка ~29)**

Найти в файле блок:
```ts
  async function handleRemember() {
```

Вставить перед ним:
```ts
  function handleAgain() {
    const updatedWords = [
      ...localWords.slice(0, index),
      ...localWords.slice(index + 1),
      word,
    ]
    setLocalWords(updatedWords)
  }
```

- [ ] **Step 2: Заменить onClick кнопки "Ещё раз"**

Найти:
```tsx
        <button
          onClick={() => setIndex(index)}
          className="py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium active:scale-95 transition-transform"
        >
          ↩️ Ещё раз
        </button>
```

Заменить на:
```tsx
        <button
          onClick={handleAgain}
          className="py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium active:scale-95 transition-transform"
        >
          ↩️ Ещё раз
        </button>
```

- [ ] **Step 3: Запустить тесты**

```bash
npm test
```

Ожидаемый результат: все тесты PASS.

- [ ] **Step 4: Проверить сборку**

```bash
npm run build
```

Ожидаемый результат: сборка завершается без TypeScript-ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LearningScreen.tsx
git commit -m "fix: Ещё раз now moves word to end of learning queue"
```
