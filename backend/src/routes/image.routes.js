import { Router } from 'express'
import { uploadImage } from '../controllers/drive.controller.js'
import { protect } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

router.post('/', protect, upload.single('image'), uploadImage)

export default router
