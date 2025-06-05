emcc_args := "-std=c99 -sINVOKE_RUN=0 -sEXPORT_ES6=1 -sENVIRONMENT=web -sMODULARIZE=1 -sEXPORTED_FUNCTIONS=_main,_malloc -sEXPORTED_RUNTIME_METHODS=\"['lengthBytesUTF8','stringToUTF8','callMain', 'FS']\""

editor *args:
  bun build ./editor.mjs --outdir ./dist/ {{args}}

dev:
  tmux new-session -d -s dev 'python -m http.server' \; split-window -h 'open http://localhost:8000; just editor --watch' \; attach
  
  
mmixal:
  #!/bin/bash
  cd mmixware
  make mmixal
  mkdir ../dist
  emcc {{emcc_args}} -sEXPORT_NAME=MMIXAL -o ../dist/mmixal.js mmixal.c mmix-arith.c

mmix:
  #!/bin/bash
  
  cd mmixware
  make clean
  cp ../mmix-sim-aug.c ../mmix-sim.ch ./
  make mmix # it delets the abstime
  make abstime
  mkdir ../dist
  ./abstime > abstime.h
  emcc {{emcc_args}} -sASYNCIFY -sEXPORT_NAME=MMIX -o ../dist/mmix.js mmix-sim.c mmix-sim-aug.c mmix-arith.c mmix-io.c
  rm abstime.h mmix-sim-aug.c mmix-sim.ch

registers-table:
  #!/usr/bin/env python
  import pyperclip

  registers = list(str(x) for x in range(0, 256))
  registers.extend("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
  registers.extend(["BB", "TT", "WW", "XX", "YY", "ZZ"])

  output = []
  close_btn = """<td><button class="contrast" onclick="hideRow(this)">x</button></td>"""
  for r in registers:
    output.append(f"""<tr class="hidden-reg" id="r{r}"><td>r{r}</td><td>0</td>{close_btn}</tr>""")
  output = "\n".join(output)
  pyperclip.copy(output)
  print(output)