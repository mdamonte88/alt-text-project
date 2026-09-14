import express from 'express';
import altRoutes from './routes/alt.routes';
import { errorMiddleware } from './middleware/error.middleware';

export const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', altRoutes);
app.use(errorMiddleware);
