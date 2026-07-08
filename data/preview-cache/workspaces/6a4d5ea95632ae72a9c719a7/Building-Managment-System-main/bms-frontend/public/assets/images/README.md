# Background Image Instructions

## How to Add Your Background Image

1. **Place your image file** in this directory (`public/assets/images/`)
2. **Name it** `login-bg.jpg` (or update the path in `Login.tsx`)
3. **Recommended specifications:**
   - Format: JPG, PNG, or WebP
   - Size: 1920x1080 or larger (for best quality)
   - File size: Under 2MB (for fast loading)
   - Content: Building, property, or professional office image

## Current Setup

The login page is configured to use: `/assets/images/login-bg.jpg`

If you use a different filename, update line 50 in `src/pages/Login.tsx`:
```tsx
backgroundImage: `url('/assets/images/YOUR_IMAGE_NAME.jpg')`,
```

## Example Images

You can use:
- Modern office buildings
- Property exteriors
- Professional business environments
- Skyline views
- Architectural photography
