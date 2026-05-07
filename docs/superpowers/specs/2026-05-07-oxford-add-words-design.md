# Дизайн: наполнение words.json из Oxford5000

**Дата:** 2026-05-07  
**Статус:** Approved

## Проблема

Текущий скилл `/add-words` заставляет Claude придумывать слова из головы. Это даёт непредсказуемое качество, возможные дубликаты и лишнюю нагрузку на контекст. В репозитории уже лежит `src/data/Oxford5000.json` (~5000 слов с транскрипцией, определениями и примерами) — логичнее брать слова оттуда.

## Решение

Модифицировать `scripts/add-words.mjs` для двухфазной работы: скрипт сам выбирает слова из Oxford, Claude только обогащает их (перевод + второй пример + переводы). Прогресс обработки Oxford отслеживается прямо в `Oxford5000.json` через поле `status`.

---

## Секция 1 — Общий поток

```
[Claude] node scripts/add-words.mjs B2 20   ← SELECT фаза
         ↓ EXIT 3 (NEED_ENRICHMENT)
[Claude] читает pending-words.json, заполняет 4 поля у каждого слова
[Claude] node scripts/add-words.mjs          ← COMMIT фаза (без аргументов)
         ↓ EXIT 0 (OK)
[Claude] сообщает результат пользователю
```

**SELECT фаза** (первый запуск с аргументами):
1. Читает `Oxford5000.json`, фильтрует нужный уровень (`cefr === level.toLowerCase()`), берёт только записи без поля `status`
2. Случайно перемешивает (shuffle), итерирует пока не наберёт N слов
3. Слова с неподдерживаемым `type` (`"indefinite article"`, `"number"`, `"exclamation"`) — помечает `status: "existing"`, пропускает
4. Слова уже присутствующие в `words.json` (case-insensitive) — помечает `status: "existing"`, пропускает
5. Записывает обновлённый `Oxford5000.json` (новые `"existing"`)
6. Записывает `pending-words.json` с Oxford-данными и пустыми полями для Claude
7. Выходит с кодом **3**

**COMMIT фаза** (второй запуск без аргументов):
1. Читает обогащённый `pending-words.json`, валидирует что `phase === "commit"` и все 4 поля заполнены
2. Назначает ID каждому слову, добавляет в `words.json`
3. Помечает каждое слово в `Oxford5000.json` как `status: "added"`
4. Обновляет `CLAUDE.md` (счётчики)
5. Выходит с кодом **0**

---

## Секция 2 — Структура `pending-words.json`

После SELECT-фазы:
```json
{
  "level": "B2",
  "requested": 20,
  "phase": "enrichment",
  "words": [
    {
      "oxfordIndex": "1",
      "word": "abandon",
      "transcription": "/əˈbændən/",
      "partOfSpeech": "verb",
      "level": "B2",
      "definition": "to leave somebody with no intention of returning",
      "example1": "The baby had been abandoned by its mother.",
      "translation": "",
      "example1_ru": "",
      "example2": "",
      "example2_ru": ""
    }
  ]
}
```

После обогащения Claude меняет `phase` на `"commit"` и заполняет пустые поля.

**Поля только для внутреннего использования** (в `words.json` не попадают):
- `oxfordIndex` — индекс в Oxford5000.json, нужен скрипту для проставления `"added"`
- `definition` — контекст для Claude при написании перевода и второго примера

**Структура `words.json` не меняется** — добавляются только поля `word`, `translation`, `transcription`, `partOfSpeech`, `level`, `example1`, `example1_ru`, `example2`, `example2_ru` (плюс `id` от скрипта).

---

## Секция 3 — Статусы в `Oxford5000.json`

Поле `status` дописывается прямо в существующие записи:

| `status` | Когда проставляется | Кто |
|---|---|---|
| *(поле отсутствует)* | Изначально | — |
| `"existing"` | Слово уже есть в `words.json` или тип неподдерживаемый | SELECT-фаза |
| `"added"` | Слово успешно добавлено в нашу базу | COMMIT-фаза |

