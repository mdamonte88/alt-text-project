import { Router } from 'express';
import { suggestAlt } from '../controllers/alt.controller';
const router = Router();
router.post('/suggest-alt', suggestAlt);
export default router;
