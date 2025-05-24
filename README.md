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
