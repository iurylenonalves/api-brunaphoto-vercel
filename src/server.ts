import express from 'express';
import dotenv from 'dotenv';
import { setupMiddleware } from './middleware';
import routes from './routes';

dotenv.config();

const app = express();

// Configurar middlewares
setupMiddleware(app);

// Configurar rotas
app.use('/api', routes);

// Exportar o handler para a Vercel
export default app;