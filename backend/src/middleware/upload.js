import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.join(__dirname, '..', '..', 'uploads')

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname)
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`)
  },
})

function imageFilter(req, file, callback) {
  if (!file.mimetype.startsWith('image/')) {
    callback(new Error('Only image uploads are allowed'))
    return
  }

  callback(null, true)
}

export const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})
