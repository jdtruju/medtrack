import { createApp } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { createSupabaseServices } from './repositories/supabaseRepositories';

const app = createApp(createSupabaseServices(supabaseAdmin, env.frontendUrl));

app.listen(env.port, () => {
  console.log(`MedTrack backend escuchando en el puerto ${env.port}`);
});
