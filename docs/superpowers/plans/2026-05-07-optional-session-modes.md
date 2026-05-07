# Optional Session Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить единственную кнопку "Начать" на HomeScreen двумя отдельными кнопками — "Новые слова" и "Повторение" — чтобы пользователь сам выбирал режим сессии.

**Architecture:** Изменения только в трёх React-компонентах. `HomeScreen` получает два колбэка вместо одного и показывает две кнопки. `App.tsx` разделяет навигацию: после Learning → Home (не Quiz). `LearningScreen` получает кнопку `onExit` для прерывания.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite, Vitest

---

## Затронутые файлы

| Файл | Тип | Изменение |
|---|---|---|
| `src/screens/HomeScreen.tsx` | Modify | Props `onStartNew` + `onStartReview`, две кнопки, общий helper для стрика |
| `src/App.tsx` | Modify | Два колбэка, `onComplete` → `home`, новый `onExit` |
| `src/screens/LearningScreen.tsx` | Modify | Prop `onExit`, кнопка "← Выйти" в шапке |

**Не трогаем:** `session.ts`, `sm2.ts`, `db.ts`, `types.ts`, `words.json`

---

## Task 1: Обновить HomeScreen — два колбэка и две кнопки

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Шаг 1: Заменить Props интерфейс**

Открыть `src/screens/HomeScreen.tsx`. Строки 12–14 — заменить:

```ts
// было:
interface Props {
  onStartSession: (newWords: Word[], dueCards: Array<{ word: Word; card: CardProgress }>, reservePool: Word[]) => void
}

// стало:
interface Props {
  onStartNew: (newWords: Word[], reservePool: Word[]) => void
  onStartReview: (dueCards: Array<{ word: Word; card: CardProgress }>) => void
}
```

- [ ] **Шаг 2: Обновить деструктуризацию props**

Строка 16 — заменить:

```ts
// было:
export default function HomeScreen({ onStartSession }: Props) {

// стало:
export default function HomeScreen({ onStartNew, onStartReview }: Props) {
```

- [ ] **Шаг 3: Заменить handleStart на startSession**

Строки 36–57 — удалить `handleStart` целиком и вставить вместо него:

```ts
async function startSession(mode: 'new' | 'review') {
  if (!settings) return
  const all = await getAllProgress()
  const { newWords, dueCards, reservePool } = getSessionCards(allWords, all)

  const today = getTodayISO()
  let streak = settings.streak
  if (settings.lastStudyDate === '') {
    streak = 1
  } else {
    const yesterday = new Date(today + 'T00:00:00')
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    if (settings.lastStudyDate === yesterdayStr) {
      streak += 1
    } else if (settings.lastStudyDate !== today) {
      streak = 1
    }
  }
  await saveSettings({ ...settings, streak, lastStudyDate: today })

  if (mode === 'new') {
    onStartNew(newWords, reservePool)
  } else {
    onStartReview(dueCards)
  }
}
```

- [ ] **Шаг 4: Заменить кнопку в JSX**

Найти блок `<button onClick={handleStart} ...>` (строки 125–131) и заменить на:

```tsx
{newCount === 0 && dueCount === 0 ? (
  <button
    disabled
    className="w-full py-4 rounded-2xl font-bold text-lg bg-green-400 text-slate-900 opacity-40 cursor-not-allowed"
  >
    ✓ На сегодня готово
  </button>
) : (
  <div className="flex flex-col gap-3">
    {newCount > 0 && (
      <button
        onClick={() => startSession('new')}
        className="w-full py-4 rounded-2xl font-bold text-lg bg-green-400 text-slate-900 active:scale-95 transition-transform"
      >
        📖 Новые слова ({newCount})
      </button>
    )}
    {dueCount > 0 && (
      <button
        onClick={() => startSession('review')}
        className="w-full py-4 rounded-2xl font-bold text-lg bg-blue-500 text-white active:scale-95 transition-transform"
      >
        🔁 Повторение ({dueCount})
      </button>
    )}
  </div>
)}
```

- [ ] **Шаг 5: Убедиться что файл компилируется**

```bash
npm run build 2>&1 | head -30
```

Ожидаемый результат: ошибки в `App.tsx` (там ещё старый `onStartSession`) — это нормально, исправим в Task 2.

