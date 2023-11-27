import { Router } from 'express';
import { registerControllerList } from '../../helpers/controllerHelper';

const router = Router();

registerControllerList(router);

module.exports = router;
