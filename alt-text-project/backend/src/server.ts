import { app } from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`Suggested Alt API listening on port ${env.PORT}`);
});
