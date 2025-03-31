import express from 'express';
import { validateContactFormMiddleware } from './validationMiddleware';
import { handlePostContact, handleGetContact } from './contactHandlers';

const routes = express.Router();

// Rota POST para envio de contato
routes.route('/contacts')
  .post(validateContactFormMiddleware, handlePostContact) // POST para envio de contato
  .get(handleGetContact); // GET para informar que apenas POST é suportado

export default routes;