import express from 'express';
import 'express-async-errors'; 
//import path from 'path'; 
import { setupMiddleware } from './middleware';
//import routes from './routes/index';
//import { errorHandlerMiddleware } from './middlewares/error-handler';

const app = express();

app.set('trust proxy', 1);

setupMiddleware(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy' });
});

// 2. Serve static files from the 'uploads' folder
// This allows the frontend to access saved images via URL
// http://localhost:8080/uploads/nome-da-imagem.jpg


//app.use('/uploads', express.static(path.join('/tmp', 'uploads')));

//app.use(routes);

//app.use(errorHandlerMiddleware);

export default app;