import { Router } from 'express'
import { createFolder, listDrive } from '../controllers/drive.controller.js'
import { protect } from '../middleware/auth.js'

const router = Router()

router.get('/', protect, listDrive)
router.post('/', protect, createFolder)

export default router
