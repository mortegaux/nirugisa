import { useState, useRef, useEffect } from 'react';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (imageUrl: string) => void;
  onUpload: (file: File) => Promise<{ imageUrl: string }>;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export function ImageUpload({
  currentImageUrl,
  onImageChange,
  onUpload,
  maxSizeMB = 5,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}: ImageUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize URL input if there's a current image URL
  useEffect(() => {
    if (currentImageUrl) {
      setUrlInput(currentImageUrl);
      // If it's an uploaded file path, show upload mode, otherwise URL mode
      setMode(currentImageUrl.startsWith('/uploads/') ? 'upload' : 'url');
    }
  }, [currentImageUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate file type
    if (!acceptedFormats.includes(file.type)) {
      setError(`Invalid file type. Accepted: ${acceptedFormats.map(f => f.split('/')[1]).join(', ')}`);
      return;
    }

    // Validate file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Upload file
    setUploading(true);
    try {
      const result = await onUpload(file);
      console.log('Upload result:', result);
      console.log('Image URL from upload:', result.imageUrl);
      onImageChange(result.imageUrl);
      setUrlInput(''); // Clear URL input when file is uploaded
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onImageChange('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setError('');
    onImageChange(urlInput.trim());
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    }
  };

  // Build proper image URL for display
  const getImageSrc = (): string | null => {
    if (!currentImageUrl) return null;

    console.log('currentImageUrl:', currentImageUrl);

    // Full URLs
    if (currentImageUrl.startsWith('http://') || currentImageUrl.startsWith('https://')) {
      console.log('Using full URL:', currentImageUrl);
      return currentImageUrl;
    }
    // Relative paths from server
    if (currentImageUrl.startsWith('/')) {
      const url = `${window.location.origin}${currentImageUrl}`;
      console.log('Built URL from relative path:', url);
      return url;
    }
    // Fallback
    console.log('Using fallback URL:', currentImageUrl);
    return currentImageUrl;
  };

  const imageSrc = getImageSrc();
  console.log('Final imageSrc:', imageSrc);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-card-foreground mb-2">
          Recipe Image
        </label>

        {/* Image Preview */}
        {imageSrc && (
          <div className="relative w-full h-48 mb-3 rounded-lg overflow-hidden border border-border">
            <img
              src={imageSrc}
              alt="Recipe preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Image failed to load:', currentImageUrl);
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
              }}
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-2 hover:bg-destructive/90 transition-colors shadow-lg"
              title="Remove image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Mode Tabs */}
        {!imageSrc && (
          <>
            <div className="flex border-b border-border mb-4">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  mode === 'upload'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  mode === 'url'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Enter URL
              </button>
            </div>

            {/* Upload Mode */}
            {mode === 'upload' && (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedFormats.join(',')}
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="recipe-image-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="recipe-image-upload"
                  className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
                >
                  <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload image'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    JPEG, PNG, GIF, WebP up to {maxSizeMB}MB
                  </span>
                </label>
              </div>
            )}

            {/* URL Mode */}
            {mode === 'url' && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://example.com/image.jpg"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Use This URL
                </button>
              </div>
            )}
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
