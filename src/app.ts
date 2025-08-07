import express from 'express';
import 'express-async-errors'; 
import { setupMiddleware } from './middleware';
import routes from './routes/index';
import { errorHandlerMiddleware } from './middlewares/error-handler';

const app = express();

app.set('trust proxy', 1);

setupMiddleware(app);

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy (local)' });
});
  
  // Se a URL original for /api/health, retorne a verificação de saúde
  // if (originalUrl === '/api/health') {
  //   return res.status(200).json({ 
  //     status: 'ok', 
  //     message: 'API is healthy (production)'
  //   });
  // }
  
  // Caso contrário, continue para a próxima rota
  app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Bruna Alves Photography API',
    docs: 'Check /api/health for status or /api/* for endpoints.',
    version: '1.0.0'
  });
});

app.use('/api', routes);

// app.use((req, res, next) => {
//   if (res.headersSent) {
//     return next();
//   }

//   res.status(200).json({ 
//     message: 'Path inspector',
//     path: req.path,
//     originalUrl: req.originalUrl,
//     baseUrl: req.baseUrl
//   });
// });

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'Check the URL or consult the API documentation.'
  });
});

app.use(errorHandlerMiddleware);

export default app;