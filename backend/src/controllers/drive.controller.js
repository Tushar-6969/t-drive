import Folder from '../models/Folder.js'
import Image from '../models/Image.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { serializeFolder, serializeImage } from '../utils/serializers.js'

async function assertFolderAccess(folderId, userId) {
  if (!folderId) return null

  const folder = await Folder.findOne({ _id: folderId, user: userId })

  if (!folder) {
    const error = new Error('Folder not found')
    error.status = 404
    throw error
  }

  return folder
}

function buildFolderSizes(folders, images) {
  const childMap = new Map()
  const directSizes = new Map()

  for (const folder of folders) {
    const parentKey = folder.parent ? folder.parent.toString() : 'root'
    const children = childMap.get(parentKey) || []
    children.push(folder._id.toString())
    childMap.set(parentKey, children)
  }

  for (const image of images) {
    const folderKey = image.folder ? image.folder.toString() : 'root'
    directSizes.set(folderKey, (directSizes.get(folderKey) || 0) + image.size)
  }

  const memo = new Map()

  function calculate(folderId) {
    if (memo.has(folderId)) return memo.get(folderId)

    const nestedSize = (childMap.get(folderId) || []).reduce(
      (total, childId) => total + calculate(childId),
      0,
    )
    const total = (directSizes.get(folderId) || 0) + nestedSize
    memo.set(folderId, total)
    return total
  }

  return folders.reduce((sizes, folder) => {
    const id = folder._id.toString()
    sizes[id] = calculate(id)
    return sizes
  }, {})
}

export const listDrive = asyncHandler(async (req, res) => {
  const [folders, images] = await Promise.all([
    Folder.find({ user: req.user._id }).sort({ createdAt: 1 }),
    Image.find({ user: req.user._id }).sort({ createdAt: 1 }),
  ])

  const sizes = buildFolderSizes(folders, images)

  res.json({
    folders: folders.map((folder) => serializeFolder(folder, sizes[folder._id.toString()] || 0)),
    images: images.map(serializeImage),
  })
})

export const createFolder = asyncHandler(async (req, res) => {
  const { name, parentId = null } = req.body

  if (!name?.trim()) {
    res.status(400)
    throw new Error('Folder name is required')
  }

  await assertFolderAccess(parentId, req.user._id)

  try {
    const folder = await Folder.create({
      name: name.trim(),
      parent: parentId || null,
      user: req.user._id,
    })

    res.status(201).json({ folder: serializeFolder(folder) })
  } catch (error) {
    if (error.code === 11000) {
      res.status(409)
      throw new Error('A folder with that name already exists here')
    }

    throw error
  }
})

export const uploadImage = asyncHandler(async (req, res) => {
  const { name, folderId = null } = req.body

  if (!name?.trim() || !req.file) {
    res.status(400)
    throw new Error('Image name and file are required')
  }

  await assertFolderAccess(folderId, req.user._id)

  const image = await Image.create({
    name: name.trim(),
    user: req.user._id,
    folder: folderId || null,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`,
  })

  res.status(201).json({ image: serializeImage(image) })
})
