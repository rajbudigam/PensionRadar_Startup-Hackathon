# PensionRadar

A calm, local first retirement planner for India. Simple inputs. Clear results.

## What this prototype does

- Runs entirely in the browser with no login  
- Guides you through a two step wizard with only the fields that matter  
- Shows a PensionScore and one monthly income number on the Results screen  
- Offers three practical suggestions with Apply buttons that change inputs instantly  
- Keeps formulas transparent on the About screen with LaTeX rendering and a Variables popup that defines every symbol  
- Exports a one page print that uses a single color theme and adds a date header  
- Saves your edits automatically in the browser so a refresh keeps your work  

## Scope of this build

- Manual inputs only  
- Rule based suggestions  
- No live EPFO or NPS connectivity  
- No data leaves your device  


## Hosting

This is a static site and works on any static host.  
For GitHub Pages place the files at the repository root and enable Pages in repository settings. Hash based routes are already in place so no extra configuration is needed.

## Controls you may want

- Assumptions opens a small modal where you can tweak rates and horizon  
- Reset restores sensible defaults  
- Help gives a short guide to the screens  

## Accessibility and performance

- Large touch targets and clear focus rings  
- Keyboard friendly navigation order  
- MathJax renders SVG so equations look crisp on screen and in print  

## Notes for reviewers

The interface keeps numbers light on each screen. Advanced inputs live behind a single drawer so first time users see only what they need. The layout is spacious and easy on the eyes, and the results update instantly as you make changes.
