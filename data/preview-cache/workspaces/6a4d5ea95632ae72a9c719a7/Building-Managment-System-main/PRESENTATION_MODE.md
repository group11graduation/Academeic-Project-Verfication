# Presentation Mode Guide

## Quick Fix for Rate Limiting During Presentations

If you encounter "429 Too Many Requests" errors during your presentation, you have two options:

### Option 1: Disable Rate Limiting Temporarily (Recommended for Demos)

Add this to your `.env` file:
```
DISABLE_RATE_LIMIT=true
```

Then restart your server. This will completely disable rate limiting for login attempts.

**Remember to remove this after your presentation for security!**

### Option 2: Use Development Mode

The rate limiting is automatically disabled in development mode. Make sure your `.env` has:
```
NODE_ENV=development
```

## Current Rate Limits

- **Login attempts**: 20 per 15 minutes (increased from 5)
- **General API**: 100 requests per 15 minutes

## What Was Fixed

1. ✅ Increased login rate limit from 5 to 20 attempts per 15 minutes
2. ✅ Added better error messages for 429 errors
3. ✅ Rate limiting automatically disabled in development/test mode
4. ✅ Reduced ThemeContext polling frequency to avoid performance issues
5. ✅ Improved frontend error handling with user-friendly messages

## For Your Presentation

**Before presenting:**
1. Set `DISABLE_RATE_LIMIT=true` in your `.env` file
2. Restart the server
3. Test login a few times to make sure it works

**After presenting:**
1. Remove `DISABLE_RATE_LIMIT=true` from `.env` (or set it to `false`)
2. Restart the server

## Error Messages

Users will now see friendly error messages instead of technical errors:
- "Too many login attempts. Please wait a few minutes and try again."
- Clear indication of when they can retry