- [ ] **Шаг 6: Коммит**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: split HomeScreen into two session mode buttons"
```

---

## Task 2: Обновить App.tsx — навигация

**Files:**
- Modify: `src/App.tsx`

- [ ] **Шаг 1: Заменить колбэк у HomeScreen**

Найти блок `<HomeScreen onStartSession={...} />` (строки 41–54) и заменить на:

```tsx
<HomeScreen
  onStartNew={(newWords, reserve) => {
    setSessionNew(newWords)
    setReservePool(reserve)
    setScreen('learning')
  }}
  onStartReview={(dueCards) => {
    setSessionDue(dueCards)
    setScreen('quiz')
  }}
/>
```

- [ ] **Шаг 2: Обновить LearningScreen — onComplete и onExit**

Найти блок `<LearningScreen ...>` (строки 55–65) и заменить:

```tsx
<LearningScreen
  words={sessionNew}
  onGetReplacement={getReplacement}
  onComplete={() => setScreen('home')}
  onExit={() => setScreen('home')}
/>
```

`onExit` пока вызовет TypeScript-ошибку — это нормально, добавим prop в Task 3.

- [ ] **Шаг 3: Проверить сборку**

```bash
npm run build 2>&1 | head -30
```

Ожидаемый результат: только ошибка про `onExit` в `LearningScreen` (unknown prop). После Task 3 исчезнет.

- [ ] **Шаг 4: Коммит**

```bash
git add src/App.tsx
git commit -m "feat: update App navigation for separate session modes"
```

---

## Task 3: Добавить кнопку выхода в LearningScreen

**Files:**
- Modify: `src/screens/LearningScreen.tsx`

- [ ] **Шаг 1: Добавить onExit в Props**

Строки 6–10 — заменить:

```ts
// было:
interface Props {
  words: Word[]
  onGetReplacement: (skippedLevel: Word['level']) => Word | null
  onComplete: () => void
}

// стало:
interface Props {
  words: Word[]
  onGetReplacement: (skippedLevel: Word['level']) => Word | null
  onComplete: () => void
  onExit: () => void
}
```

- [ ] **Шаг 2: Деструктурировать onExit**

Строка 12 — заменить:

```ts
// было:
export default function LearningScreen({ words, onGetReplacement, onComplete }: Props) {

// стало:
export default function LearningScreen({ words, onGetReplacement, onComplete, onExit }: Props) {
```

- [ ] **Шаг 3: Заменить шапку экрана**

Строки 69–71 — заменить:

```tsx
// было:
<div className="text-slate-400 text-sm mt-4 mb-6">
  📖 Новое слово ({index + 1}/{localWords.length})
</div>

// стало:
<div className="flex items-center justify-between mt-4 mb-6">
  <button
    onClick={onExit}
    className="text-slate-500 text-sm active:text-slate-300 transition-colors px-1"
  >
    ← Выйти
  </button>
  <span className="text-slate-400 text-sm">
    📖 {index + 1}/{localWords.length}
  </span>
  <div className="w-12" />
</div>
```

- [ ] **Шаг 4: Убедиться что проект собирается без ошибок**

```bash
npm run build 2>&1 | head -30
```

Ожидаемый результат: `✓ built in ...` без TypeScript-ошибок.

- [ ] **Шаг 5: Запустить тесты**

```bash
npm test
```

Ожидаемый результат: все тесты проходят (тесты `sm2` и `session` не затронуты).

- [ ] **Шаг 6: Коммит**

```bash
git add src/screens/LearningScreen.tsx
git commit -m "feat: add exit button to LearningScreen"
```

---

## Task 4: Финальная проверка

**Files:** Только чтение

- [ ] **Шаг 1: Полная сборка и тесты**

```bash
npm run build && npm test
```

Ожидаемый результат: сборка без ошибок, все тесты зелёные.

- [ ] **Шаг 2: Проверить сценарии вручную**

Запустить dev-сервер:
```bash
npm run dev
```

Проверить:
1. Если есть и новые слова, и повторение — видны обе кнопки
2. Нажать "📖 Новые слова" → Learning screen
3. На Learning screen есть кнопка "← Выйти" → нажать → вернуться на Home
4. Обе кнопки всё ещё видны
5. Нажать "🔁 Повторение" → Quiz screen → Results → Home
6. Если нет ни новых, ни повторений — "✓ На сегодня готово"
7. Стрик не удваивается если нажать обе кнопки за день
