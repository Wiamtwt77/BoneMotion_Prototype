# Prototype → Product roadmap

## Phase 1 — interaction validation
- [x] Image import
- [x] Manual bones
- [x] Parent/child skeleton
- [x] Pose by dragging bone tips
- [x] Basic timeline
- [x] Keyframes
- [x] JSON save/load

## Phase 2 — real deformation
Replace the prototype renderer with:
- triangulated mesh generation
- bone-weight calculation
- Linear Blend Skinning or Dual Quaternion style deformation
- automatic weight generation
- weight painting/refinement
- pin/lock points
- joint preservation
- per-layer depth

A conventional 2D rigging pipeline commonly combines bones, generated mesh geometry, automatic weights, and manual weight refinement. Unity's current 2D animation documentation follows this general model. 

## Phase 3 — "minimum effort" workflow
The product differentiator should be:
1. Import image.
2. Detect/segment body parts.
3. Estimate joints.
4. Generate skeleton automatically.
5. Generate mesh.
6. Generate weights.
7. Show a playable result immediately.
8. Let the user correct only what is wrong.

## Phase 4 — animation UX
- pose presets
- drag gestures
- IK
- animation recording from mouse/touch movement
- motion copy/paste
- looping
- onion skin
- easing
- camera
- audio

## Phase 5 — production
- WebGL/GPU deformation
- worker-based image processing
- project autosave
- undo/redo
- asset/layer system
- MP4/GIF/WebM export
- responsive UI
