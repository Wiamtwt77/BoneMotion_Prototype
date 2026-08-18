[README.md](https://github.com/user-attachments/files/31178034/README.md)
# BoneMotion — Prototype

A small browser prototype for the proposed 2D bone-based animation platform.

## What this prototype demonstrates

- Upload a character image.
- Add bones directly over the image.
- Select a bone and drag its endpoint to pose it.
- Parent bones to create a simple skeleton.
- Attach the image to a lightweight deformable mesh.
- Move/rotate bones and see a basic deformation effect.
- Keyframe the pose on a timeline.
- Play the animation.
- Save/load the project as JSON.

## Design direction

The intended product is not a traditional frame-by-frame editor. The core idea is:

**Image → flexible rig → bones → deformation → animation**

For the final product, the rigging workflow should be progressively automatic: the user should do as little manual rigging as possible, while still being able to refine bones and deformation when needed.

This prototype deliberately keeps the implementation simple so the interaction model can be tested before building a production deformation engine.

## Run

Open `index.html` in a modern browser.

No build step and no external dependencies are required.
