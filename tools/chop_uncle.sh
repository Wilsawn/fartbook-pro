#!/bin/bash
# How the uncle clip was prepared (run in a sandbox, not needed at the hackathon).
# 1) vocals vs background split with audio-separator (model Kim_Vocal_2.onnx) inside a throwaway venv:
#      audio-separator assets/raw/uncle_full.wav -m Kim_Vocal_2.onnx --output_dir sep
# 2) cut + level each chop (times in seconds, found from the loudness of each stem):
#    voice_01 0.55-2.05  voice_02 2.10-3.20  voice_03 3.25-4.15  voice_04 4.50-5.45
#    voice_05 7.10-8.10  voice_06 8.15-8.70  voice_07 8.85-9.30       (from the Vocals stem)
#    fart_01  0.10-0.55  fart_02  4.15-4.55  fart_03  5.45-7.10       (from the background stem)
# Re-cut one chop:  ./tools/chop_uncle.sh IN.wav OUT.wav START END
set -e
DUR=$(python3 -c "print(round($4-$3,3))")
# -ss before -i + asetpts resets timestamps, so the fade-out is timed from the start of the chop
ffmpeg -y -v error -ss "$3" -t "$DUR" -i "$1" -ac 1 -ar 44100 \
  -af "asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.01,afade=t=out:st=$(python3 -c "print(max(0,$DUR-0.04))"):d=0.04,loudnorm=I=-16:TP=-1.5" "$2"
echo "wrote $2"
