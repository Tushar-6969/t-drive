import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { serializeUser } from '../utils/serializers.js'
import { signToken } from '../utils/token.js'

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400)
    throw new Error('Name, email, and password are required')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const exists = await User.exists({ email: normalizedEmail })

  if (exists) {
    res.status(409)
    throw new Error('An account already exists for this email')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  })

  res.status(201).json({
    token: signToken(user),
    user: serializeUser(user),
  })
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email?.trim() || !password) {
    res.status(400)
    throw new Error('Email and password are required')
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  res.json({
    token: signToken(user),
    user: serializeUser(user),
  })
})

export const me = asyncHandler(async (req, res) => {
  res.json({ user: serializeUser(req.user) })
})
