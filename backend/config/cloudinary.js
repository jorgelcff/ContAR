const cloudinary = require('cloudinary').v2;

// Cloudinary is the persistent store for user uploads (avatar models + audio).
// Render's filesystem is ephemeral — files written to local disk vanish on the
// next deploy/restart, which is why locally-stored uploads 404 later. When the
// three CLOUDINARY_* env vars are set we upload there; otherwise we fall back to
// local disk so the app still runs in development without a Cloudinary account.
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Uploads a Buffer to Cloudinary. `publicId` is set to the file's content hash
// by the caller so re-uploading the same model/audio resolves to the SAME asset
// (overwrite:false + unique_filename:false), avoiding duplicate storage when a
// user reuses one avatar across many scenes.
function uploadBuffer(buffer, { folder, resourceType = 'auto', publicId }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, cloudinaryConfigured, uploadBuffer };
