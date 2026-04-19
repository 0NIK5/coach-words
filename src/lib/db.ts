import { openDB, type IDBPDatabase } from 'idb'
import type { CardProgress, AppSettings } from '../types'

const DB_NAME = 'coachwords'
const DB_VERSION = 1

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'wordId' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }
    },
  })
}

export async function getProgress(wordId: string): Promise<CardProgress | undefined> {
  const db = await getDB()
  return db.get('progress', wordId)
}

export async function saveProgress(card: CardProgress): Promise<void> {
  const db = await getDB()
  await db.put('progress', card)
}

export async function saveAllProgress(cards: CardProgress[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('progress', 'readwrite')
  await Promise.all(cards.map(card => tx.store.put(card)))
  await tx.done
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await getDB()
    const settings = await db.get('settings', 'main')
    return settings ?? { currentLevel: 'A2', streak: 0, lastStudyDate: '' }
  } catch {
    return { currentLevel: 'A2', streak: 0, lastStudyDate: '' }
  }
}

export async function getAllProgress(): Promise<CardProgress[]> {
  try {
    const db = await getDB()
    return db.getAll('progress')
  } catch {
    return []
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB()
  await db.put('settings', { ...settings, id: 'main' })
}

export async function resetAllProgress(): Promise<void> {
  const db = await getDB()
  await db.clear('progress')
  await db.put('settings', {
    id: 'main',
    currentLevel: 'A2',
    streak: 0,
    lastStudyDate: '',
  })
}
