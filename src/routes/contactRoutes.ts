import express from 'express';
import { validateContactFormMiddleware } from '../middlewares/validationMiddleware';
import { handlePostContact, handleGetContact } from '../controllers/contactController';

const routes = express.Router();

routes.route('/contacts')
  .post(validateContactFormMiddleware, handlePostContact)
  .get(handleGetContact);

export default routes;