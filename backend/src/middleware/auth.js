import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401)
    throw new Error('Authentication required')
  }

  if (!process.env.JWT_SECRET) {
    res.status(500)
    throw new Error('JWT_SECRET is required')
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET)
  const user = await User.findById(payload.id).select('-passwordHash')

  if (!user) {
    res.status(401)
    throw new Error('User no longer exists')
  }

  req.user = user
  next()
})
