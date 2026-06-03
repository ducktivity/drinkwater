import Dexie, { type Table } from 'dexie'
import type { components } from '../types/schema'

// Extract the WaterLog type from our OpenAPI generated types
export type WaterLog = components['schemas']['WaterLog']

export class DrinkwaterDB extends Dexie {
  // Declare our table and tell TypeScript it holds WaterLog objects,
  // and the primary key is a string ('id')
  waterLogs!: Table<WaterLog, string>

  constructor() {
    super('DrinkwaterDB')

    // Define the database schema.
    // We only need to define the properties we want to query or filter by.
    // We use '&id' to denote that 'id' is a unique primary key.
    this.version(1).stores({
      waterLogs: '&id, amount_ml, logged_at, is_deleted',
    })
  }
}

// Export a single instance to be used throughout the app
export const db = new DrinkwaterDB()
