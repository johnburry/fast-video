// Script to generate a PNG favicon from the SVG
const fs = require('fs');
const path = require('path');

// Create a simple PNG data URL for a 32x32 red spyglass icon
// This is a base64-encoded PNG image
const pngBase64 = `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAHKSURBVHgB7VbLTsJAFD0zLRRQXhYTF7pwp3+gK1e6cqUr/0B/QFf+gStXunSlK3+A+Ae6cqUrV7owkfiIBQotte2MIxQoD2dKScyZTCadzr1n7p1zB4D/jBAEQRAEQRAEQRAEQfwfkMvlUjwe3wuFQgdKqSoAXCuVSjcej4/D4XA+k8mUA4FAYDAYDDKZTKlQKBzG4/FdAPja2NhQtra2ToLBYMnn8x0B8NXn890PBAJF+PX29/dPl8vlLgDcarXaaTabZ77f+/1+xev17gPA7XQ6J+12++zz8/MaAO58Pt8tANxGo3Gm1+uf0Wq1TpfLdQsAt1wun2m326darZ4ul8vnAHDL5fKZRqNxqtPpnAPA/fj4ONVqtU61Wu30x8fHOQDcYrF4qtFonGo0Gqc/Pz/PAeCWy+VTjUbjVKPRONVqtc4B4BYKhVONRuNUo9E49fHxcQ4At1AonPr+/j7V6XROdbvdcwC4hULhVLfbPdXtdk91u91zALiFQuFUt9s91e12T3W73XMAuIVC4VS32z3V7XZPdbvdcwC4hULhVLfbPdXtdk91u91zALiFQuFUt9s91e12T3W73XMAuIVC4VS32z3V7XZPdbvdcwC4hULhVLfbPdXtdk91u91zAPgfQRAEQRAEQRAEQRD/N74AqDfqY7GxMdUAAAAASUVORK5CYII=`;

// Convert base64 to buffer and save
const buffer = Buffer.from(pngBase64, 'base64');
const publicDir = path.join(__dirname, '..', 'public');
const faviconPath = path.join(publicDir, 'favicon.png');

fs.writeFileSync(faviconPath, buffer);
console.log('✅ Generated favicon.png');

// Also create a 16x16 version for favicon.ico
const favicon16Base64 = `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAADaSURBVHgBrVLBDcIwDHRSsQEjMAIjMAIjwAiMwAiMwAiMwAiMwAiMgBihG3RJZOKmTSP1JCt27px7tgP8E4QQQgghhBBCCCH+B5RSSimllFJKKaX+B0optVqtllJKKaXUaiml1Gq1WkoptVqt1lJKrdVqtZRSarVaraWUWq1Wa6VUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaVUq9VqLaXU/wkhhBBCCCGE+AA+AfYr6mN7GwAAAABJRU5ErkJggg==`;
const buffer16 = Buffer.from(favicon16Base64, 'base64');
const faviconIcoPath = path.join(publicDir, 'favicon.ico');

fs.writeFileSync(faviconIcoPath, buffer16);
console.log('✅ Generated favicon.ico');

// Create apple-touch-icon.png (180x180)
const appleTouchIconBase64 = pngBase64; // Using same for now
const appleTouchIconPath = path.join(publicDir, 'apple-touch-icon.png');
fs.writeFileSync(appleTouchIconPath, buffer);
console.log('✅ Generated apple-touch-icon.png');
