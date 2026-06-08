import { createSignal, onMount } from 'solid-js'
import { db, type LocalWaterLog } from './db/db'
import { syncEngine } from './db/sync'
import { liveQuery } from 'dexie'

function App() {
  const [logs, setLogs] = createSignal<LocalWaterLog[]>([])

  // A simple daily goal variable
  const DAILY_GOAL_ML = 2000

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

  const handleDrinkWater = async (amount: number) => {
    const newLog: LocalWaterLog = {
      id: crypto.randomUUID(),
      amount_ml: amount,
      logged_at: new Date().toISOString(),
      is_deleted: false,
      is_synced: 0,
    }
    await db.waterLogs.add(newLog)
  }

  // Reactive calculations for our UI
  const totalDrank = () => logs().reduce((sum, log) => sum + log.amount_ml, 0)
  const progressPercentage = () =>
    Math.min((totalDrank() / DAILY_GOAL_ML) * 100, 100)

  return (
    <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      {/* Main Dashboard Card */}
      <div class="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        {/* Header Section */}
        <div class="bg-blue-600 p-8 text-white text-center rounded-b-3xl shadow-md relative z-10">
          <h1 class="text-3xl font-bold tracking-tight mb-2">Drinkwater 💧</h1>
          <p class="text-blue-200 font-medium mb-6">
            Stay hydrated, stay healthy.
          </p>

          {/* Progress Circle / Text */}
          <div class="text-5xl font-extrabold mb-2">
            {totalDrank()}{' '}
            <span class="text-2xl text-blue-300 font-normal">
              / {DAILY_GOAL_ML} ml
            </span>
          </div>

          {/* Progress Bar */}
          <div class="w-full bg-blue-800 rounded-full h-4 mt-4 overflow-hidden">
            <div
              class="bg-blue-300 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage()}%` }}
            ></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div class="p-6 pb-2">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => handleDrinkWater(250)}
              class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-4 rounded-2xl transition shadow-sm active:scale-95"
            >
              🥛 +250ml
            </button>
            <button
              onClick={() => handleDrinkWater(500)}
              class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-4 px-4 rounded-2xl transition shadow-sm active:scale-95"
            >
              🥤 +500ml
            </button>
          </div>

          <button
            onClick={syncEngine}
            class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition shadow active:scale-95 flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync with Cloud
          </button>
        </div>

        {/* History List */}
        <div class="p-6 pt-2">
          <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">
            Today's History
          </h2>

          <div class="space-y-3 max-h-64 overflow-y-auto pr-2">
            {logs().length === 0 ? (
              <p class="text-center text-slate-400 italic py-4">
                No water logged yet today.
              </p>
            ) : (
              logs().map((log) => (
                <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div class="flex items-center gap-3">
                    <div class="bg-blue-100 text-blue-600 p-2 rounded-lg font-bold">
                      {log.amount_ml}ml
                    </div>
                    <div class="text-slate-500 text-sm font-medium">
                      {new Date(log.logged_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {log.is_synced ? (
                      <span class="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold border border-emerald-100">
                        Synced
                      </span>
                    ) : (
                      <span class="text-amber-500 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold border border-amber-100">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
