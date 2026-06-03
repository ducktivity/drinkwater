import { createSignal, onMount } from 'solid-js'
import { db, type WaterLog } from './db/db'

function App() {
  const [logs, setLogs] = createSignal<WaterLog[]>([])

  // 1. Fetch data from Dexie when the component loads
  const loadLogs = async () => {
    // Dexie query: Get all logs that are not marked as deleted, sorted by time
    const allLogs = await db.waterLogs
      .filter((log) => !log.is_deleted)
      .reverse()
      .sortBy('logged_at')

    setLogs(allLogs)
  }

  onMount(() => {
    loadLogs()
  })

  // 2. Add a new water log
  const handleDrinkWater = async () => {
    const newLog: WaterLog = {
      id: crypto.randomUUID(), // Generate a unique ID locally
      amount_ml: 250, // Standard glass of water
      logged_at: new Date().toISOString(),
      is_deleted: false,
    }

    // Save to Dexie
    await db.waterLogs.add(newLog)

    // Refresh the UI
    await loadLogs()
  }

  return (
    <div style={{ padding: '2rem', 'font-family': 'sans-serif' }}>
      <h1>Drinkwater 💧</h1>

      <button
        onClick={handleDrinkWater}
        style={{
          padding: '10px 20px',
          'font-size': '1.2rem',
          cursor: 'pointer',
        }}
      >
        Drink 250ml
      </button>

      <h2 style={{ 'margin-top': '2rem' }}>Today's Logs</h2>
      <ul>
        {logs().map((log) => (
          <li>
            <strong>{log.amount_ml}ml</strong> -{' '}
            {new Date(log.logged_at).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
