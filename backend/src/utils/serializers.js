export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  }
}

export function serializeFolder(folder, size = 0) {
  return {
    id: folder._id.toString(),
    name: folder.name,
    parentId: folder.parent ? folder.parent.toString() : null,
    size,
    createdAt: folder.createdAt,
  }
}

export function serializeImage(image) {
  return {
    id: image._id.toString(),
    name: image.name,
    folderId: image.folder ? image.folder.toString() : null,
    size: image.size,
    type: image.mimeType,
    src: image.url,
    createdAt: image.createdAt,
  }
}
