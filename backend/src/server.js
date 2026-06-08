import dotenv from 'dotenv'
import app from './app.js'
import { connectDatabase } from './utils/database.js'

dotenv.config()

const port = process.env.PORT || 5000

await connectDatabase()

app.listen(port, () => {
  console.log(`API server running on http://127.0.0.1:${port}`)
})
