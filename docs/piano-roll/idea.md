# Shared piano roll idea

Bass and Melody should use one three-octave piano-roll surface. Each track keeps its own absolute pitch range, while both surfaces render the same descending twelve-semitone pattern and expose exactly twelve rows at a time.

The shared surface also replaces per-cell hover propagation with one visual row indicator per scroll viewport so pointer feedback stays within the first rendered frame.
