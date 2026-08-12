import { createApp } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { createSupabaseServices } from './repositories/supabaseRepositories';

const services = createSupabaseServices(supabaseAdmin, env.frontendUrl);
const app = createApp(services);

app.listen(env.port, () => {
  console.log(`MedTrack backend escuchando en el puerto ${env.port}`);
});