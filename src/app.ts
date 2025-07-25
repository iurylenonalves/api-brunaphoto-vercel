import express from 'express';
import 'express-async-errors'; 
import path from 'path'; 
import { setupMiddleware } from './middleware';
import routes from './routes/index';
import { errorHandlerMiddleware } from './middlewares/error-handler';

const app = express();

app.set('trust proxy', 1);

setupMiddleware(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy (local)' });
});

app.get('/', (req, res) => {
  const originalUrl = req.originalUrl;
  
  // Se a URL original for /api/health, retorne a verificação de saúde
  if (originalUrl === '/api/health') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'API is healthy (production)'
    });
  }
  
  // Caso contrário, continue para a próxima rota
  return res.status(200).json({ 
    message: 'Bruna Alves Photography API',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development'
  });
});

// 2. Serve static files from the 'uploads' folder
// This allows the frontend to access saved images via URL
// http://localhost:8080/uploads/nome-da-imagem.jpg

app.use('/uploads', express.static(path.join('/tmp', 'uploads')));

app.use(routes);

app.use((req, res, next) => {
  if (res.headersSent) {
    return next();
  }

  res.status(200).json({ 
    message: 'Path inspector',
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
});

app.use(errorHandlerMiddleware);

export default app;