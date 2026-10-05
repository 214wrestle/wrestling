# Michael Moreno playable realism pilot

The playable Moreno model now uses the existing realism prototype's finer facial surfaces, anatomical muscle shapes, ambient occlusion, cloth normals, skin detail and layered hair. The body lab and game share this renderer through the common CharacterRig contract; geometry is built in a worker with a synchronous fallback. Other wrestlers keep their current renderer while their individual likeness work proceeds.

Iowa State's collegiate portrait/action photographs guide the red singlet, gold lettering/trim, short dark hair and white headgear: https://cyclones.com/sports/wrestling/roster/michael-moreno/1333. Geometry dimensions are art estimates, not scanned measurements. His face is still an approximation and does not meet the requested recognizable UFC-quality standard. No real scanned likeness or film-derived motion capture is claimed.

Review the development lab with `?lab=body&athlete=iowa-state-165-choice-michael-moreno&pose=rest`; add `&realism=0` to compare the previous renderer. The production game uses the pilot when Michael Moreno is selected at Iowa State 165. Further work: reference-matched facial volumes and expression, detailed school kit, athlete-specific movement and contact during distinct techniques.
