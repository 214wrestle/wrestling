# Michael Moreno playable realism pilot

The playable Moreno model now uses the existing realism prototype's finer facial surfaces, anatomical muscle shapes, ambient occlusion, cloth normals, skin detail and layered hair. The body lab and game share this renderer through the common CharacterRig contract; geometry is built in a worker with a synchronous fallback. Other wrestlers keep their current renderer while their individual likeness work proceeds.

Iowa State's collegiate portrait/action photographs guide the red singlet, gold lettering/trim, short dark hair and white headgear: https://cyclones.com/sports/wrestling/roster/michael-moreno/1333. Geometry dimensions are art estimates, not scanned measurements. His face is still an approximation and does not meet the requested recognizable UFC-quality standard. No real scanned likeness or film-derived motion capture is claimed.

Review the development lab with `?lab=body&athlete=iowa-state-165-choice-michael-moreno&pose=rest`; add `&realism=0` to compare the previous renderer. The production game uses the pilot when Michael Moreno is selected at Iowa State 165. Further work: reference-matched facial volumes and expression, detailed school kit, athlete-specific movement and contact during distinct techniques.

The official 2015 portrait provides a clearer facial reference: https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/10/2/TGCJBIUFSYWIISS.20151002142327.jpg. The next revision reduces the eye aperture and heavy brow, widens the chin/jaw, shortens and widens the nose and makes cheek softness independent of the cheekbone landmarks. During wrestling the detailed eyes now track the opponent’s head through the shared animation contract. This remains a procedural approximation pending recognizable likeness review.

October 5 continuation: shortened the lower face by 7 mm in canonical model coordinates, broadened the jaw/chin and increased cheek fill. Verified the six-view body lab builds with 41,005 head vertices and no browser errors. These are photographic art estimates, not scanned measurements. The face remains below the requested UFC-like likeness, particularly eyes, facial planes and surface detail; keep this workstream active.

Live quick-match verification: Moreno vs Mark Perry reached a fall with 6.6 seconds left in period one; result screen showed takedown, near fall, penalties and riding time. No browser warnings or errors. This checks rendering through a completed bout, not likeness fidelity or tournament pin calibration.

Eyelid correction: bound the procedural lash shading to the absolute distance from the aperture edge. The former signed-distance mask darkened the entire interior side of the edge. This is a shading fix; face geometry, eye motion and likeness remain unfinished.

Post-shader live verification: the current Moreno/Perry quick match completed by fall with 3.5 seconds left in P1. The result screen and scoring log rendered; browser warnings and errors remained empty.

Cheek-volume refinement: moved the buccal volume forward and widened its support across the cheek-to-jaw transition. The prior face retained a hollow lateral contour even with the hollow parameter at zero. Body-lab rebuild: 60,035 total vertices, 41,055 head vertices; the six views show a softer transition. This is an art estimate and modest contour improvement, not proof of recognizable likeness. Typecheck, paired clip checks and full-site build pass.

Completed browser quick bout after cheek refinement: Moreno/Perry fall at 0:12 left in P1, 0–7, no warnings or errors. This validates the animated model through a result screen, not likeness or scoring calibration.

## Eye material revision

Reduced the procedural iris radius from 46 to 41 texture pixels (roughly an 11.5 mm iris on the 23.8 mm globe), extended upper-lid shading onto the visible eye, removed duplicate dark sclera tint, and softened the clearcoat highlight. Fresh local body-lab views render without warnings or errors; typecheck and full site build pass. The face is still visibly artificial and this does not establish likeness or UFC-quality characters. Further facial anatomy, hair and motion work remains required.

## Separate upper-lid fold geometry

Added an optional upper-lid hood mass after orbital carving. The fold descends over the upper globe independently of symmetric aperture height; the lower lid and eye centre stay fixed. Moreno’s photograph-based art estimate uses 2.5 mm descent. Other faces default to no added fold. Fresh body-lab rebuild increases head geometry from 41,055 to 41,245 vertices and visibly covers more upper sclera. Screenshot: outputs/moreno-upper-lid-fold.jpg. No console warnings/errors. Typecheck and paired clip checks pass. The face still has artificial cheek planes, mouth construction and hair; this is a local anatomy iteration, not a completed likeness. Animated validation completed: Moreno 72 vs Perry 94, quick match, 0–7 fall with 6.6 seconds left in P1 after two stalling penalties, a double leg and near fall; no console warnings or errors. This largely idle human-side smoke check validates the updated model through a completed match, not balance or likeness. Screenshot: outputs/moreno-lid-match-check.jpg. Full-site build passes.

## Rounded soft-tissue construction

Removed skeletal jaw-plane clipping from Moreno’s paired buccal and lower-cheek tissue masses. Other athlete defaults preserve their construction. The previous clipping cut grooves through soft cheek tissue; the untrimmed overlapping volumes now form rounded surfaces. Fresh worker build: head 41,199 vertices, body 60,057, gear 9,729. Six-view browser inspection confirms removal of the deep lateral cheek grooves; screenshot outputs/moreno-rounded-cheeks.jpg. Eyes, mouth, hair and recognizable likeness remain unfinished. Typecheck, paired clip checks and full-site build pass. No career fall total was found in the official Moreno biography; pin-rate adjustment remains pending rather than invented.

Animated validation: Moreno versus Perry Quick match completed by fall, 0–7 with 4.8 seconds left in P1. Single-leg takedown, near fall, stalling penalties and 13-second ride appeared in the result log. Browser warnings/errors empty. This mostly idle human-side smoke check validates animation through a result screen, not likeness or balance calibration.
