import Dexie, { type Table } from 'dexie'
import { type components } from '../types/schema.d'

// Extract the core types from our OpenAPI schema
export type WaterLog = components['schemas']['api.WaterLog']

// Extended interface for our LOCAL database. It includes everything from the server's WaterLog, plus a local 'is_synced' flag.
export interface LocalWaterLog extends WaterLog {
  is_synced: number // 0 = false (needs sync), 1 = true (already on server)
}

export class DrinkwaterDB extends Dexie {
  waterLogs!: Table<LocalWaterLog, string>

  constructor() {
    super('DrinkwaterDB')

    // Version 1: initial schema, no is_synced index.
    this.version(1).stores({
      waterLogs: '&id, amount_ml, logged_at, is_deleted',
    })

    // Version 2: adds is_synced to the indexes so it can be queried quickly.
    this.version(2)
      .stores({
        waterLogs: '&id, amount_ml, logged_at, is_deleted, is_synced',
      })
      .upgrade((tx) => {
        // If a user upgrades from v1, mark all existing logs as needing a sync
        return tx
          .table('waterLogs')
          .toCollection()
          .modify((log) => {
            log.is_synced = 0
          })
      })
  }
}

export const db = new DrinkwaterDB()
