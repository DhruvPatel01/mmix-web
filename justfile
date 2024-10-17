emcc_args := "-sINVOKE_RUN=0 -sEXPORT_ES6=1 -sENVIRONMENT=web -sMODULARIZE=1 -sEXPORTED_FUNCTIONS=_main,_malloc -sEXPORTED_RUNTIME_METHODS=\"['lengthBytesUTF8','stringToUTF8','callMain', 'FS']\""

editor:
  bun build ./editor.mjs --outdir .
  
mmixal:
  #!/bin/bash
  cd mmixware
  make mmixal
  emcc {{emcc_args}} -sEXPORT_NAME=MMIXAL -o ../mmixal.js mmixal.c mmix-arith.c

mmix:
  #!/bin/bash
  
  cd mmixware
  make clean
  cp ../mmix-sim-aug.c ./
  make mmix # it delets the abstime
  make abstime
  ./abstime > abstime.h
  emcc {{emcc_args}} -sASYNCIFY -sEXPORT_NAME=MMIX -o ../mmix.js mmix-sim.c mmix-sim-aug.c mmix-arith.c mmix-io.c
  rm abstime.h mmix-sim-aug.c