Скрипт при выборке берёт только записи **без поля `status`** — одно слово никогда не обрабатывается дважды.

---

## Секция 4 — Логика скрипта `add-words.mjs`

Фаза определяется по наличию аргументов:
```
node scripts/add-words.mjs B2 20  → SELECT
node scripts/add-words.mjs        → COMMIT
```

### SELECT (псевдокод)
```
читаем Oxford5000.json
фильтруем: cefr === level.toLowerCase() && !entry.status
shuffle(candidates)

pool = []
while pool.length < requested && candidates.length > 0:
  candidate = candidates.pop()
  if type не маппится → помечаем "existing", continue
  if слово уже есть в words.json (case-insensitive) → помечаем "existing", continue
  pool.push(candidate)

if pool.length === 0 → EXIT 1 "No unprocessed words available for level X"
if pool.length < requested → продолжаем с тем что есть, stdout включает "SELECTED: N" (фактическое количество)

записываем Oxford5000.json (обновлённые "existing")
записываем pending-words.json { phase:"enrichment", words: pool }
EXIT 3, stdout: "NEED_ENRICHMENT\nSELECTED: N"
```

### COMMIT (псевдокод)
```
читаем pending-words.json
валидируем: phase === "commit", все 4 поля заполнены у каждого слова
назначаем ID каждому слову
добавляем в words.json
помечаем каждое слово в Oxford5000.json: status → "added"
обновляем CLAUDE.md
EXIT 0, stdout: "OK\nLEVEL_TOTAL: N\nLAST_ID_ASSIGNED: x_NNN"
```

### Таблица exit кодов

| Код | Статус | Когда |
|---|---|---|
| 0 | `OK` | COMMIT успешен |
| 1 | `ERROR` | Критическая ошибка |
| 3 | `NEED_ENRICHMENT` | SELECT успешен, ждём обогащения от Claude |

*(Exit 2 `NEED_MORE` из старого скрипта упраздняется — дубликаты теперь обрабатываются в SELECT автоматически)*

### Маппинг Oxford `type` → наш `partOfSpeech`

Прямое совпадение: `verb`, `noun`, `adjective`, `adverb`, `conjunction`, `preposition`, `determiner`, `pronoun`.  
Составные (через запятую, например `"verb, noun"`) → `"verb/noun"`.  
Неподдерживаемые (`"indefinite article"`, `"definite article"`, `"number"`, `"exclamation"`) → помечаем `"existing"`, пропускаем.

---

## Секция 5 — Новый протокол скилла `/add-words`

Заменяем шаги 1–4 в скилле:

```
1. Run `node scripts/add-words.mjs <LEVEL> <COUNT>`

2. Handle exit code:
   - EXIT 3 (NEED_ENRICHMENT): Read pending-words.json.
     For each word fill in these 4 fields:
       - translation   — Russian, natural, max 5 words
       - example1_ru   — accurate Russian translation of example1
       - example2      — new English example (different context from example1)
       - example2_ru   — Russian translation of example2
     Use `definition` field as context only (do NOT copy it to output).
     Transcription is already set — do not change it.
     Change phase to "commit". Write back to pending-words.json.
     Run `node scripts/add-words.mjs` (no args).

   - EXIT 0 (OK): Report LEVEL_TOTAL and LAST_ID_ASSIGNED to user.
   - EXIT 1 (ERROR): Report MESSAGE verbatim. Do not retry.
```

Разделы "Word selection rules by level" и "Quality rules" остаются без изменений — они нужны Claude для написания `example2` и переводов.

---

## Затронутые файлы

| Файл | Изменение |
|---|---|
| `scripts/add-words.mjs` | Полная переработка: SELECT + COMMIT фазы, работа с Oxford5000.json |
| `src/data/Oxford5000.json` | Добавляется поле `status` к обработанным записям (в процессе работы) |
| `.claude/commands/add-words.md` | Новый протокол (шаги 1–4) |

## Не трогаем

`src/data/words.json` структура, `src/lib/`, `src/screens/`, `src/types.ts` — никаких изменений.
