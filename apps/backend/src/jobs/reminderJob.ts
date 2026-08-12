import type { AppServices } from '../services/appServices';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

export function startReminderJob(services: AppServices, intervalMs = DEFAULT_INTERVAL_MS) {
  const run = async () => {
    try {
      const result = await services.citas.send24HourReminders();
      if (result.processed > 0) {
        console.info(`Recordatorios de citas procesados: ${result.processed}`);
      }
    } catch (error) {
      console.error('No se pudieron procesar los recordatorios de citas.', error);
    }
  };

  const timer = setInterval(run, intervalMs);
  void run();
  return timer;
}
