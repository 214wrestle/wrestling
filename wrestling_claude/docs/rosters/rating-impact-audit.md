# Controlled rating impact audit

Executable: src/dev/ratingImpact.ts; bundle with esbuild for Node, then run. 400 full matches per gap at Starter AI, identical body/style/weight, attributes set by actual current rating mapping. Same 200 simulation/AI seed pairs repeated with corners swapped; equal-rated control is exactly symmetric. Both AIs issue commands, default full NCAA match. Position choices cycle neutral/top/bottom consistently per seed pair. No sim parameter changed.

96 vs96:200/400 wins,50%,zero average score margin.
96 vs90:222/400 wins,55.5%,0.725 average score margin.
96 vs85:274/400 wins,68.5%,2.2775 average score margin.

These are current-engine controlled fixture results, not forecasts for historical athletes or all user skill levels. OVR currently maps equally into quickness, strength, conditioning, mat and defense. Actual styles and pin-history vary separately. Individual attribute distributions and broader rating-gap calibration remain unfinished.
