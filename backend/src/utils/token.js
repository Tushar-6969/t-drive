import jwt from 'jsonwebtoken'

export function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })
}
