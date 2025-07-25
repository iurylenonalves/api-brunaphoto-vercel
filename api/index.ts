import dotenv from 'dotenv';
import app from '../src/app'

dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
  });
}

export default app;