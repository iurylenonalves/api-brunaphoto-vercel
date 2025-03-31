import express from 'express';
import dotenv from 'dotenv';
import { setupMiddleware } from './middleware';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar middlewares
setupMiddleware(app);

// Configurar rotas
app.use('/api', routes);

// Rota de verificação de saúde
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});