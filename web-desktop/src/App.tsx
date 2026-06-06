import { createSignal, onMount } from 'solid-js'
import { db, type LocalWaterLog } from './db/db'
import { syncEngine } from './db/sync'
import { liveQuery } from 'dexie'

function App() {
  const [logs, setLogs] = createSignal<LocalWaterLog[]>([])

  // Use Dexie's liveQuery wrapped in a SolidJS effect to auto-update the UI
  // whenever the database changes (either from the user OR from a background sync!)
  onMount(() => {
    const observable = liveQuery(() =>
      db.waterLogs
        .filter((log) => !log.is_deleted)
        .reverse()
        .sortBy('logged_at'),
    )

    const subscription = observable.subscribe({
      next: (result) => setLogs(result),
      error: (err) => console.error(err),
    })

    return () => subscription.unsubscribe()
  })

  const handleDrinkWater = async () => {
    const newLog: LocalWaterLog = {
      id: crypto.randomUUID(),
      amount_ml: 250,
      logged_at: new Date().toISOString(),
      is_deleted: false,
      is_synced: 0, // New logs MUST be marked as 0 so the sync engine picks them up
    }

    await db.waterLogs.add(newLog)

    // In a real app, you might trigger syncEngine() here asynchronously
    // so it syncs immediately in the background without blocking the UI.
  }

  return (
    <div style={{ padding: '2rem', 'font-family': 'sans-serif' }}>
      <h1>Drinkwater 💧</h1>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleDrinkWater}
          style={{
            padding: '10px 20px',
            'font-size': '1.2rem',
            cursor: 'pointer',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            'border-radius': '8px',
          }}
        >
          Drink 250ml
        </button>

        <button
          onClick={syncEngine}
          style={{
            padding: '10px 20px',
            'font-size': '1.2rem',
            cursor: 'pointer',
            background: '#10b981',
            color: 'white',
            border: 'none',
            'border-radius': '8px',
          }}
        >
          Sync Now 🔄
        </button>
      </div>

      <h2 style={{ 'margin-top': '2rem' }}>Today's Logs</h2>
      <ul>
        {logs().map((log) => (
          <li>
            <strong>{log.amount_ml}ml</strong> -{' '}
            {new Date(log.logged_at).toLocaleTimeString()}
            <span
              style={{
                color: log.is_synced ? 'green' : 'orange',
                'margin-left': '10px',
              }}
            >
              {log.is_synced ? '(Synced)' : '(Pending)'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
