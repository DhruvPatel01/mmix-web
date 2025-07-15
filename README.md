# How to Build
- install emsdk
- install texlive (or latex equivalent)
- install mmix (I used nix-env)
- install bun
- after installing bun install codemirror
   - run `bun add codemirror`

# Must TOOD
- [ ] zebra stripes
- [ ] integrate mmo decoder with step by step executioner
- [ ] integrate above with zebra stripes

# Next Features to work on
- [x] file browser type interface for github repo
https://github.com/theartofcomputerprogramming/mmixsamples
- [x] memory viewer
- [x] add premitive syntax highlight
- [ ] add short lived register highlight for changed register
- [ ] add form field to manually add back deleted register
- [ ] add posibility to add more memory addresses
- [ ] allow custom register to be printed
- [ ] automatically show special registers as well
- [ ] add support for breakpoints

# Features not supported yet/and not planned yet
- [ ] command line arguments
- [ ] standard input


# Should TODO
- [ ] handle line number directives

# Next Steps

## Immediate

Step by step execution work flow.
1. [x] Compile when click `compile`
2. [x] When click on `next` go to next step, unless not already compiled
   1. [x] if compiled, disable the button while exeuction is running
   2. [x] print the output on console
   3. [x] enable next button again
3. [ ] show the output on html (stderr and stdout two boxes)

## After above (vague)
- highlight the line which will be executed next
- handle custom breakpoints
