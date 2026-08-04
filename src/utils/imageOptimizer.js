/**
 * Image Optimizer Utility
 * Automatically resizes, compresses, and converts images (JPEG, PNG, GIF, BMP, SVG, etc.) 
 * into lightweight WebP format before uploading to Firestore/Storage/Server.
 * 
 * Benefits:
 * - Reduces file size from 1MB - 5MB down to ~15KB - 80KB (up to 90% size reduction)
 * - Converts to optimized WebP format
 * - Dramatically improves website loading speed and performance
 */

/**
 * Converts a File, Blob, or base64 Data URL to a compressed WebP format.
 * 
 * @param {File|Blob|string} imageSource - The source file, blob, or data URL string
 * @param {Object} options - Configuration options
 * @param {number} [options.maxWidth=800] - Max width of output image
 * @param {number} [options.maxHeight=800] - Max height of output image
 * @param {number} [options.quality=0.8] - Compression quality (0.1 to 1.0)
 * @param {string} [options.outputFormat='image/webp'] - Output MIME type
 * @returns {Promise<{ file: File, dataUrl: string, originalSize: number, compressedSize: number, savedPercentage: string }>}
 */
export async function convertToWebP(imageSource, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    outputFormat = 'image/webp'
  } = options;

  return new Promise((resolve, reject) => {
    let originalSize = 0;
    let fileName = 'image.webp';

    if (imageSource instanceof File) {
      originalSize = imageSource.size;
      const baseName = imageSource.name.substring(0, imageSource.name.lastIndexOf('.')) || 'image';
      fileName = `${baseName}.webp`;
    }

    const img = new Image();

    // Handle cross-origin for URL images if needed
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect ratio and target bounds
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width / maxWidth > height / maxHeight) {
            width = maxWidth;
            height = Math.round(maxWidth / aspectRatio);
          } else {
            height = maxHeight;
            width = Math.round(maxHeight * aspectRatio);
          }
        }

        // Create canvas for WebP encoding
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }

        // Smooth rendering quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to WebP Data URL
        const dataUrl = canvas.toDataURL(outputFormat, quality);

        // Convert canvas to WebP Blob / File
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Fallback to Data URL conversion if blob creation failed
              const arr = dataUrl.split(',');
              const mime = arr[0].match(/:(.*?);/)[1];
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              const fallbackBlob = new Blob([u8arr], { type: mime });
              const webpFile = new File([fallbackBlob], fileName, { type: outputFormat });
              
              resolve({
                file: webpFile,
                dataUrl: dataUrl,
                originalSize: originalSize || fallbackBlob.size,
                compressedSize: fallbackBlob.size,
                savedPercentage: originalSize ? (((originalSize - fallbackBlob.size) / originalSize) * 100).toFixed(1) + '%' : '0%'
              });
              return;
            }

            const webpFile = new File([blob], fileName, { type: outputFormat });
            const compressedSize = blob.size;
            const savedPct = originalSize ? (((originalSize - compressedSize) / originalSize) * 100).toFixed(1) + '%' : '0%';

            resolve({
              file: webpFile,
              dataUrl: dataUrl,
              originalSize: originalSize || compressedSize,
              compressedSize: compressedSize,
              savedPercentage: savedPct
            });
          },
          outputFormat,
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(new Error('Failed to load image for WebP conversion'));

    // Load source into img
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(imageSource);
    } else {
      reject(new Error('Invalid image source provided. Expected File, Blob, or Data URL.'));
    }
  });
}

/**
 * Helper to process HTML File Input event directly to WebP Data URL / File
 * 
 * @param {Event} event - HTML file input change event
 * @param {Object} options - Compression options
 * @returns {Promise<{ file: File, dataUrl: string, originalSize: number, compressedSize: number, savedPercentage: string }|null>}
 */
export async function handleImageInputChange(event, options = {}) {
  const file = event.target?.files?.[0];
  if (!file) return null;
  return await convertToWebP(file, options);
}
